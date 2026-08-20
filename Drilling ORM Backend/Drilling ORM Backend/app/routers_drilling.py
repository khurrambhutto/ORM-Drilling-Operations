from fastapi import APIRouter, HTTPException, Request, Body, UploadFile, Form, Depends
from functools import lru_cache
from datetime import datetime
import time
import matplotlib.pyplot as plt
from fastapi.responses import FileResponse
from .db import get_db_connection, return_connection
from .routers_auth import get_current_user
from .email_utils import send_report_email

router = APIRouter()

@router.get("/")
def read_root():
    return {"message": "Drilling backend is running!"}

@router.post("/send-drilling-report")
async def send_drilling_report(pdf: UploadFile, to: str = Form(...), subject: str = Form(...), body: str = Form(...)):
    return await send_report_email(pdf, to, subject, body)

@lru_cache(maxsize=1)
def get_cached_drilling_operations():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Ensure Well.IsActive column exists and default to active
        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[dbo].[Well]') AND name = 'IsActive'
            )
            BEGIN
                ALTER TABLE Well ADD IsActive BIT NOT NULL CONSTRAINT DF_Well_IsActive DEFAULT(1);
            END
            """
        )
        # Ensure DrillingOperation.GeneralNotes exists before selecting it
        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[dbo].[DrillingOperation]') AND name = 'GeneralNotes'
            )
            BEGIN
                ALTER TABLE DrillingOperation ADD GeneralNotes NVARCHAR(MAX) NULL;
            END
            """
        )
        # Ensure Well.JUVPercent column exists before selecting it
        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[dbo].[Well]') AND name = 'JUVPercent'
            )
            BEGIN
                ALTER TABLE Well ADD JUVPercent NVARCHAR(MAX) NULL;
            END
            """
        )
        # No commit needed for schema-only change in SQL Server through this connection
        cursor.execute("""
            SELECT 
                do.DrillingOperationID,
                do.SrNo,
                r.RigNo,
                w.WellName,
                w.WellID,
                b.BlockName,
                w.Latitude,
                w.Longitude,
                w.JUVPercent,
                do.SpudDate,
                do.PresentDepthM,
                do.TDM,
                ap.DrlgDays,
                ap.TestDays,
                do.MDrld,
                do.WeeklyM,
                ar.DryDays,
                ar.TestWODays,
                do.OperationLog,
                do.GeneralNotes,
                do.StopCard,
                do.LastUpdated
            FROM DrillingOperation do
            JOIN Rig r ON do.RigID = r.RigID
            JOIN Well w ON do.WellID = w.WellID
            JOIN Block b ON w.BlockID = b.BlockID
            LEFT JOIN AFEPlan ap ON do.AFEPlanID = ap.AFEPlanID
            LEFT JOIN ActualRigDays ar ON do.ActualRigDaysID = ar.ActualRigDaysID
            WHERE ISNULL(w.IsActive, 1) = 1
            ORDER BY do.SrNo
        """)
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    finally:
        return_connection(conn)

@router.get("/drilling-operations")
def get_drilling_operations(user=Depends(get_current_user)):
    # Admin: full list
    get_cached_drilling_operations.cache_clear()
    all_ops = get_cached_drilling_operations()
    if user.get("IsAdmin"):
        return all_ops
    # Non-admin: filter by allowed wells
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT WellID FROM UserWellAccess WHERE UserID = ?", (user["UserID"],))
        allowed = {r[0] for r in cursor.fetchall()}
    finally:
        return_connection(conn)
    if not allowed:
        return []
    return [op for op in all_ops if op.get("WellID") in allowed]

@router.get("/fiscal-year-plans")
def get_fiscal_year_plans(wellId: int = None, fy: str = "2025-26", user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if wellId is not None:
            cursor.execute(
                """
                SELECT FiscalYearPlanID, FY, QTR, WellName, WellDepth, PlanDetails, WellID
                FROM FiscalYearPlan
                WHERE FY = ? AND WellID = ?
                ORDER BY 
                    CASE QTR 
                        WHEN '1st QTR' THEN 1
                        WHEN '2nd QTR' THEN 2
                        WHEN '3rd QTR' THEN 3
                        WHEN '4th QTR' THEN 4
                    END
                """,
                (fy, wellId)
            )
            columns = [column[0] for column in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            if user.get("IsAdmin"):
                return results
            c2 = conn.cursor()
            c2.execute("SELECT WellID FROM UserWellAccess WHERE UserID = ?", (user["UserID"],))
            allowed = {r[0] for r in c2.fetchall()}
            return [r for r in results if r.get("WellID") in allowed]
        else:
            return []
    finally:
        return_connection(conn)

@router.post("/add-fiscal-year-plan")
def add_fiscal_year_plan(plan: dict = Body(...), user=Depends(get_current_user)):
    if not user.get("IsAdmin"):
        raise HTTPException(status_code=403, detail="Admin only")
    required_fields = ["FY", "QTR"]
    for field in required_fields:
        if field not in plan or not plan[field]:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
              INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails, WellID)
              OUTPUT INSERTED.FiscalYearPlanID, INSERTED.FY, INSERTED.QTR, INSERTED.WellName, INSERTED.WellDepth, INSERTED.PlanDetails, INSERTED.WellID
              VALUES (?, ?, ?, ?, ?, ?)
              """,
            (
                plan["FY"],
                plan["QTR"],
                plan.get("WellName"),
                plan.get("WellDepth"),
                plan.get("PlanDetails"),
                plan.get("WellID")
            )
        )
        inserted = cursor.fetchone()
        conn.commit()
        if inserted:
            columns = [column[0] for column in cursor.description]
            return dict(zip(columns, inserted))
        else:
            raise HTTPException(status_code=500, detail="Insert failed")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        return_connection(conn)

@router.put("/fiscal-year-plans/{plan_id}")
def update_fiscal_year_plan(plan_id: int, plan: dict = Body(...), user=Depends(get_current_user)):
    if not user.get("IsAdmin"):
        raise HTTPException(status_code=403, detail="Admin only")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE FiscalYearPlan
            SET WellName = ?, WellDepth = ?, PlanDetails = ?
            WHERE FiscalYearPlanID = ?
            """,
            (plan.get("WellName"), plan.get("WellDepth"), plan.get("PlanDetails"), plan_id)
        )
        if cursor.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Plan not found")
        conn.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        return_connection(conn)

@router.delete("/fiscal-year-plans/{plan_id}")
def delete_fiscal_year_plan(plan_id: int, user=Depends(get_current_user)):
    if not user.get("IsAdmin"):
        raise HTTPException(status_code=403, detail="Admin only")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM FiscalYearPlan WHERE FiscalYearPlanID = ?", (plan_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Plan not found")
        conn.commit()
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        return_connection(conn)

@router.get("/fiscal-year-plans-all")
def get_fiscal_year_plans_all(fy: str = "2025-26", user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT FiscalYearPlanID, FY, QTR, WellName, WellDepth, PlanDetails, WellID
            FROM FiscalYearPlan
            WHERE FY = ?
            ORDER BY 
                CASE QTR 
                    WHEN '1st QTR' THEN 1
                    WHEN '2nd QTR' THEN 2
                    WHEN '3rd QTR' THEN 3
                    WHEN '4th QTR' THEN 4
                END, WellID
            """,
            (fy,)
        )
        columns = [column[0] for column in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        if user.get("IsAdmin"):
            return rows
        c2 = conn.cursor()
        c2.execute("SELECT WellID FROM UserWellAccess WHERE UserID = ?", (user["UserID"],))
        allowed = {r[0] for r in c2.fetchall()}
        return [r for r in rows if r.get("WellID") in allowed]
    finally:
        return_connection(conn)

@router.get("/debug/wells")
def debug_wells():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT w.WellID, w.WellName, do.DrillingOperationID
            FROM Well w
            LEFT JOIN DrillingOperation do ON w.WellID = do.WellID
            ORDER BY w.WellName
        """)
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return {"wells": results}
    finally:
        return_connection(conn)
