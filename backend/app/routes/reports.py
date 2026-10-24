import psycopg
from fastapi import APIRouter, Depends

from ..database import get_db

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])

@router.get("/monthly-revenue")
def get_monthly_revenue_report(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT month_year, payment_type, payment_method, total_transactions, total_amount
            FROM view_monthly_revenue;
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
            COALESCE(SUM(b.total_amount) FILTER (WHERE b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')), 0) AS total_spend
        FROM customers c
        LEFT JOIN bookings b ON c.customer_id = b.customer_id
        GROUP BY c.customer_id, c.full_name, c.email, c.phone, c.licence_verified
        ORDER BY total_spend DESC, total_bookings DESC;
    """
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()

@router.get("/outstanding-payments")
def get_outstanding_payments_report(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT booking_id, customer_id, customer_name, customer_phone,
                   vehicle_name, registration_no, total_amount, amount_paid,
                   outstanding_balance, booking_status
            FROM view_outstanding_payments;
        """)
        return cur.fetchall()

@router.get("/vehicle-utilization")
def get_vehicle_utilization_report(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT vehicle_id, registration_no, brand, model, current_status,
                   completed_or_active_trips, ROUND(total_days_rented::numeric, 2) AS total_days_rented,
                   maintenance_count, total_maintenance_cost
            FROM view_vehicle_utilization;
        """)
        return cur.fetchall()
