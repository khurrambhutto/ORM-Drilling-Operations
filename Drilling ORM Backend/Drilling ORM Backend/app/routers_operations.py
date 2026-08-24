from fastapi import APIRouter, HTTPException, Request, Body, Depends
from datetime import datetime, timedelta
from .db import get_db_connection, return_connection
from .routers_auth import get_current_user

router = APIRouter()

@router.put("/drilling-operations/{operation_id}")
async def update_drilling_operation(operation_id: int, request: Request, user=Depends(get_current_user)):
    if not user.get("IsAdmin"):
        raise HTTPException(status_code=403, detail="Admin only")
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
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
        # Upsert related tables when needed to avoid NULL overwrites
        # AFEPlan: contains planned DrlgDays/TestDays
        afe_plan_id = current[6]
        if ("DrlgDays" in data or "TestDays" in data):
            if not afe_plan_id:
                # Create if missing
                cursor.execute(
                    """
                    INSERT INTO AFEPlan (DrlgDays, TestDays)
                    OUTPUT INSERTED.AFEPlanID
                    VALUES (?, ?)
                    """,
                    (data.get("DrlgDays"), data.get("TestDays"))
                )
                afe_plan_id = cursor.fetchone()[0]
                cursor.execute(
                    "UPDATE DrillingOperation SET AFEPlanID = ? WHERE DrillingOperationID = ?",
                    (afe_plan_id, operation_id)
                )
            else:
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

        # ActualRigDays: contains DryDays/TestWODays
        actual_rig_days_id = current[9]
        if ("DryDays" in data or "TestWODays" in data):
            if not actual_rig_days_id:
                # Create if missing
                cursor.execute(
                    """
                    INSERT INTO ActualRigDays (DryDays, TestWODays)
                    OUTPUT INSERTED.ActualRigDaysID
                    VALUES (?, ?)
                    """,
                    (data.get("DryDays"), data.get("TestWODays"))
                )
                actual_rig_days_id = cursor.fetchone()[0]
                cursor.execute(
                    "UPDATE DrillingOperation SET ActualRigDaysID = ? WHERE DrillingOperationID = ?",
                    (actual_rig_days_id, operation_id)
                )
            else:
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
            data.get("GeneralNotes", current[14] if len(current) > 14 else None),
            datetime.now(),
            operation_id
        ))
        # If JVPercent provided, update on Well table (editable field)
        if "JVPercent" in data:
            # Ensure column exists
            cursor.execute(
                """
                IF NOT EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[Well]') AND name = 'JVPercent'
                )
                BEGIN
                    ALTER TABLE Well ADD JVPercent NVARCHAR(MAX) NULL;
                END
                """
            )
            well_id = current[2]
            cursor.execute("UPDATE Well SET JVPercent = ? WHERE WellID = ?", (data.get("JVPercent"), well_id))
        conn.commit()
        return {"message": "Updated successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

@router.post("/drilling-operations")
async def add_drilling_operation(data: dict = Body(...), user=Depends(get_current_user)):
    if not user.get("IsAdmin"):
        raise HTTPException(status_code=403, detail="Admin only")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:

        # Check for unique WellName before creating (case-insensitive)
        cursor.execute("SELECT WellName FROM Well WHERE LOWER(WellName) = LOWER(?)", data["WellName"])
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Well name '{data['WellName']}' already exists. Please choose a unique well name.")

        cursor.execute("SELECT BlockID FROM Block WHERE BlockName = ?", data["BlockName"])
        block = cursor.fetchone()
        if block:
            block_id = block[0]
        else:
            cursor.execute("INSERT INTO Block (BlockName) OUTPUT INSERTED.BlockID VALUES (?)", data["BlockName"])
            block_id = cursor.fetchone()[0]

        # Ensure Well has JVPercent column
        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[dbo].[Well]') AND name = 'JVPercent'
            )
            BEGIN
                ALTER TABLE Well ADD JVPercent NVARCHAR(MAX) NULL;
            END
            """
        )
        # Now safe to insert Well (with JVPercent)
        cursor.execute("INSERT INTO Well (WellName, BlockID, Latitude, Longitude, JVPercent) OUTPUT INSERTED.WellID VALUES (?, ?, ?, ?, ?)",
                     (data["WellName"], block_id, data.get("Latitude"), data.get("Longitude"), data.get("JVPercent")))
        well_id = cursor.fetchone()[0]
        cursor.execute("SELECT RigID FROM Rig WHERE RigNo = ?", data["RigName"])
        rig = cursor.fetchone()
        if rig:
            rig_id = rig[0]
        else:
            cursor.execute("INSERT INTO Rig (RigNo) OUTPUT INSERTED.RigID VALUES (?)", data["RigName"])
            rig_id = cursor.fetchone()[0]
        afe_plan_id = None
        if data.get("PlannedAFEDaysDrilling") or data.get("PlannedAFEDaysTesting"):
            cursor.execute("""
                INSERT INTO AFEPlan (DrlgDays, TestDays) 
                OUTPUT INSERTED.AFEPlanID 
                VALUES (?, ?)
            """, (data.get("PlannedAFEDaysDrilling"), data.get("PlannedAFEDaysTesting")))
            afe_plan_id = cursor.fetchone()[0]
        actual_rig_days_id = None
        cursor.execute("""
            INSERT INTO ActualRigDays (DryDays, TestWODays) 
            OUTPUT INSERTED.ActualRigDaysID 
            VALUES (NULL, NULL)
        """)
        actual_rig_days_id = cursor.fetchone()[0]
        cursor.execute("SELECT ISNULL(MAX(SrNo), 0) + 1 FROM DrillingOperation")
        next_sr_no = cursor.fetchone()[0]
        # Ensure the table has GeneralNotes column
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
        cursor.execute("""
            INSERT INTO DrillingOperation (
                SrNo, RigID, WellID, SpudDate, PresentDepthM, TDM, AFEPlanID, 
                MDrld, WeeklyM, ActualRigDaysID, OperationLog, StopCard, LastUpdated, GeneralNotes
            )
            OUTPUT INSERTED.DrillingOperationID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            "Well under Drilling. Initial setup completed.",
            0,
            datetime.now(),
            data.get("GeneralNotes")
        ))
        drilling_operation_id = cursor.fetchone()[0]

        # Auto-seed WellDailyProgress rows based on planned drilling days starting from SpudDate
        spud_date = data.get("SpudDate")
        # Prefer explicit planned days; if not provided, fallback to MDrld coming from the payload (if any)
        planned_days_raw = data.get("PlannedAFEDaysDrilling") or data.get("MDrld")
        try:
            planned_days = int(planned_days_raw) if planned_days_raw is not None else None
        except Exception:
            planned_days = None
        if spud_date and planned_days and planned_days > 0:
            # Ensure table exists (idempotent)
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
            # Seed only if none exist yet for this well
            cursor.execute(
                "SELECT COUNT(1) FROM WellDailyProgress WHERE WellID = ? OR WellName = ?",
                (well_id, data["WellName"]),
            )
            existing = cursor.fetchone()[0]
            if existing == 0:
                # Build dates: Day 0 = spud_date; after that only Mon-Fri working days
                try:
                    # Normalize spud_date to date
                    if isinstance(spud_date, str):
                        sd = datetime.fromisoformat(spud_date).date()
                    elif isinstance(spud_date, datetime):
                        sd = spud_date.date()
                    else:
                        # Assume date-like
                        sd = spud_date
                except Exception:
                    sd = datetime.now().date()

                dates = []
                if planned_days > 0:
                    dates.append(sd)
                current = sd
                while len(dates) < planned_days:
                    current = current + timedelta(days=1)
                    # weekday(): Mon=0 .. Sun=6
                    if current.weekday() < 5:
                        dates.append(current)

                # Insert rows with Day 0..N-1 and corresponding dates
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
        conn.commit()
        return {"success": True, "DrillingOperationID": drilling_operation_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)

@router.delete("/drilling-operations/{drilling_operation_id}")
async def delete_drilling_operation(drilling_operation_id: int, user=Depends(get_current_user)):
    if not user.get("IsAdmin"):
        raise HTTPException(status_code=403, detail="Admin only")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Mark associated Well as inactive instead of moving data
        cursor.execute("SELECT WellID FROM DrillingOperation WHERE DrillingOperationID = ?", (drilling_operation_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Drilling operation not found")
        well_id = row[0]
        # Ensure IsActive and DeactivatedAt columns exist
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
        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[dbo].[Well]') AND name = 'DeactivatedAt'
            )
            BEGIN
                ALTER TABLE Well ADD DeactivatedAt DATETIME NULL;
            END
            """
        )
        cursor.execute("UPDATE Well SET IsActive = 0, DeactivatedAt = GETDATE() WHERE WellID = ?", (well_id,))
        conn.commit()
        return {"success": True, "message": "Well marked as inactive"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)
