from fastapi import FastAPI, HTTPException, Request, UploadFile, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pyodbc
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from functools import lru_cache
import time
import smtplib
from email.message import EmailMessage
import os
import logging

# Set up logging to see detailed errors
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev: allow all
    allow_credentials=False,  # wildcard origin cannot be used with credentials
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection settings

server = r'localhost\SQLEXPRESS'

database = 'ORM DRILLING OPERATIONS'
driver = '{ODBC Driver 17 for SQL Server}'

# Connection pool for better performance
_connection_pool = []

def get_db_connection():
    if _connection_pool:
        try:
            conn = _connection_pool.pop()
            # Test if connection is still alive
            conn.cursor().execute("SELECT 1")
            return conn
        except:
            pass
    conn = pyodbc.connect(
        f'DRIVER={driver};SERVER={server};DATABASE={database};Trusted_Connection=yes;'
    )
    return conn

def return_connection(conn):
    try:
        if len(_connection_pool) < 5:  # Limit pool size
            _connection_pool.append(conn)
        else:
            conn.close()
    except:
        conn.close()

@app.get("/")
def read_root():
    return {"message": "Drilling backend is running!"}

# --- Helpers to evolve schema safely ---
def ensure_column(cursor, table_name: str, column_name: str, column_type: str):
    """Ensure a column exists on a SQL Server table; add it if missing.
    Note: Uses literal injection for object names (trusted constants), not parameters.
    """
    tsql = f"""
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '{table_name}' AND COLUMN_NAME = '{column_name}'
    )
    BEGIN
        ALTER TABLE [{table_name}] ADD [{column_name}] {column_type};
    END
    """
    cursor.execute(tsql)

# --- WellDailyProgress (Well Details) Endpoints ---
def _ensure_wdp_table(cursor):
    cursor.execute(
        """
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WellDailyProgress]') AND type in (N'U'))
        BEGIN
            CREATE TABLE WellDailyProgress (
                WellDailyProgressID INT PRIMARY KEY IDENTITY,
                WellID INT NOT NULL,
                WellName VARCHAR(50) NOT NULL,
                [Date] DATE NOT NULL,
                [Day] INT NOT NULL,
                PlannedDepth BIGINT,
                ActualDepth BIGINT,
                Progress BIGINT,
                OperationLog TEXT,
                CONSTRAINT UQ_WellDailyProgress UNIQUE (WellName, [Date])
            )
        END
        """
    )

@app.get("/well-daily-progress")
def list_well_daily_progress(wellId: int = None, wellName: str = None):
    if not wellId and not wellName:
        raise HTTPException(status_code=400, detail="Provide wellId or wellName")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _ensure_wdp_table(cursor)
        # initial fetch
        if wellId:
            cursor.execute(
                """
                SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                FROM WellDailyProgress
                WHERE WellID = ?
                ORDER BY [Date]
                """,
                (wellId,)
            )
        else:
            cursor.execute(
                """
                SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                FROM WellDailyProgress
                WHERE WellName = ?
                ORDER BY [Date]
                """,
                (wellName,)
            )
        columns = [c[0] for c in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Auto-seed if empty and plan exists
        if not rows:
            try:
                if wellId:
                    cursor.execute(
                        """
                        SELECT TOP 1 w.WellID, w.WellName, do.SpudDate, COALESCE(ap.DrlgDays, do.MDrld) AS PlannedDays
                        FROM DrillingOperation do
                        JOIN Well w ON do.WellID = w.WellID
                        LEFT JOIN AFEPlan ap ON do.AFEPlanID = ap.AFEPlanID
                        WHERE w.WellID = ?
                        ORDER BY do.DrillingOperationID DESC
                        """,
                        (wellId,)
                    )
                else:
                    cursor.execute(
                        """
                        SELECT TOP 1 w.WellID, w.WellName, do.SpudDate, COALESCE(ap.DrlgDays, do.MDrld) AS PlannedDays
                        FROM DrillingOperation do
                        JOIN Well w ON do.WellID = w.WellID
                        LEFT JOIN AFEPlan ap ON do.AFEPlanID = ap.AFEPlanID
                        WHERE w.WellName = ?
                        ORDER BY do.DrillingOperationID DESC
                        """,
                        (wellName,)
                    )
                meta = cursor.fetchone()
                if meta:
                    w_id, w_name, spud_date, drlg_days = meta
                    try:
                        planned = int(drlg_days) if drlg_days is not None else 0
                    except Exception:
                        planned = 0
                    if planned > 0 and spud_date is not None:
                        # Normalize spud date
                        try:
                            if isinstance(spud_date, str):
                                sd = datetime.fromisoformat(spud_date).date()
                            elif isinstance(spud_date, datetime):
                                sd = spud_date.date()
                            else:
                                sd = spud_date
                        except Exception:
                            sd = datetime.now().date()
                        # Build Mon-Fri dates
                        dates = []
                        if planned > 0:
                            dates.append(sd)
                        current = sd
                        while len(dates) < planned:
                            current = current + timedelta(days=1)
                            if current.weekday() < 5:
                                dates.append(current)
                        for i, d in enumerate(dates):
                            cursor.execute(
                                """
                                INSERT INTO WellDailyProgress (WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog)
                                VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)
                                """,
                                (w_id, w_name, d, i)
                            )
                        conn.commit()
                        # refetch
                        if wellId:
                            cursor.execute(
                                """
                                SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                                FROM WellDailyProgress
                                WHERE WellID = ?
                                ORDER BY [Date]
                                """,
                                (wellId,)
                            )
                        else:
                            cursor.execute(
                                """
                                SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                                FROM WellDailyProgress
                                WHERE WellName = ?
                                ORDER BY [Date]
                                """,
                                (wellName,)
                            )
                        columns = [c[0] for c in cursor.description]
                        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
            except Exception:
                # best effort only
                pass
        return rows
    finally:
        return_connection(conn)

@app.post("/well-daily-progress")
def create_well_daily_progress(payload: dict = Body(...)):
    required = ["WellID", "WellName", "Date", "Day"]
    for k in required:
        if k not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {k}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _ensure_wdp_table(cursor)
        cursor.execute(
            """
            INSERT INTO WellDailyProgress (WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog)
            OUTPUT INSERTED.WellDailyProgressID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["WellID"],
                payload["WellName"],
                payload["Date"],
                payload["Day"],
                payload.get("PlannedDepth"),
                payload.get("ActualDepth"),
                payload.get("Progress"),
                payload.get("OperationLog"),
            )
        )
        new_id = cursor.fetchone()[0]
        conn.commit()
        return {"WellDailyProgressID": new_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@app.patch("/well-daily-progress/{wdp_id}")
def update_well_daily_progress(wdp_id: int, payload: dict = Body(...)):
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    allowed = {"WellID", "WellName", "Date", "Day", "PlannedDepth", "ActualDepth", "Progress", "OperationLog"}
    sets = []
    params = []
    for k, v in payload.items():
        if k in allowed:
            sets.append(f"[{k}] = ?")
            params.append(v)
    if not sets:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    params.append(wdp_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _ensure_wdp_table(cursor)
        cursor.execute(f"UPDATE WellDailyProgress SET {', '.join(sets)} WHERE WellDailyProgressID = ?", params)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Row not found")
        conn.commit()
        return {"success": True}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@app.delete("/well-daily-progress/{wdp_id}")
def delete_well_daily_progress(wdp_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _ensure_wdp_table(cursor)
        cursor.execute("DELETE FROM WellDailyProgress WHERE WellDailyProgressID = ?", (wdp_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Row not found")
        conn.commit()
        return {"success": True}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@app.post("/well-daily-progress/seed-all")
def seed_all_well_daily_progress():
    conn = get_db_connection()
    cursor = conn.cursor()
    total_seeded = 0
    wells_processed = 0
    try:
        _ensure_wdp_table(cursor)
        cursor.execute(
            """
            SELECT w.WellID, w.WellName, do.SpudDate, COALESCE(ap.DrlgDays, do.MDrld) AS PlannedDays
            FROM DrillingOperation do
            JOIN Well w ON do.WellID = w.WellID
            LEFT JOIN AFEPlan ap ON do.AFEPlanID = ap.AFEPlanID
            WHERE COALESCE(ap.DrlgDays, do.MDrld) IS NOT NULL AND COALESCE(ap.DrlgDays, do.MDrld) > 0
              AND NOT EXISTS (
                  SELECT 1 FROM WellDailyProgress x WHERE x.WellID = w.WellID OR x.WellName = w.WellName
              )
            ORDER BY do.DrillingOperationID DESC
            """
        )
        candidates = cursor.fetchall()
        for (w_id, w_name, spud_date, drlg_days) in candidates:
            wells_processed += 1
            try:
                planned = int(drlg_days) if drlg_days is not None else 0
            except Exception:
                planned = 0
            if planned <= 0 or spud_date is None:
                continue
            # Build dates and insert
            try:
                if isinstance(spud_date, str):
                    sd = datetime.fromisoformat(spud_date).date()
                elif isinstance(spud_date, datetime):
                    sd = spud_date.date()
                else:
                    sd = spud_date
            except Exception:
                sd = datetime.now().date()
            dates = []
            if planned > 0:
                dates.append(sd)
            current = sd
            while len(dates) < planned:
                current = current + timedelta(days=1)
                if current.weekday() < 5:
                    dates.append(current)
            for i, d in enumerate(dates):
                cursor.execute(
                    """
                    INSERT INTO WellDailyProgress (WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog)
                    VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)
                    """,
                    (w_id, w_name, d, i),
                )
            total_seeded += len(dates)
        conn.commit()
        return {"seeded": total_seeded, "wellsProcessed": wells_processed}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@app.post("/send-drilling-report")
async def send_drilling_report(
        pdf: UploadFile,
        to: str = Form(...),
        subject: str = Form(...),
        body: str = Form(...)
):
    try:
        # Validate PDF file
        if not pdf.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")

        # Read PDF file content
        pdf_bytes = await pdf.read()

        if len(pdf_bytes) == 0:
            raise HTTPException(status_code=400, detail="PDF file is empty")

        logger.info(f"PDF file size: {len(pdf_bytes)} bytes")

        # Validate email address format (basic validation)
        if '@' not in to or '.' not in to:
            raise HTTPException(status_code=400, detail="Invalid email address format")

        # Compose email
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = "zakinabeel522@gmail.com"
        msg["To"] = to
        msg.set_content(body)

        # Attach PDF with proper content type
        msg.add_attachment(
            pdf_bytes,
            maintype="application",
            subtype="pdf",
            filename=pdf.filename or "drilling_report.pdf"
        )

        # Gmail SMTP configuration
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        smtp_user = "zakinabeel522@gmail.com"
        smtp_pass = "ytdu babt xwte gqas"  # Consider using environment variables

        logger.info(f"Attempting to send email to: {to}")

        # Send via Gmail SMTP with better error handling
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.set_debuglevel(1)  # Enable debug output
            logger.info("Starting TLS...")
            server.starttls()

            logger.info("Logging in...")
            server.login(smtp_user, smtp_pass)

            logger.info("Sending message...")
            server.send_message(msg)

        logger.info("Email sent successfully!")
        return {"message": "Email sent successfully!"}

    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication Error: {e}")
        raise HTTPException(status_code=500, detail="Email authentication failed. Check credentials.")

    except smtplib.SMTPRecipientsRefused as e:
        logger.error(f"Recipients refused: {e}")
        raise HTTPException(status_code=400, detail="Invalid recipient email address")

    except smtplib.SMTPException as e:
        logger.error(f"SMTP Error: {e}")
        raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)}")

    except Exception as e:
        logger.error(f"Unexpected error sending email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# Cache drilling operations for 30 seconds
@lru_cache(maxsize=1)
def get_cached_drilling_operations():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
    # Ensure schema supports JVPercent on Well table (store the raw text like "OGDC The Energy: 65%, Partner: 35%")
        ensure_column(cursor, 'Well', 'JVPercent', 'NVARCHAR(MAX) NULL')
        cursor.execute(
            """
            SELECT 
                do.DrillingOperationID,
                do.SrNo,
                r.RigNo,
                w.WellName,
                w.WellID,
                b.BlockName,
                w.Latitude,
                w.Longitude,
                w.JVPercent,
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
                do.StopCard,
                do.LastUpdated,
                do.GeneralNotes
            FROM DrillingOperation do
            JOIN Rig r ON do.RigID = r.RigID
            JOIN Well w ON do.WellID = w.WellID
            JOIN Block b ON w.BlockID = b.BlockID
            LEFT JOIN AFEPlan ap ON do.AFEPlanID = ap.AFEPlanID
            LEFT JOIN ActualRigDays ar ON do.ActualRigDaysID = ar.ActualRigDaysID
            ORDER BY do.SrNo
            """
        )
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    finally:
        return_connection(conn)

@app.get("/drilling-operations")
def get_drilling_operations():
    # Clear cache every 30 seconds to get fresh data
    current_time = int(time.time() / 30)
    get_cached_drilling_operations.cache_clear()
    return get_cached_drilling_operations()

@app.get("/fiscal-year-plans")
def get_fiscal_year_plans(wellId: int = None, wellName: str = None, fy: str = "2025-26"):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if wellId is not None:
            # First get the well name from Well table
            cursor.execute("SELECT WellName FROM Well WHERE WellID = ?", wellId)
            well_result = cursor.fetchone()
            if well_result:
                well_name = well_result[0]
                cursor.execute("""
                    SELECT FiscalYearPlanID, FY, QTR, WellName, WellDepth, PlanDetails
                    FROM FiscalYearPlan
                    WHERE FY = ? AND WellName = ?
                    ORDER BY 
                        CASE QTR 
                            WHEN '1st QTR' THEN 1
                            WHEN '2nd QTR' THEN 2
                            WHEN '3rd QTR' THEN 3
                            WHEN '4th QTR' THEN 4
                        END
                """, fy, well_name)
            else:
                return []
        elif wellName is not None:
            cursor.execute("""
                SELECT FiscalYearPlanID, FY, QTR, WellName, WellDepth, PlanDetails
                FROM FiscalYearPlan
                WHERE FY = ? AND WellName = ?
                ORDER BY 
                    CASE QTR 
                        WHEN '1st QTR' THEN 1
                        WHEN '2nd QTR' THEN 2
                        WHEN '3rd QTR' THEN 3
                        WHEN '4th QTR' THEN 4
                    END
            """, fy, wellName)
        else:
            return []
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    except Exception as e:
        print(f"Error fetching fiscal year plans: {e}")
        return []
    finally:
        return_connection(conn)

@app.get("/fiscal-year-plans-all")
def get_fiscal_year_plans_all(fy: str = "2025-26"):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT FiscalYearPlanID, FY, QTR, WellName, WellDepth, PlanDetails
            FROM FiscalYearPlan
            WHERE FY = ?
            ORDER BY WellName, 
                CASE QTR 
                    WHEN '1st QTR' THEN 1
                    WHEN '2nd QTR' THEN 2
                    WHEN '3rd QTR' THEN 3
                    WHEN '4th QTR' THEN 4
                END
        """, fy)
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    except Exception as e:
        print(f"Error fetching all fiscal year plans: {e}")
        return []
    finally:
        return_connection(conn)

@app.post("/add-fiscal-year-plan")
def add_fiscal_year_plan(plan: dict = Body(...)):
    required_fields = ["FY", "QTR", "WellName"]
    for field in required_fields:
        if field not in plan or not plan[field]:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO FiscalYearPlan (FY, QTR, WellName, WellDepth, PlanDetails)
            OUTPUT INSERTED.FiscalYearPlanID, INSERTED.FY, INSERTED.QTR, INSERTED.WellName, INSERTED.WellDepth, INSERTED.PlanDetails
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                plan["FY"],
                plan["QTR"],
                plan["WellName"],
                plan.get("WellDepth"),
                plan.get("PlanDetails")
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
        print(f"Error inserting fiscal year plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        return_connection(conn)

@app.put("/fiscal-year-plans/{plan_id}")
async def update_fiscal_year_plan(plan_id: int, request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE FiscalYearPlan
            SET WellName = ?, WellDepth = ?, PlanDetails = ?
            WHERE FiscalYearPlanID = ?
        """, (data.get("WellName", ""), data.get("WellDepth", ""), data.get("PlanDetails", ""), plan_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)
    return {"message": "Fiscal year plan updated successfully"}

@app.get("/debug/wells")
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
    except Exception as e:
        return {"error": str(e)}
    finally:
        return_connection(conn)

@app.put("/drilling-operations/{operation_id}")
async def update_drilling_operation(operation_id: int, request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Ensure history table supports new columns
        try:
            ensure_column(cursor, 'DrillingOperationHistory', 'GeneralNotes', 'NVARCHAR(MAX) NULL')
        except Exception:
            # best-effort; continue even if ensure fails
            pass
        # 1. Fetch current row (old state)
        cursor.execute("""
            SELECT SrNo, RigID, WellID, SpudDate, PresentDepthM, TDM, AFEPlanID, 
                   MDrld, WeeklyM, ActualRigDaysID, OperationLog, StopCard, 
                   LastUpdated, FiscalYearPlanID, GeneralNotes
            FROM DrillingOperation
            WHERE DrillingOperationID = ?
        """, (operation_id,))
        current = cursor.fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Drilling operation not found")

        # 2. Insert old state into history
        cursor.execute("""
            INSERT INTO DrillingOperationHistory (
                DrillingOperationID, SrNo, RigID, WellID, SpudDate, PresentDepthM, TDM, AFEPlanID,
                MDrld, WeeklyM, ActualRigDaysID, OperationLog, StopCard, LastUpdated, 
                FiscalYearPlanID, GeneralNotes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            operation_id,
            current[0], current[1], current[2], current[3], current[4], current[5], current[6],
            current[7], current[8], current[9], current[10], current[11], current[12],
            current[13], current[14]  # GeneralNotes
        ))

        # 3. Update related AFEPlan table if needed (create if missing)
        afe_plan_id = current[6]
        if "DrlgDays" in data or "TestDays" in data:
            if afe_plan_id:
                cursor.execute(
                    """
                    UPDATE AFEPlan
                    SET DrlgDays = ?, TestDays = ?
                    WHERE AFEPlanID = ?
                    """,
                    (
                        data.get("DrlgDays"),
                        data.get("TestDays"),
                        afe_plan_id,
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO AFEPlan (DrlgDays, TestDays)
                    OUTPUT INSERTED.AFEPlanID
                    VALUES (?, ?)
                    """,
                    (data.get("DrlgDays"), data.get("TestDays")),
                )
                new_afe_id = cursor.fetchone()[0]
                # attach to DrillingOperation
                cursor.execute(
                    "UPDATE DrillingOperation SET AFEPlanID = ? WHERE DrillingOperationID = ?",
                    (new_afe_id, operation_id),
                )

        # 4. Update related ActualRigDays table if needed (create if missing)
        actual_rig_days_id = current[9]
        if "DryDays" in data or "TestWODays" in data:
            if actual_rig_days_id:
                cursor.execute(
                    """
                    UPDATE ActualRigDays
                    SET DryDays = ?, TestWODays = ?
                    WHERE ActualRigDaysID = ?
                    """,
                    (
                        data.get("DryDays"),
                        data.get("TestWODays"),
                        actual_rig_days_id,
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO ActualRigDays (DryDays, TestWODays)
                    OUTPUT INSERTED.ActualRigDaysID
                    VALUES (?, ?)
                    """,
                    (data.get("DryDays"), data.get("TestWODays")),
                )
                new_ar_id = cursor.fetchone()[0]
                # attach to DrillingOperation
                cursor.execute(
                    "UPDATE DrillingOperation SET ActualRigDaysID = ? WHERE DrillingOperationID = ?",
                    (new_ar_id, operation_id),
                )

        # 5. Update the DrillingOperation table (with new data)
        cursor.execute("""
            UPDATE DrillingOperation
            SET
                SrNo = ?,
                PresentDepthM = ?,
                TDM = ?,
                MDrld = ?,
                WeeklyM = ?,
                OperationLog = ?,
                StopCard = ?,
                GeneralNotes = ?,
                LastUpdated = ?
            WHERE DrillingOperationID = ?
        """, (
            data.get("SrNo", current[0]),
            data.get("PresentDepthM", current[4]),
            data.get("TDM", current[5]),
            data.get("MDrld", current[7]),
            data.get("WeeklyM", current[8]),
            data.get("OperationLog", current[10]),
            data.get("StopCard", current[11]),
            data.get("GeneralNotes", current[14] if current is not None and len(current) > 14 else None),
            datetime.now(),
            operation_id
        ))

        conn.commit()
        return {"message": "Updated successfully"}

    except Exception as e:
        print("UPDATE ERROR:", e)
        conn.rollback()
        import traceback
        print("Full traceback:", traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        return_connection(conn)

@app.get("/well-depths-plot")
def well_depths_plot():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT w.WellName, do.PresentDepthM
            FROM DrillingOperation do
            JOIN Well w ON do.WellID = w.WellID
        """)
        data = cursor.fetchall()
        wells = [row[0] for row in data]
        depths = [row[1] for row in data]
        plt.figure(figsize=(8, 4))
        plt.bar(wells, depths, color='#1976d2')
        plt.xlabel('Well')
        plt.ylabel('Present Depth (m)')
        plt.title('Present Depth by Well')
        plt.tight_layout()
        img_path = 'well_depths.png'
        plt.savefig(img_path)
        plt.close()
        return FileResponse(img_path, media_type='image/png')
    finally:
        return_connection(conn)

@app.get("/drilling-operations/{operation_id}/history")
def get_drilling_operation_history(operation_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT * FROM DrillingOperationHistory
            WHERE DrillingOperationID = ?
            ORDER BY HistoryTimestamp DESC
        """, (operation_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    finally:
        return_connection(conn)

@app.get("/well-history/{well_id}")
def get_well_history(well_id: int):
    """
    Get all historical drilling operations for a specific well.
    Returns detailed history with rig, well, and block information.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT 
                h.HistoryID,
                h.SrNo,
                h.SpudDate,
                h.PresentDepthM,
                h.TDM,
                h.MDrld,
                h.WeeklyM,
                h.OperationLog,
                h.StopCard,
                h.LastUpdated,
                h.HistoryTimestamp,
                h.GeneralNotes,
                r.RigNo,
                w.WellName,
                b.BlockName,
                w.Latitude,
                w.Longitude,
                ap.DrlgDays,
                ap.TestDays,
                ar.DryDays,
                ar.TestWODays
            FROM DrillingOperationHistory h
            JOIN Rig r ON h.RigID = r.RigID
            JOIN Well w ON h.WellID = w.WellID
            JOIN Block b ON w.BlockID = b.BlockID
            LEFT JOIN AFEPlan ap ON h.AFEPlanID = ap.AFEPlanID
            LEFT JOIN ActualRigDays ar ON h.ActualRigDaysID = ar.ActualRigDaysID
            WHERE h.WellID = ?
            ORDER BY h.HistoryTimestamp DESC
        """, (well_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    except Exception as e:
        print(f"Error fetching well history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        return_connection(conn)

@app.get("/well-history/{well_id}/by-date")
def get_well_history_by_date(well_id: int, date: str):
    """
    Get historical drilling operation for a specific well on a specific date.
    Returns detailed history with rig, well, and block information.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Convert date string to datetime for comparison
        search_date = datetime.strptime(date, "%Y-%m-%d").date()

        cursor.execute("""
            SELECT 
                h.HistoryID,
                h.SrNo,
                h.SpudDate,
                h.PresentDepthM,
                h.TDM,
                h.MDrld,
                h.WeeklyM,
                h.OperationLog,
                h.StopCard,
                h.LastUpdated,
                h.HistoryTimestamp,
                h.GeneralNotes,
                r.RigNo,
                w.WellName,
                b.BlockName,
                w.Latitude,
                w.Longitude,
                ap.DrlgDays,
                ap.TestDays,
                ar.DryDays,
                ar.TestWODays
            FROM DrillingOperationHistory h
            JOIN Rig r ON h.RigID = r.RigID
            JOIN Well w ON h.WellID = w.WellID
            JOIN Block b ON w.BlockID = b.BlockID
            LEFT JOIN AFEPlan ap ON h.AFEPlanID = ap.AFEPlanID
            LEFT JOIN ActualRigDays ar ON h.ActualRigDaysID = ar.ActualRigDaysID
            WHERE h.WellID = ? AND CAST(h.HistoryTimestamp AS DATE) = ?
            ORDER BY h.HistoryTimestamp DESC
        """, (well_id, search_date))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    except Exception as e:
        print(f"Error fetching well history by date: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        return_connection(conn)

@app.post("/drilling-operations")
async def add_drilling_operation(data: dict = Body(...)):
    """
    Add a new well and drilling operation.
    Expects: WellName, RigName, BlockName, Longitude, Latitude, SpudDate, TargetDepth, PlannedAFEDaysDrilling, PlannedAFEDaysTesting
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Ensure Block exists or create it
        cursor.execute("SELECT BlockID FROM Block WHERE BlockName = ?", data["BlockName"])
        block = cursor.fetchone()
        if block:
            block_id = block[0]
        else:
            cursor.execute("INSERT INTO Block (BlockName) OUTPUT INSERTED.BlockID VALUES (?)", data["BlockName"])
            block_id = cursor.fetchone()[0]

        # 2. Ensure Well exists or create it (also ensure JVPercent column exists)
        ensure_column(cursor, 'Well', 'JVPercent', 'NVARCHAR(MAX) NULL')
        cursor.execute("SELECT WellID FROM Well WHERE WellName = ?", data["WellName"])
        well = cursor.fetchone()
        if well:
            well_id = well[0]
            # Set JVPercent only if provided and currently NULL to keep it immutable after creation
            if 'JVPercent' in data and data['JVPercent'] is not None:
                try:
                    cursor.execute("UPDATE Well SET JVPercent = COALESCE(JVPercent, ?) WHERE WellID = ?", (data['JVPercent'], well_id))
                except Exception:
                    pass
        else:
            cursor.execute(
                "INSERT INTO Well (WellName, BlockID, Latitude, Longitude, JVPercent) OUTPUT INSERTED.WellID VALUES (?, ?, ?, ?, ?)",
                (data["WellName"], block_id, data.get("Latitude"), data.get("Longitude"), data.get("JVPercent"))
            )
            well_id = cursor.fetchone()[0]

        # 3. Ensure Rig exists or create it
        cursor.execute("SELECT RigID FROM Rig WHERE RigNo = ?", data["RigName"])
        rig = cursor.fetchone()
        if rig:
            rig_id = rig[0]
        else:
            cursor.execute("INSERT INTO Rig (RigNo) OUTPUT INSERTED.RigID VALUES (?)", data["RigName"])
            rig_id = cursor.fetchone()[0]

        # 4. Create AFE Plan
        afe_plan_id = None
        if data.get("PlannedAFEDaysDrilling") or data.get("PlannedAFEDaysTesting"):
            cursor.execute(
                """
                INSERT INTO AFEPlan (DrlgDays, TestDays) 
                OUTPUT INSERTED.AFEPlanID 
                VALUES (?, ?)
                """,
                (data.get("PlannedAFEDaysDrilling"), data.get("PlannedAFEDaysTesting"))
            )
            afe_plan_id = cursor.fetchone()[0]

        # 5. Create Actual Rig Days (initially empty)
        actual_rig_days_id = None
        cursor.execute("""
            INSERT INTO ActualRigDays (DryDays, TestWODays) 
            OUTPUT INSERTED.ActualRigDaysID 
            VALUES (NULL, NULL)
        """)
        actual_rig_days_id = cursor.fetchone()[0]

        # 6. Get next SrNo
        cursor.execute("SELECT ISNULL(MAX(SrNo), 0) + 1 FROM DrillingOperation")
        next_sr_no = cursor.fetchone()[0]

        # 7. Insert DrillingOperation
        cursor.execute("""
            INSERT INTO DrillingOperation (
                SrNo, RigID, WellID, SpudDate, PresentDepthM, TDM, AFEPlanID, 
                MDrld, WeeklyM, ActualRigDaysID, OperationLog, StopCard, LastUpdated
            )
            OUTPUT INSERTED.DrillingOperationID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            next_sr_no,
            rig_id,
            well_id,
            data.get("SpudDate"),
            data.get("PresentDepthM", 0),
            data.get("TargetDepth"),
            afe_plan_id,
            data.get("PlannedAFEDaysDrilling"),
            data.get("PlannedAFEDaysTesting"),
            actual_rig_days_id,
            "Well under Drilling. Initial setup completed.",  # Default operation log
            0,  # Default stop card
            datetime.now()
        ))
        drilling_operation_id = cursor.fetchone()[0]

        # Auto-seed WellDailyProgress rows based on planned drilling days from SpudDate
        try:
            spud_date = data.get("SpudDate")
            planned_days_raw = data.get("PlannedAFEDaysDrilling")
            try:
                planned_days = int(planned_days_raw) if planned_days_raw is not None else None
            except Exception:
                planned_days = None
            if spud_date and planned_days and planned_days > 0:
                # Ensure table exists
                cursor.execute(
                    """
                    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WellDailyProgress]') AND type in (N'U'))
                    BEGIN
                        CREATE TABLE WellDailyProgress (
                            WellDailyProgressID INT PRIMARY KEY IDENTITY,
                            WellID INT NOT NULL,
                            WellName VARCHAR(50) NOT NULL,
                            [Date] DATE NOT NULL,
                            [Day] INT NOT NULL,
                            PlannedDepth BIGINT,
                            ActualDepth BIGINT,
                            Progress BIGINT,
                            OperationLog TEXT,
                            CONSTRAINT UQ_WellDailyProgress UNIQUE (WellName, [Date])
                        )
                    END
                    """
                )
                # Only seed if no rows exist yet for this well
                cursor.execute(
                    "SELECT COUNT(1) FROM WellDailyProgress WHERE WellID = ? OR WellName = ?",
                    (well_id, data["WellName"]),
                )
                existing = cursor.fetchone()[0]
                if existing == 0:
                    # Normalize spud date to date
                    try:
                        if isinstance(spud_date, str):
                            sd = datetime.fromisoformat(spud_date).date()
                        elif isinstance(spud_date, datetime):
                            sd = spud_date.date()
                        else:
                            sd = spud_date
                    except Exception:
                        sd = datetime.now().date()

                    dates = []
                    if planned_days > 0:
                        dates.append(sd)  # Day 0
                    current = sd
                    while len(dates) < planned_days:
                        current = current + timedelta(days=1)
                        if current.weekday() < 5:  # Mon-Fri
                            dates.append(current)

                    for day_index, d in enumerate(dates):
                        cursor.execute(
                            """
                            INSERT INTO WellDailyProgress (WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog)
                            VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)
                            """,
                            (
                                well_id,
                                data["WellName"],
                                d,
                                day_index,
                            ),
                        )
        except Exception as seed_err:
            # Don't fail the main creation if seeding hits a uniqueness issue; log and proceed
            logger.warning(f"Seeding WellDailyProgress skipped due to: {seed_err}")

        conn.commit()
        return {"success": True, "DrillingOperationID": drilling_operation_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@app.delete("/drilling-operations/{drilling_operation_id}")
async def delete_drilling_operation(drilling_operation_id: int):
    """
    Delete a drilling operation and store it in PastWell table.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # First, get the complete drilling operation data
        cursor.execute("""
            SELECT 
                do.DrillingOperationID, do.SrNo, do.RigID, do.WellID, do.SpudDate, 
                do.PresentDepthM, do.TDM, do.AFEPlanID, do.MDrld, do.WeeklyM, 
                do.ActualRigDaysID, do.OperationLog, do.StopCard, do.LastUpdated,
                do.FiscalYearPlanID, do.GeneralNotes,
                r.RigNo, w.WellName, b.BlockName, w.Latitude, w.Longitude, w.JVPercent,
                ap.DrlgDays, ap.TestDays, ar.DryDays, ar.TestWODays
            FROM DrillingOperation do
            JOIN Rig r ON do.RigID = r.RigID
            JOIN Well w ON do.WellID = w.WellID
            JOIN Block b ON w.BlockID = b.BlockID
            LEFT JOIN AFEPlan ap ON do.AFEPlanID = ap.AFEPlanID
            LEFT JOIN ActualRigDays ar ON do.ActualRigDaysID = ar.ActualRigDaysID
            WHERE do.DrillingOperationID = ?
        """, (drilling_operation_id,))

        operation_data = cursor.fetchone()
        if not operation_data:
            raise HTTPException(status_code=404, detail="Drilling operation not found")

        # Create PastWell table if it doesn't exist
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PastWell]') AND type in (N'U'))
            BEGIN
                CREATE TABLE PastWell (
                    PastWellID INT PRIMARY KEY IDENTITY,
                    OriginalDrillingOperationID INT,
                    SrNo INT,
                    RigID INT,
                    WellID INT,
                    SpudDate DATE,
                    PresentDepthM INT,
                    TDM INT,
                    AFEPlanID INT,
                    MDrld VARCHAR(20),
                    WeeklyM VARCHAR(20),
                    ActualRigDaysID INT,
                    OperationLog NVARCHAR(MAX),
                    StopCard INT,
                    LastUpdated DATETIME,
                    FiscalYearPlanID INT,
                    GeneralNotes NVARCHAR(MAX),
                    RigNo VARCHAR(20),
                    WellName VARCHAR(50),
                    BlockName VARCHAR(50),
                    Latitude FLOAT,
                    Longitude FLOAT,
                    JVPercent NVARCHAR(MAX) NULL,
                    DrlgDays INT,
                    TestDays INT,
                    DryDays INT,
                    TestWODays INT,
                    DeletedAt DATETIME DEFAULT GETDATE()
                )
            END
        """)
        # Ensure JVPercent exists even if table already existed
        ensure_column(cursor, 'PastWell', 'JVPercent', 'NVARCHAR(MAX) NULL')

        # Insert into PastWell table
        cursor.execute("""
            INSERT INTO PastWell (
                OriginalDrillingOperationID, SrNo, RigID, WellID, SpudDate, PresentDepthM, TDM,
        AFEPlanID, MDrld, WeeklyM, ActualRigDaysID, OperationLog, StopCard, LastUpdated,
        FiscalYearPlanID, GeneralNotes, RigNo, WellName, BlockName, Latitude, Longitude, JVPercent,
                DrlgDays, TestDays, DryDays, TestWODays
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
        operation_data[0], operation_data[1], operation_data[2], operation_data[3], operation_data[4],
        operation_data[5], operation_data[6], operation_data[7], operation_data[8], operation_data[9],
        operation_data[10], operation_data[11], operation_data[12], operation_data[13], operation_data[14],
        operation_data[15], operation_data[16], operation_data[17], operation_data[18], operation_data[19], operation_data[20],
        operation_data[21], operation_data[22], operation_data[23], operation_data[24], operation_data[25]
        ))
        
        # Now delete the DrillingOperation
        cursor.execute("DELETE FROM DrillingOperation WHERE DrillingOperationID = ?", (drilling_operation_id,))

        conn.commit()
        return {"success": True, "message": "Well moved to past wells"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@app.get("/past-wells")
def get_past_wells():
    """
    Get all past wells (deleted wells).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # First ensure the table exists
        cursor.execute(
            """
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PastWell]') AND type in (N'U'))
            BEGIN
                CREATE TABLE PastWell (
                    PastWellID INT PRIMARY KEY IDENTITY,
                    OriginalDrillingOperationID INT,
                    SrNo INT,
                    RigID INT,
                    WellID INT,
                    SpudDate DATE,
                    PresentDepthM INT,
                    TDM INT,
                    AFEPlanID INT,
                    MDrld VARCHAR(20),
                    WeeklyM VARCHAR(20),
                    ActualRigDaysID INT,
                    OperationLog NVARCHAR(MAX),
                    StopCard INT,
                    LastUpdated DATETIME,
                    FiscalYearPlanID INT,
                    GeneralNotes NVARCHAR(MAX),
                    RigNo VARCHAR(20),
                    WellName VARCHAR(50),
                    BlockName VARCHAR(50),
                    Latitude FLOAT,
                    Longitude FLOAT,
                    JVPercent NVARCHAR(MAX) NULL,
                    DrlgDays INT,
                    TestDays INT,
                    DryDays INT,
                    TestWODays INT,
                    DeletedAt DATETIME DEFAULT GETDATE()
                )
            END
            """
        )
        ensure_column(cursor, 'PastWell', 'JVPercent', 'NVARCHAR(MAX) NULL')

        cursor.execute(
            """
            SELECT 
                PastWellID, OriginalDrillingOperationID, SrNo, RigNo, WellName, BlockName,
                Latitude, Longitude, SpudDate, PresentDepthM, TDM, JVPercent, DrlgDays, TestDays,
                DryDays, TestWODays, OperationLog, StopCard, LastUpdated, DeletedAt
            FROM PastWell
            ORDER BY DeletedAt DESC
            """
        )

        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    except Exception as e:
        print(f"Error fetching past wells: {e}")
        return []
    finally:
        return_connection(conn)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 