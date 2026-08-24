from fastapi import APIRouter, HTTPException, Depends
from .db import get_db_connection, return_connection
from .routers_auth import get_current_user

router = APIRouter()

@router.get("/past-wells")
def get_past_wells(user=Depends(get_current_user)):
    """Return wells marked as inactive with basic info for the Past Wells page."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Ensure IsActive column exists
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
        # Ensure DeactivatedAt column exists
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
        # Return a dataset similar to previous PastWell, sourced from current tables
        cursor.execute(
            """
            SELECT 
                w.WellID AS PastWellID,
                do.DrillingOperationID AS OriginalDrillingOperationID,
                do.SrNo,
                r.RigNo,
                w.WellName,
                b.BlockName,
                w.Latitude,
                w.Longitude,
                w.JVPercent,
                do.SpudDate,
                do.PresentDepthM,
                do.TDM,
                ap.DrlgDays,
                ap.TestDays,
                ar.DryDays,
                ar.TestWODays,
                do.OperationLog,
                do.StopCard,
                do.LastUpdated,
                w.DeactivatedAt AS DeletedAt
            FROM Well w
            JOIN Block b ON w.BlockID = b.BlockID
            LEFT JOIN DrillingOperation do ON do.WellID = w.WellID
            LEFT JOIN Rig r ON do.RigID = r.RigID
            LEFT JOIN AFEPlan ap ON do.AFEPlanID = ap.AFEPlanID
            LEFT JOIN ActualRigDays ar ON do.ActualRigDaysID = ar.ActualRigDaysID
            WHERE ISNULL(w.IsActive, 1) = 0
            ORDER BY ISNULL(w.DeactivatedAt, GETDATE()) DESC
            """
        )
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
    except Exception:
        return []
    finally:
        return_connection(conn)

@router.patch("/wells/{well_id}/activate")
def activate_well(well_id: int, user=Depends(get_current_user)):
    if not user.get("IsAdmin"):
        raise HTTPException(status_code=403, detail="Admin only")
    """Mark a well active again and clear DeactivatedAt."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Ensure columns
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
        # Reactivate
        cursor.execute("UPDATE Well SET IsActive = 1, DeactivatedAt = NULL WHERE WellID = ?", (well_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Well not found")
        conn.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        return_connection(conn)
