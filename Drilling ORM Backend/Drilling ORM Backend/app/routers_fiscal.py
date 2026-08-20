from fastapi import APIRouter, HTTPException, Request, Body
from .db import get_db_connection, return_connection

router = APIRouter()

@router.put("/fiscal-year-plans/{plan_id}")
async def update_fiscal_year_plan(plan_id: int, request: Request):
    data = await request.json()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE FiscalYearPlan
            SET WellName = ?, WellDepth = ?, PlanDetails = ?
            WHERE FiscalYearPlanID = ?
        """, (data.get("WellName"), data.get("WellDepth"), data.get("PlanDetails"), plan_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        return_connection(conn)
    return {"message": "Fiscal year plan updated successfully"}
