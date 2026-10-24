import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..schemas import (
    BookingCreate,
    BookingStatusUpdate,
    BookingResponse,
    StatusHistoryResponse,
)

router = APIRouter(prefix="/api/v1/bookings", tags=["Bookings"])

VALID_TRANSITIONS = {
    "PENDING": ["CONFIRMED", "CANCELLED"],
    "CONFIRMED": ["ACTIVE", "CANCELLED"],
    "ACTIVE": [],
    "COMPLETED": [],
    "CANCELLED": [],
}

def calculate_duration_and_price(pickup_at, return_at, daily_rate: Decimal):
    total_seconds = (return_at - pickup_at).total_seconds()
    if total_seconds <= 0:
        raise ValueError("Return date/time must be strictly after pickup date/time.")
    # Standard practice: ceil to next full day, minimum 1 day
    days = max(1, math.ceil(total_seconds / 86400.0))
    total_amount = daily_rate * Decimal(days)
    return days, total_amount

@router.get("", response_model=List[BookingResponse])
def list_bookings(
    customer_id: Optional[int] = Query(None),
    vehicle_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    conn: psycopg.Connection = Depends(get_db),
):
    query = """
        SELECT 
            b.booking_id,
            b.customer_id,
            b.vehicle_id,
            b.pickup_at,
            b.return_at,
            b.daily_rate_at_booking,
            b.total_amount,
            b.status,
            b.created_at,
            c.full_name AS customer_name,
            c.phone AS customer_phone,
            c.email AS customer_email,
            c.licence_verified,
            v.brand,
            v.model,
            v.registration_no,
            vc.category_name
        FROM bookings b
        JOIN customers c ON b.customer_id = c.customer_id
        JOIN vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN vehicle_categories vc ON v.category_id = vc.category_id
        WHERE 1=1
    """
    params = []

    if customer_id is not None:
        query += " AND b.customer_id = %s"
        params.append(customer_id)

    if vehicle_id is not None:
        query += " AND b.vehicle_id = %s"
        params.append(vehicle_id)

    if status:
        query += " AND b.status = %s"
        params.append(status.upper())

    query += " ORDER BY b.booking_id DESC;"

    with conn.cursor() as cur:
        cur.execute(query, tuple(params))
        return cur.fetchall()

@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(booking_id: int, conn: psycopg.Connection = Depends(get_db)):
    query = """
        SELECT 
            b.booking_id,
            b.customer_id,
            b.vehicle_id,
            b.pickup_at,
            b.return_at,
            b.daily_rate_at_booking,
            b.total_amount,
            b.status,
            b.created_at,
            c.full_name AS customer_name,
            c.phone AS customer_phone,
            c.email AS customer_email,
            c.licence_verified,
            v.brand,
            v.model,
            v.registration_no,
            vc.category_name
        FROM bookings b
        JOIN customers c ON b.customer_id = c.customer_id
        JOIN vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN vehicle_categories vc ON v.category_id = vc.category_id
        WHERE b.booking_id = %s;
    """
    with conn.cursor() as cur:
        cur.execute(query, (booking_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Booking {booking_id} not found")
        return row

@router.get("/{booking_id}/history", response_model=List[StatusHistoryResponse])
def get_booking_history(booking_id: int, conn: psycopg.Connection = Depends(get_db)):
    query = """
        SELECT history_id, booking_id, old_status, new_status, changed_at, note
        FROM booking_status_history
        WHERE booking_id = %s
        ORDER BY changed_at ASC, history_id ASC;
    """
    with conn.cursor() as cur:
        cur.execute(query, (booking_id,))
        return cur.fetchall()

@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, conn: psycopg.Connection = Depends(get_db)):
    if payload.return_at <= payload.pickup_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Return date/time must be strictly after pickup date/time.",
        )

    try:
        with conn.transaction():
            with conn.cursor() as cur:
                # 1. Check customer exists & lock customer row
                cur.execute("SELECT customer_id, full_name, email, phone, licence_verified FROM customers WHERE customer_id = %s FOR SHARE;", (payload.customer_id,))
                cust = cur.fetchone()
                if not cust:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Customer {payload.customer_id} not found")

                # 2. Check vehicle exists & lock vehicle row to serialize concurrent booking attempts
                cur.execute("""
                    SELECT v.vehicle_id, v.daily_rate, v.status, v.brand, v.model, v.registration_no, vc.category_name
                    FROM vehicles v
                    JOIN vehicle_categories vc ON v.category_id = vc.category_id
                    WHERE v.vehicle_id = %s
                    FOR UPDATE;
                """, (payload.vehicle_id,))
                veh = cur.fetchone()
                if not veh:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle {payload.vehicle_id} not found")

                if veh["status"] != "AVAILABLE":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Vehicle {veh['brand']} {veh['model']} is currently {veh['status']} and cannot be booked.",
                    )

                # 3. Calculate consistent duration and total amount
                _, total_amount = calculate_duration_and_price(payload.pickup_at, payload.return_at, veh["daily_rate"])

                # 4. Insert booking with initial status PENDING
                insert_query = """
                    INSERT INTO bookings (
                        customer_id, vehicle_id, pickup_at, return_at,
                        daily_rate_at_booking, total_amount, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, 'PENDING')
                    RETURNING booking_id, customer_id, vehicle_id, pickup_at, return_at,
                              daily_rate_at_booking, total_amount, status, created_at;
                """
                cur.execute(
                    insert_query,
                    (
                        payload.customer_id,
                        payload.vehicle_id,
                        payload.pickup_at,
                        payload.return_at,
                        veh["daily_rate"],
                        total_amount,
                    ),
                )
                booking = cur.fetchone()
                booking["customer_name"] = cust["full_name"]
                booking["customer_phone"] = cust["phone"]
                booking["customer_email"] = cust["email"]
                booking["licence_verified"] = cust["licence_verified"]
                booking["brand"] = veh["brand"]
                booking["model"] = veh["model"]
                booking["registration_no"] = veh["registration_no"]
                booking["category_name"] = veh["category_name"]
                return booking

    except psycopg.errors.ExclusionViolation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict: This vehicle already has an active or overlapping reservation for the requested time range. Please choose a different vehicle or time window.",
        )
    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.patch("/{booking_id}/status", response_model=BookingResponse)
def update_booking_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    conn: psycopg.Connection = Depends(get_db),
):
    target_status = payload.status.upper()
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT b.*, c.full_name, c.phone, c.email, c.licence_verified,
                           v.brand, v.model, v.registration_no, vc.category_name
                    FROM bookings b
                    JOIN customers c ON b.customer_id = c.customer_id
                    JOIN vehicles v ON b.vehicle_id = v.vehicle_id
                    JOIN vehicle_categories vc ON v.category_id = vc.category_id
                    WHERE b.booking_id = %s
                    FOR UPDATE;
                """, (booking_id,))
                current = cur.fetchone()
                if not current:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Booking {booking_id} not found")

                current_status = current["status"]

                if current_status == target_status:
                    return current

                allowed = VALID_TRANSITIONS.get(current_status, [])
                if target_status not in allowed:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid status transition from {current_status} to {target_status}. Allowed transitions from {current_status}: {allowed}",
                    )

                # ENFORCE DRIVING LICENCE VERIFICATION BEFORE ACCEPTING/CONFIRMING A BOOKING
                if target_status in ("CONFIRMED", "ACTIVE"):
                    if not current["licence_verified"]:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Cannot accept or confirm booking: Customer's driving licence has not been verified yet. An administrator must verify the licence first.",
                        )
                if target_status == "ACTIVE":
                    now = datetime.now(timezone.utc)
                    if current["pickup_at"] > now or current["return_at"] <= now:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="The booking is outside its scheduled rental period and cannot be handed over.",
                        )
                    cur.execute(
                        "SELECT status FROM vehicles WHERE vehicle_id = %s FOR UPDATE;",
                        (current["vehicle_id"],),
                    )
                    vehicle = cur.fetchone()
                    if vehicle["status"] != "AVAILABLE":
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="The vehicle is not available for handover.",
                        )

                # Perform status update (PostgreSQL trigger will log to booking_status_history)
                cur.execute("""
                    UPDATE bookings 
                    SET status = %s 
                    WHERE booking_id = %s 
                    RETURNING *;
                """, (target_status, booking_id))
                updated = cur.fetchone()

                # If a note was provided, update the latest status history row with the note
                if payload.note:
                    cur.execute("""
                        UPDATE booking_status_history
                        SET note = %s
                        WHERE history_id = (
                            SELECT history_id FROM booking_status_history 
                            WHERE booking_id = %s 
                            ORDER BY history_id DESC LIMIT 1
                        );
                    """, (payload.note.strip(), booking_id))

                updated["customer_name"] = current["full_name"]
                updated["customer_phone"] = current["phone"]
                updated["customer_email"] = current["email"]
                updated["licence_verified"] = current["licence_verified"]
                updated["brand"] = current["brand"]
                updated["model"] = current["model"]
                updated["registration_no"] = current["registration_no"]
                updated["category_name"] = current["category_name"]
                return updated

    except psycopg.errors.ExclusionViolation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict: Overlapping active reservation prevents this status update.",
        )
    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: int,
    note: Optional[str] = Query(None),
    conn: psycopg.Connection = Depends(get_db),
):
    update_payload = BookingStatusUpdate(status="CANCELLED", note=note or "Booking cancelled by user/admin")
    return update_booking_status(booking_id, update_payload, conn)
