from fastapi import APIRouter, HTTPException, Body
from typing import Optional, Dict, Any
from .db import get_db_connection, return_connection
from datetime import datetime, timedelta

router = APIRouter()


def ensure_table(cursor):
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


@router.get("/well-daily-progress")
def list_well_daily_progress(wellId: Optional[int] = None, wellName: Optional[str] = None):
    """List WellDailyProgress rows filtered by wellId or wellName (at least one required)."""
    if not wellId and not wellName:
        raise HTTPException(status_code=400, detail="Provide wellId or wellName")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_table(cursor)
        # initial fetch
        if wellId:
            cursor.execute(
                """
                SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                FROM WellDailyProgress
                WHERE WellID = ?
                ORDER BY [Date]
                """,
                (wellId,),
            )
        else:
            cursor.execute(
                """
                SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                FROM WellDailyProgress
                WHERE WellName = ?
                ORDER BY [Date]
                """,
                (wellName,),
            )
        columns = [c[0] for c in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Safety: if Day is not a 0..N-1 sequence in date order, resequence and recompute now
        def _is_sequential(seq_rows):
            try:
                for i, r in enumerate(seq_rows):
                    if int(r.get("Day")) != i:
                        return False
                return True
            except Exception:
                return False
        if rows and not _is_sequential(rows):
            _resequence_days(cursor, wellId, wellName)
            _recompute_progress_chain(cursor, wellId, wellName)
            conn.commit()
            # refetch after fix
            if wellId:
                cursor.execute(
                    """
                    SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                    FROM WellDailyProgress
                    WHERE WellID = ?
                    ORDER BY [Date]
                    """,
                    (wellId,),
                )
            else:
                cursor.execute(
                    """
                    SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                    FROM WellDailyProgress
                    WHERE WellName = ?
                    ORDER BY [Date]
                    """,
                    (wellName,),
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
                        (wellId,),
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
                        (wellName,),
                    )
                meta = cursor.fetchone()
                if meta:
                    w_id, w_name, spud_date, drlg_days = meta
                    try:
                        planned = int(drlg_days) if drlg_days is not None else 0
                    except Exception:
                        planned = 0
                    if planned > 0 and spud_date is not None:
                        dates = _compute_working_dates(spud_date, planned)
                        for i, d in enumerate(dates):
                            cursor.execute(
                                """
                                INSERT INTO WellDailyProgress (WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog)
                                VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)
                                """,
                                (w_id, w_name, d, i),
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
                                (wellId,),
                            )
                        else:
                            cursor.execute(
                                """
                                SELECT WellDailyProgressID, WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog
                                FROM WellDailyProgress
                                WHERE WellName = ?
                                ORDER BY [Date]
                                """,
                                (wellName,),
                            )
                        columns = [c[0] for c in cursor.description]
                        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
            except Exception:
                # If we cannot seed, fall back to empty list silently
                pass
        return rows
    finally:
        return_connection(conn)


def _compute_progress_for_row(cursor, well_id, well_name, date_value, actual_depth):
    """Return progress given current actual_depth and the previous row's actual for same well.
    If no previous row exists, progress == actual_depth.
    """
    if actual_depth is None:
        return None
    # Prefer WellID match; fallback to WellName
    if well_id:
        cursor.execute(
            """
            SELECT TOP 1 ActualDepth
            FROM WellDailyProgress
            WHERE WellID = ? AND [Date] < ?
            ORDER BY [Date] DESC
            """,
            (well_id, date_value),
        )
    else:
        cursor.execute(
            """
            SELECT TOP 1 ActualDepth
            FROM WellDailyProgress
            WHERE WellName = ? AND [Date] < ?
            ORDER BY [Date] DESC
            """,
            (well_name, date_value),
        )
    prev = cursor.fetchone()
    prev_actual = prev[0] if prev else None
    if prev_actual is None:
        return actual_depth
    try:
        return int(actual_depth) - int(prev_actual)
    except Exception:
        return None

def _recompute_progress_chain(cursor, well_id=None, well_name=None):
    """Recalculate Progress for all rows of a well in chronological order.
    Rules:
      - Day 0 or first row with ActualDepth: Progress = ActualDepth
      - If ActualDepth is NULL: Progress = NULL (no reading) and previous actual stays as last known value
      - Otherwise: Progress = current ActualDepth - last known actual
    """
    if not well_id and not well_name:
        return
    if well_id:
        cursor.execute(
            """
            SELECT WellDailyProgressID, [Date], ActualDepth
            FROM WellDailyProgress
            WHERE WellID = ?
            ORDER BY [Date]
            """,
            (well_id,),
        )
    else:
        cursor.execute(
            """
            SELECT WellDailyProgressID, [Date], ActualDepth
            FROM WellDailyProgress
            WHERE WellName = ?
            ORDER BY [Date]
            """,
            (well_name,),
        )
    series = cursor.fetchall()
    prev_actual = None
    for (row_id, _d, act) in series:
        if act is None:
            progress = None
        else:
            try:
                a = int(act)
            except Exception:
                a = None
            if a is None:
                progress = None
            else:
                if prev_actual is None:
                    progress = a
                else:
                    try:
                        progress = a - int(prev_actual)
                    except Exception:
                        progress = None
                prev_actual = a
        cursor.execute(
            "UPDATE WellDailyProgress SET Progress = ? WHERE WellDailyProgressID = ?",
            (progress, row_id),
        )

def _resequence_days(cursor, well_id=None, well_name=None):
    """Ensure Day is a unique 0..N-1 sequence ordered by Date for the given well."""
    if well_id:
        cursor.execute(
            """
            SELECT WellDailyProgressID
            FROM WellDailyProgress
            WHERE WellID = ?
            ORDER BY [Date]
            """,
            (well_id,),
        )
    else:
        cursor.execute(
            """
            SELECT WellDailyProgressID
            FROM WellDailyProgress
            WHERE WellName = ?
            ORDER BY [Date]
            """,
            (well_name,),
        )
    ids = [row[0] for row in cursor.fetchall()]
    for idx, rid in enumerate(ids):
        cursor.execute("UPDATE WellDailyProgress SET [Day] = ? WHERE WellDailyProgressID = ?", (idx, rid))


@router.post("/well-daily-progress")
def create_well_daily_progress(payload: Dict[str, Any] = Body(...)):
    required = ["WellID", "WellName", "Date"]
    for k in required:
        if k not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {k}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_table(cursor)
        # Compute progress if ActualDepth provided
        progress_val = None
        if payload.get("ActualDepth") is not None:
            progress_val = _compute_progress_for_row(
                cursor,
                payload.get("WellID"),
                payload.get("WellName"),
                payload.get("Date"),
                payload.get("ActualDepth"),
            )

        # Insert the new daily progress row
        cursor.execute(
            """
            INSERT INTO WellDailyProgress (WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog)
            OUTPUT INSERTED.WellDailyProgressID
            VALUES (?, ?, COALESCE(?, CAST(GETDATE() AS DATE)), 0, ?, ?, ?, ?)
            """,
            (
                payload["WellID"],
                payload["WellName"],
                payload.get("Date"),
                payload.get("PlannedDepth"),
                payload.get("ActualDepth"),
                progress_val,
                payload.get("OperationLog"),
            ),
        )
        new_id = cursor.fetchone()[0]

        # Touch LastUpdated on DrillingOperation for this well (best-effort)
        try:
            if payload.get("WellID") is not None:
                cursor.execute(
                    "UPDATE DrillingOperation SET LastUpdated = GETDATE() WHERE WellID = ?",
                    (payload.get("WellID"),)
                )
            elif payload.get("WellName"):
                cursor.execute(
                    "UPDATE DrillingOperation SET LastUpdated = GETDATE() WHERE WellID IN (SELECT WellID FROM Well WHERE WellName = ?)",
                    (payload.get("WellName"),)
                )
        except Exception:
            pass

        # Ensure Day sequence and Progress consistency for the well
        _resequence_days(cursor, payload.get("WellID"), payload.get("WellName"))
        _recompute_progress_chain(cursor, payload.get("WellID"), payload.get("WellName"))
        conn.commit()
        return {"WellDailyProgressID": new_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)


@router.patch("/well-daily-progress/{wdp_id}")
def update_well_daily_progress(wdp_id: int, payload: Dict[str, Any] = Body(...)):
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    # Progress and Day are computed automatically; ignore if provided
    allowed = {"WellID", "WellName", "Date", "PlannedDepth", "ActualDepth", "OperationLog"}
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
        ensure_table(cursor)
        cursor.execute(f"UPDATE WellDailyProgress SET {', '.join(sets)} WHERE WellDailyProgressID = ?", params)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Row not found")
        # Resequence Day and recompute Progress chain for the well
        cursor.execute(
            "SELECT WellID, WellName FROM WellDailyProgress WHERE WellDailyProgressID = ?",
            (wdp_id,),
        )
        meta = cursor.fetchone()
        if meta:
            w_id, w_name = meta
            # Touch LastUpdated on DrillingOperation for this well
            try:
                cursor.execute(
                    "UPDATE DrillingOperation SET LastUpdated = GETDATE() WHERE WellID = ?",
                    (w_id,)
                )
            except Exception:
                pass
            _resequence_days(cursor, w_id, w_name)
            _recompute_progress_chain(cursor, w_id, w_name)
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


@router.delete("/well-daily-progress/{wdp_id}")
def delete_well_daily_progress(wdp_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_table(cursor)
        # Get well identifiers before delete
        cursor.execute("SELECT WellID, WellName FROM WellDailyProgress WHERE WellDailyProgressID = ?", (wdp_id,))
        meta = cursor.fetchone()
        cursor.execute("DELETE FROM WellDailyProgress WHERE WellDailyProgressID = ?", (wdp_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Row not found")
        # Resequence and recompute after deletion
        if meta:
            w_id, w_name = meta
            _resequence_days(cursor, w_id, w_name)
            _recompute_progress_chain(cursor, w_id, w_name)
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


def _compute_working_dates(spud_date: Any, count: int):
    # Day 0 = spud date; after that, only Mon-Fri
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
    if count > 0:
        dates.append(sd)
    current = sd
    while len(dates) < count:
        current = current + timedelta(days=1)
        if current.weekday() < 5:  # Mon-Fri
            dates.append(current)
    return dates


@router.post("/well-daily-progress/seed")
def seed_well_daily_progress(wellId: Optional[int] = None, wellName: Optional[str] = None):
    if not wellId and not wellName:
        raise HTTPException(status_code=400, detail="Provide wellId or wellName")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_table(cursor)
        # Fetch spud date and planned drilling days for this well
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
                (wellId,),
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
                (wellName,),
            )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Well or drilling operation not found")
        w_id, w_name, spud_date, drlg_days = row
        try:
            planned = int(drlg_days) if drlg_days is not None else 0
        except Exception:
            planned = 0
        if planned <= 0 or spud_date is None:
            raise HTTPException(status_code=400, detail="Cannot seed: missing spud date or planned drilling days")

        # If rows already exist, do nothing
        cursor.execute(
            "SELECT COUNT(1) FROM WellDailyProgress WHERE WellID = ? OR WellName = ?",
            (w_id, w_name),
        )
        existing = cursor.fetchone()[0]
        if existing > 0:
            return {"seeded": False, "existingRows": existing}

        dates = _compute_working_dates(spud_date, planned)
        for i, d in enumerate(dates):
            cursor.execute(
                """
                INSERT INTO WellDailyProgress (WellID, WellName, [Date], [Day], PlannedDepth, ActualDepth, Progress, OperationLog)
                VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)
                """,
                (w_id, w_name, d, i),
            )
        conn.commit()
        return {"seeded": True, "inserted": len(dates)}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)


@router.post("/well-daily-progress/seed-all")
def seed_all_well_daily_progress():
    conn = get_db_connection()
    cursor = conn.cursor()
    total_seeded = 0
    wells_processed = 0
    try:
        ensure_table(cursor)
        # Find wells with drilling operation and planned days, but no WDP rows yet
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
            dates = _compute_working_dates(spud_date, planned)
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
