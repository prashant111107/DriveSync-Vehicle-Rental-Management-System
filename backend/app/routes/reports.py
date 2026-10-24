import psycopg
from fastapi import APIRouter, Depends

from ..database import get_db

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])

@router.get("/monthly-revenue")
def get_monthly_revenue_report(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                TO_CHAR(payment_date, 'YYYY-MM') AS month_year,
                payment_type,
                payment_method,
                COUNT(*) AS total_transactions,
                SUM(CASE WHEN payment_type = 'REFUND' THEN -amount ELSE amount END) AS total_amount
            FROM payments
            WHERE status = 'SUCCESS'
            GROUP BY TO_CHAR(payment_date, 'YYYY-MM'), payment_type, payment_method
            ORDER BY month_year DESC;
        """)
        return cur.fetchall()

@router.get("/popular-vehicles")
def get_popular_vehicles_report(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT vehicle_id, registration_no, brand, model, category_name,
                   total_bookings, gross_booking_value, ROUND(avg_rental_days::numeric, 2) AS avg_rental_days
            FROM view_popular_vehicles;
        """)
        return cur.fetchall()

@router.get("/customer-history")
def get_customer_history_report(conn: psycopg.Connection = Depends(get_db)):
    query = """
        SELECT 
            c.customer_id,
            c.full_name,
            c.email,
            c.phone,
            c.licence_verified,
            COUNT(b.booking_id) AS total_bookings,
            COUNT(b.booking_id) FILTER (WHERE b.status = 'COMPLETED') AS completed_trips,
            COUNT(b.booking_id) FILTER (WHERE b.status = 'CANCELLED') AS cancelled_trips,
            COALESCE(paid.total_spend, 0) AS total_spend
        FROM customers c
        LEFT JOIN bookings b ON c.customer_id = b.customer_id
        LEFT JOIN (
            SELECT b.customer_id,
                   SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END) AS total_spend
            FROM bookings b
            JOIN payments p ON p.booking_id = b.booking_id
            WHERE p.status = 'SUCCESS' AND p.payment_type <> 'DEPOSIT'
            GROUP BY b.customer_id
        ) paid ON paid.customer_id = c.customer_id
        GROUP BY c.customer_id, c.full_name, c.email, c.phone, c.licence_verified, paid.total_spend
        ORDER BY total_spend DESC, total_bookings DESC;
    """
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()

@router.get("/outstanding-payments")
def get_outstanding_payments_report(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            WITH applied_payments AS (
                SELECT booking_id,
                       SUM(CASE WHEN payment_type = 'REFUND' THEN -amount ELSE amount END) AS amount_paid
                FROM payments
                WHERE status = 'SUCCESS' AND payment_type <> 'DEPOSIT'
                GROUP BY booking_id
            ),
            return_fees AS (
                SELECT booking_id, SUM(late_fee + damage_fee) AS fees_due
                FROM rental_returns
                GROUP BY booking_id
            )
            SELECT b.booking_id, b.customer_id, c.full_name AS customer_name,
                   c.phone AS customer_phone, v.brand || ' ' || v.model AS vehicle_name,
                   v.registration_no, b.total_amount,
                   COALESCE(p.amount_paid, 0) AS amount_paid,
                   b.total_amount + COALESCE(r.fees_due, 0) - COALESCE(p.amount_paid, 0)
                       AS outstanding_balance,
                   b.status AS booking_status
            FROM bookings b
            JOIN customers c ON c.customer_id = b.customer_id
            JOIN vehicles v ON v.vehicle_id = b.vehicle_id
            LEFT JOIN applied_payments p ON p.booking_id = b.booking_id
            LEFT JOIN return_fees r ON r.booking_id = b.booking_id
            WHERE b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
              AND b.total_amount + COALESCE(r.fees_due, 0) - COALESCE(p.amount_paid, 0) > 0
            ORDER BY outstanding_balance DESC;
        """)
        return cur.fetchall()

@router.get("/vehicle-utilization")
def get_vehicle_utilization_report(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            WITH rental_stats AS (
                SELECT vehicle_id,
                       COUNT(*) AS completed_or_active_trips,
                       SUM(EXTRACT(EPOCH FROM
                           (LEAST(return_at, CURRENT_TIMESTAMP) - pickup_at)) / 86400.0)
                           AS total_days_rented
                FROM bookings
                WHERE status IN ('ACTIVE', 'COMPLETED')
                GROUP BY vehicle_id
            ),
            maintenance_stats AS (
                SELECT vehicle_id, COUNT(*) AS maintenance_count, SUM(cost) AS total_maintenance_cost
                FROM maintenance_records
                GROUP BY vehicle_id
            )
            SELECT v.vehicle_id, v.registration_no, v.brand, v.model,
                   v.status AS current_status,
                   COALESCE(r.completed_or_active_trips, 0) AS completed_or_active_trips,
                   ROUND(COALESCE(r.total_days_rented, 0)::numeric, 2) AS total_days_rented,
                   COALESCE(m.maintenance_count, 0) AS maintenance_count,
                   COALESCE(m.total_maintenance_cost, 0) AS total_maintenance_cost
            FROM vehicles v
            LEFT JOIN rental_stats r ON r.vehicle_id = v.vehicle_id
            LEFT JOIN maintenance_stats m ON m.vehicle_id = v.vehicle_id
            ORDER BY total_days_rented DESC;
        """)
        return cur.fetchall()
