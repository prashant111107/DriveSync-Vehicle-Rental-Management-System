from typing import Optional, List
from datetime import datetime, timezone
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..schemas import ReturnCreate, ReturnResponse

router = APIRouter(prefix="/api/v1/returns", tags=["Returns"])

@router.get("", response_model=List[ReturnResponse])
def list_returns(
    booking_id: Optional[int] = Query(None),
    conn: psycopg.Connection = Depends(get_db),
):
    query = """
        SELECT return_id, booking_id, actual_return_at, odometer_start, odometer_end,
               fuel_level, damage_notes, late_fee, damage_fee
        FROM rental_returns
        WHERE 1=1
    """
    params = []
    if booking_id is not None:
        query += " AND booking_id = %s"
        params.append(booking_id)

    query += " ORDER BY actual_return_at DESC;"

    with conn.cursor() as cur:
        cur.execute(query, tuple(params))
        return cur.fetchall()

@router.get("/{booking_id}", response_model=ReturnResponse)
def get_return_by_booking(booking_id: int, conn: psycopg.Connection = Depends(get_db)):
    query = """
        SELECT return_id, booking_id, actual_return_at, odometer_start, odometer_end,
               fuel_level, damage_notes, late_fee, damage_fee
        FROM rental_returns
        WHERE booking_id = %s;
    """
    with conn.cursor() as cur:
        cur.execute(query, (booking_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No return record found for booking {booking_id}")
        return row

@router.post("", response_model=ReturnResponse, status_code=status.HTTP_201_CREATED)
def record_vehicle_return(payload: ReturnCreate, conn: psycopg.Connection = Depends(get_db)):
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                # 1. Fetch booking with lock
                cur.execute("""
                    SELECT b.booking_id, b.vehicle_id, b.status
                    FROM bookings b
                    WHERE b.booking_id = %s
                    FOR UPDATE;
                """, (payload.booking_id,))
                booking = cur.fetchone()
                if not booking:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Booking {payload.booking_id} not found")

                if booking["status"] != "ACTIVE":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot record return for booking in status '{booking['status']}'. The vehicle must be handed over before it can be returned.",
                    )

                # Check if return already recorded
                cur.execute("SELECT return_id FROM rental_returns WHERE booking_id = %s;", (payload.booking_id,))
                if cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Return inspection already recorded for booking {payload.booking_id}.",
                    )

                # 2. Insert into rental_returns
                actual_at = payload.actual_return_at or datetime.now(timezone.utc)
                if actual_at.tzinfo is None or actual_at.utcoffset() is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Actual return time must include a timezone.",
                    )
                if actual_at < booking["pickup_at"] or actual_at > datetime.now(timezone.utc):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Actual return time must be between the scheduled pickup and the current time.",
                    )
                insert_query = """
                    INSERT INTO rental_returns (
                        booking_id, actual_return_at, odometer_start, odometer_end,
                        fuel_level, damage_notes, late_fee, damage_fee
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING return_id, booking_id, actual_return_at, odometer_start, odometer_end,
                              fuel_level, damage_notes, late_fee, damage_fee;
                """
                cur.execute(
                    insert_query,
                    (
                        payload.booking_id,
                        actual_at,
                        payload.odometer_start,
                        payload.odometer_end,
                        payload.fuel_level,
                        payload.damage_notes,
                        payload.late_fee,
                        payload.damage_fee,
                    ),
                )
                ret_record = cur.fetchone()

                # 3. Complete booking (PostgreSQL trigger logs transition from ACTIVE to COMPLETED)
                cur.execute("""
                    UPDATE bookings 
                    SET status = 'COMPLETED' 
                    WHERE booking_id = %s;
                """, (payload.booking_id,))

                # 4. Set vehicle back to AVAILABLE
                cur.execute("""
                    UPDATE vehicles
                    SET status = CASE
                        WHEN EXISTS (
                            SELECT 1 FROM maintenance_records
                            WHERE vehicle_id = %s AND status = 'IN_PROGRESS'
                        ) THEN 'MAINTENANCE'
                        ELSE 'AVAILABLE'
                    END
                    WHERE vehicle_id = %s;
                """, (booking["vehicle_id"], booking["vehicle_id"]))

                # Update history note if fees exist
                fee_summary = []
                if payload.late_fee > 0:
                    fee_summary.append(f"Late fee: ₹{payload.late_fee}")
                if payload.damage_fee > 0:
                    fee_summary.append(f"Damage fee: ₹{payload.damage_fee}")

                if fee_summary:
                    note = "Return processed. " + ", ".join(fee_summary)
                    cur.execute("""
                        UPDATE booking_status_history
                        SET note = %s
                        WHERE history_id = (
                            SELECT history_id FROM booking_status_history 
                            WHERE booking_id = %s 
                            ORDER BY history_id DESC LIMIT 1
                        );
                    """, (note, payload.booking_id))

                return ret_record

    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
