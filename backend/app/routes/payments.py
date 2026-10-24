import uuid
from typing import Optional, List
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..schemas import PaymentCreate, PaymentResponse

router = APIRouter(prefix="/api/v1/payments", tags=["Payments"])

@router.get("", response_model=List[PaymentResponse])
def list_payments(
    booking_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    conn: psycopg.Connection = Depends(get_db),
):
    query = """
        SELECT payment_id, booking_id, amount, payment_type, payment_method, status, transaction_reference, payment_date
        FROM payments
        WHERE 1=1
    """
    params = []

    if booking_id is not None:
        query += " AND booking_id = %s"
        params.append(booking_id)

    if status:
        query += " AND status = %s"
        params.append(status.upper())

    query += " ORDER BY payment_id DESC;"

    with conn.cursor() as cur:
        cur.execute(query, tuple(params))
        return cur.fetchall()

@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment(payload: PaymentCreate, conn: psycopg.Connection = Depends(get_db)):
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                # Check booking exists
                cur.execute("SELECT booking_id, status FROM bookings WHERE booking_id = %s FOR SHARE;", (payload.booking_id,))
                booking = cur.fetchone()
                if not booking:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Booking {payload.booking_id} not found")

                ref = payload.transaction_reference
                if not ref or not ref.strip():
                    ref = f"TXN-{uuid.uuid4().hex[:10].upper()}"
                else:
                    ref = ref.strip()

                insert_query = """
                    INSERT INTO payments (booking_id, amount, payment_type, payment_method, status, transaction_reference)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING payment_id, booking_id, amount, payment_type, payment_method, status, transaction_reference, payment_date;
                """
                cur.execute(
                    insert_query,
                    (
                        payload.booking_id,
                        payload.amount,
                        payload.payment_type,
                        payload.payment_method,
                        payload.status,
                        ref,
                    ),
                )
                payment = cur.fetchone()
                return payment

    except psycopg.errors.UniqueViolation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Transaction reference '{payload.transaction_reference}' is already used. Please use a unique reference.",
        )
    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
