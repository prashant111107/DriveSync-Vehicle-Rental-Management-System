import psycopg
from fastapi import APIRouter, Depends

from ..database import get_db

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'AVAILABLE') AS available,
                COUNT(*) FILTER (WHERE status = 'MAINTENANCE') AS maintenance,
                COUNT(*) FILTER (WHERE status = 'INACTIVE') AS inactive,
                (
                    SELECT COUNT(DISTINCT vehicle_id)
                    FROM bookings
                    WHERE status = 'ACTIVE'
                ) AS rented
            FROM vehicles;
        """)
        veh_stats = cur.fetchone()

        cur.execute("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
                COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS confirmed,
                COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active,
                COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
                COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
                COUNT(*) FILTER (
                    WHERE status = 'ACTIVE' AND return_at < CURRENT_TIMESTAMP
                ) AS overdue
            FROM bookings;
        """)
        booking_stats = cur.fetchone()

        cur.execute("""
            SELECT
                COALESCE(SUM(amount) FILTER (
                    WHERE status = 'SUCCESS' AND payment_type IN ('RENTAL', 'LATE_FEE', 'DAMAGE')
                ), 0)
                - COALESCE(SUM(amount) FILTER (
                    WHERE status = 'SUCCESS' AND payment_type = 'REFUND'
                ), 0) AS total_revenue,
                COALESCE(SUM(amount) FILTER (
                    WHERE status = 'SUCCESS' AND payment_type = 'RENTAL'
                ), 0) AS rental_revenue,
                COALESCE(SUM(amount) FILTER (
                    WHERE status = 'SUCCESS' AND payment_type IN ('LATE_FEE', 'DAMAGE')
                ), 0) AS fee_revenue,
                COALESCE(SUM(amount) FILTER (
                    WHERE status = 'PENDING'
                ), 0) AS pending_revenue,
                COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
                COALESCE(SUM(amount) FILTER (
                    WHERE status = 'SUCCESS' AND payment_type = 'DEPOSIT'
                ), 0) AS deposits_held
            FROM payments;
        """)
        revenue_stats = cur.fetchone()

        cur.execute("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE licence_verified = TRUE) AS verified,
                COUNT(*) FILTER (WHERE licence_verified = FALSE) AS unverified
            FROM customers;
        """)
        cust_stats = cur.fetchone()

        cur.execute("""
            SELECT COUNT(*) AS total
            FROM maintenance_records
            WHERE status IN ('SCHEDULED', 'IN_PROGRESS');
        """)
        maintenance_stats = cur.fetchone()

        cur.execute("""
            SELECT
                b.booking_id,
                c.full_name AS customer_name,
                v.brand || ' ' || v.model AS vehicle_name,
                v.registration_no,
                b.return_at,
                CURRENT_TIMESTAMP - b.return_at AS overdue_by
            FROM bookings b
            JOIN customers c ON b.customer_id = c.customer_id
            JOIN vehicles v ON b.vehicle_id = v.vehicle_id
            WHERE b.status = 'ACTIVE' AND b.return_at < CURRENT_TIMESTAMP
            ORDER BY b.return_at ASC;
        """)
        overdue_returns = cur.fetchall()

        cur.execute("""
            SELECT
                m.maintenance_id,
                m.vehicle_id,
                v.brand || ' ' || v.model AS vehicle_name,
                v.registration_no,
                m.description,
                m.start_at,
                m.status
            FROM maintenance_records m
            JOIN vehicles v ON v.vehicle_id = m.vehicle_id
            WHERE m.status IN ('SCHEDULED', 'IN_PROGRESS')
            ORDER BY
                CASE m.status WHEN 'IN_PROGRESS' THEN 0 ELSE 1 END,
                m.start_at ASC
            LIMIT 10;
        """)
        maintenance_alerts = cur.fetchall()

        cur.execute("""
            SELECT
                b.booking_id,
                c.full_name AS customer_name,
                v.brand || ' ' || v.model AS vehicle_name,
                b.pickup_at,
                b.return_at,
                b.total_amount,
                b.status
            FROM bookings b
            JOIN customers c ON b.customer_id = c.customer_id
            JOIN vehicles v ON b.vehicle_id = v.vehicle_id
            ORDER BY b.created_at DESC
            LIMIT 5;
        """)
        recent_bookings = cur.fetchall()

        cur.execute("""
            SELECT
                p.payment_id,
                p.booking_id,
                p.amount,
                p.payment_type,
                p.payment_method,
                p.status,
                p.transaction_reference,
                p.payment_date
            FROM payments p
            ORDER BY p.payment_date DESC
            LIMIT 5;
        """)
        recent_payments = cur.fetchall()

        return {
            "vehicles": veh_stats,
            "bookings": booking_stats,
            "revenue": revenue_stats,
            "customers": cust_stats,
            "maintenance": maintenance_stats,
            "overdue_returns": overdue_returns,
            "maintenance_alerts": maintenance_alerts,
            "recent_bookings": recent_bookings,
            "recent_payments": recent_payments,
        }
