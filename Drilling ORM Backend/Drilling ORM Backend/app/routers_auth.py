import os
import base64
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import List, Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends, Header, Body
import secrets
import string

from .db import get_db_connection, return_connection

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change")
JWT_ALG = "HS256"
JWT_EXP_MIN = 360  # 6 hours

router = APIRouter()

# ---------- Password Hashing Utilities ----------
PBKDF_ITERATIONS = 480_000
SALT_LEN = 16

def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF_ITERATIONS)

def _generate_salt() -> bytes:
    return os.urandom(SALT_LEN)

def verify_password(password: str, salt_b64: str, stored_hash_b64: str) -> bool:
    try:
        salt = base64.b64decode(salt_b64)
        stored = base64.b64decode(stored_hash_b64)
    except Exception:
        return False
    test = _hash_password(password, salt)
    return hmac.compare_digest(test, stored)

# ---------- DB Bootstrap (lazy) ----------

def ensure_user_tables():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
            BEGIN
                CREATE TABLE Users (
                    UserID INT IDENTITY PRIMARY KEY,
                    Username VARCHAR(50) UNIQUE NOT NULL,
                    PasswordHash VARBINARY(256) NOT NULL,
                    PasswordSalt VARBINARY(64) NOT NULL,
                    IsAdmin BIT NOT NULL CONSTRAINT DF_Users_IsAdmin DEFAULT(0),
                    IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT(1),
                    CreatedAt DATETIME NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT(GETDATE())
                );
            END
            """
        )
        cursor.execute(
            """
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserWellAccess]') AND type in (N'U'))
            BEGIN
                CREATE TABLE UserWellAccess (
                    UserWellAccessID INT IDENTITY PRIMARY KEY,
                    UserID INT NOT NULL,
                    WellID INT NOT NULL,
                    CONSTRAINT UQ_User_Well UNIQUE(UserID, WellID),
                    CONSTRAINT FK_UserWellAccess_User FOREIGN KEY(UserID) REFERENCES Users(UserID),
                    CONSTRAINT FK_UserWellAccess_Well FOREIGN KEY(WellID) REFERENCES Well(WellID)
                );
            END
            """
        )
        # Seed two admin users if none exist
        cursor.execute("SELECT COUNT(1) FROM Users WHERE IsAdmin = 1")
        if cursor.fetchone()[0] == 0:
            for uname in ["admin1", "admin2"]:
                salt = _generate_salt()
                pwd = "ChangeMe123!".encode()
                hashed = _hash_password("ChangeMe123!", salt)
                cursor.execute(
                    "INSERT INTO Users (Username, PasswordHash, PasswordSalt, IsAdmin) VALUES (?, ?, ?, 1)",
                    (uname, hashed, salt)
                )
        conn.commit()
    finally:
        return_connection(conn)

# ---------- JWT Helpers ----------

def create_token(user_id: int, username: str, is_admin: bool) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "adm": is_admin,
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXP_MIN)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------- Dependencies ----------

def get_current_user(authorization: Optional[str] = Header(None)):
    ensure_user_tables()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    data = decode_token(token)
    user_id = int(data["sub"])
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT UserID, Username, IsAdmin, IsActive FROM Users WHERE UserID = ?", (user_id,))
        row = cursor.fetchone()
        if not row or row[3] == 0:
            raise HTTPException(status_code=401, detail="User inactive")
        return {"UserID": row[0], "Username": row[1], "IsAdmin": bool(row[2])}
    finally:
        return_connection(conn)


def require_admin(user = Depends(get_current_user)):
    if not user["IsAdmin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    return user

# ---------- Routes ----------

@router.post("/auth/login")
def login(data: dict = Body(...)):
    ensure_user_tables()
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username & password required")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT UserID, PasswordHash, PasswordSalt, IsAdmin, IsActive FROM Users WHERE Username = ?", (username,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Wrong password or credentials")
        if row[4] == 0:
            raise HTTPException(status_code=401, detail="Inactive user")
        stored_hash_b64 = base64.b64encode(row[1]).decode()
        salt_b64 = base64.b64encode(row[2]).decode()
        if not verify_password(password, salt_b64, stored_hash_b64):
            raise HTTPException(status_code=401, detail="Wrong password or credentials")
        token = create_token(row[0], username, bool(row[3]))
        return {"token": token, "isAdmin": bool(row[3])}
    finally:
        return_connection(conn)

@router.get("/me")
def me(user = Depends(get_current_user)):
    # Return allowed wells for non-admin
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if user["IsAdmin"]:
            return {"user": user, "allowedWells": "*"}
        cursor.execute("SELECT WellID FROM UserWellAccess WHERE UserID = ?", (user["UserID"],))
        wells = [r[0] for r in cursor.fetchall()]
        return {"user": user, "allowedWells": wells}
    finally:
        return_connection(conn)

@router.post("/auth/change-password")
def change_password(data: dict = Body(...), user = Depends(get_current_user)):
    current = data.get("currentPassword")
    new = data.get("newPassword")
    if not current or not new:
        raise HTTPException(status_code=400, detail="Missing fields")
    if len(new) < 8:
        raise HTTPException(status_code=400, detail="Password too short")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT PasswordHash, PasswordSalt FROM Users WHERE UserID = ?", (user["UserID"],))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        stored_hash_b64 = base64.b64encode(row[0]).decode()
        salt_b64 = base64.b64encode(row[1]).decode()
        if not verify_password(current, salt_b64, stored_hash_b64):
            raise HTTPException(status_code=401, detail="Current password incorrect")
        new_salt = _generate_salt()
        new_hash = _hash_password(new, new_salt)
        cursor.execute("UPDATE Users SET PasswordHash = ?, PasswordSalt = ? WHERE UserID = ?", (new_hash, new_salt, user["UserID"]))
        conn.commit()
        return {"status": "ok"}
    finally:
        return_connection(conn)

# -------- Admin User Management --------
@router.post("/admin/users")
def admin_create_user(data: dict = Body(...), admin = Depends(require_admin)):
    username = data.get("username")
    password = data.get("password") or "TempPass123!"
    is_admin = bool(data.get("isAdmin", False))
    wells: List[int] = data.get("wellIds") or []
    if not username:
        raise HTTPException(status_code=400, detail="username required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="password too short")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        salt = _generate_salt()
        hashed = _hash_password(password, salt)
        cursor.execute("INSERT INTO Users (Username, PasswordHash, PasswordSalt, IsAdmin) OUTPUT INSERTED.UserID VALUES (?, ?, ?, ?)", (username, hashed, salt, 1 if is_admin else 0))
        new_user_id = cursor.fetchone()[0]
        # assign wells if not admin
        if not is_admin and wells:
            for wid in wells:
                try:
                    cursor.execute("INSERT INTO UserWellAccess (UserID, WellID) VALUES (?, ?)", (new_user_id, wid))
                except Exception:
                    pass
        conn.commit()
        return {"UserID": new_user_id, "username": username, "isAdmin": is_admin}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@router.get("/admin/users")
def admin_list_users(admin = Depends(require_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT UserID, Username, IsAdmin, IsActive, CreatedAt FROM Users ORDER BY UserID")
        users = [dict(UserID=r[0], Username=r[1], IsAdmin=bool(r[2]), IsActive=bool(r[3]), CreatedAt=r[4]) for r in cursor.fetchall()]
        return users
    finally:
        return_connection(conn)

@router.patch("/admin/users/{user_id}")
def admin_update_user(user_id: int, data: dict = Body(...), admin = Depends(require_admin)):
    is_active = data.get("isActive")
    wells: Optional[List[int]] = data.get("wellIds")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if is_active is not None:
            cursor.execute("UPDATE Users SET IsActive = ? WHERE UserID = ?", (1 if is_active else 0, user_id))
        if wells is not None:
            cursor.execute("DELETE FROM UserWellAccess WHERE UserID = ?", (user_id,))
            for wid in wells:
                try:
                    cursor.execute("INSERT INTO UserWellAccess (UserID, WellID) VALUES (?, ?)", (user_id, wid))
                except Exception:
                    pass
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@router.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin = Depends(require_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM UserWellAccess WHERE UserID = ?", (user_id,))
        cursor.execute("DELETE FROM Users WHERE UserID = ?", (user_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

# -------- Additional Admin Utilities --------
@router.get("/admin/users/{user_id}/wells")
def admin_get_user_wells(user_id: int, admin = Depends(require_admin)):
    """Return list of WellID a (non-admin) user currently has access to.
    Always returns an empty list for admins as they have implicit * access.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT IsAdmin FROM Users WHERE UserID = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if row[0]:  # admin user
            return []
        cursor.execute("SELECT WellID FROM UserWellAccess WHERE UserID = ?", (user_id,))
        return [r[0] for r in cursor.fetchall()]
    finally:
        return_connection(conn)

def _generate_password(length: int = 12) -> str:
    # At least one of each category; then fill the rest
    if length < 8:
        length = 8
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        # basic policy: at least 1 upper, 1 lower, 1 digit, 1 special
        if (any(c.islower() for c in pwd) and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd) and any(c in "!@#$%^&*()-_=+" for c in pwd)):
            return pwd

@router.post("/admin/users/{user_id}/reset-password")
def admin_reset_password(user_id: int, data: dict = Body(default={}), admin = Depends(require_admin)):
    """Reset another user's password.
    Body: {"newPassword": optional string, "generate": bool (default True if newPassword missing)}
    Returns {status:"ok", newPassword?: "..."}
    """
    new_password = data.get("newPassword")
    generate = data.get("generate")
    if not new_password:
        # if not provided or generate True, create one
        if generate is None or generate:
            new_password = _generate_password()
        else:
            raise HTTPException(status_code=400, detail="newPassword required when generate is false")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password too short")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT UserID FROM Users WHERE UserID = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        salt = _generate_salt()
        hashed = _hash_password(new_password, salt)
        cursor.execute("UPDATE Users SET PasswordHash = ?, PasswordSalt = ? WHERE UserID = ?", (hashed, salt, user_id))
        conn.commit()
        # Return generated password ONLY if it was generated server-side (avoid echoing custom provided password unnecessarily)
        resp = {"status": "ok"}
        if data.get("newPassword") is None:  # meaning we generated it
            resp["newPassword"] = new_password
        return resp
    finally:
        return_connection(conn)
