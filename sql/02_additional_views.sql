-- ==============================================================================
-- Vehicle Rental Management System
-- Supplementary Reporting Views (Genuinely useful for reports & analytics)
-- Safe to run: Uses CREATE OR REPLACE VIEW
-- ==============================================================================

-- 1. Monthly Revenue Breakdown View
CREATE OR REPLACE VIEW view_monthly_revenue AS
SELECT 
    TO_CHAR(payment_date, 'YYYY-MM') AS month_year,
    payment_type,
    payment_method,
    COUNT(*) AS total_transactions,
    SUM(amount) AS total_amount
FROM payments
WHERE status = 'SUCCESS'
GROUP BY TO_CHAR(payment_date, 'YYYY-MM'), payment_type, payment_method
ORDER BY month_year DESC;

-- 2. Popular Vehicles View
CREATE OR REPLACE VIEW view_popular_vehicles AS
SELECT 
    v.vehicle_id,
    v.registration_no,
    v.brand,
    v.model,
    vc.category_name,
    COUNT(b.booking_id) AS total_bookings,
    COALESCE(SUM(b.total_amount), 0) AS gross_booking_value,
    COALESCE(AVG(EXTRACT(EPOCH FROM (b.return_at - b.pickup_at)) / 86400.0), 0) AS avg_rental_days
FROM vehicles v
LEFT JOIN vehicle_categories vc ON v.category_id = vc.category_id
LEFT JOIN bookings b ON v.vehicle_id = b.vehicle_id AND b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
GROUP BY v.vehicle_id, v.registration_no, v.brand, v.model, vc.category_name
ORDER BY total_bookings DESC, gross_booking_value DESC;

-- 3. Outstanding Payments View
CREATE OR REPLACE VIEW view_outstanding_payments AS
SELECT 
    b.booking_id,
    b.customer_id,
    c.full_name AS customer_name,
    c.phone AS customer_phone,
    v.brand || ' ' || v.model AS vehicle_name,
    v.registration_no,
    b.total_amount,
    COALESCE(paid.total_paid, 0) AS amount_paid,
    (b.total_amount - COALESCE(paid.total_paid, 0)) AS outstanding_balance,
    b.status AS booking_status
FROM bookings b
JOIN customers c ON b.customer_id = c.customer_id
JOIN vehicles v ON b.vehicle_id = v.vehicle_id
LEFT JOIN (
    SELECT booking_id, SUM(amount) AS total_paid
    FROM payments
    WHERE status = 'SUCCESS'
    GROUP BY booking_id
) paid ON b.booking_id = paid.booking_id
WHERE b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
  AND (b.total_amount - COALESCE(paid.total_paid, 0)) > 0
ORDER BY outstanding_balance DESC;

-- 4. Vehicle Utilization Statistics View
CREATE OR REPLACE VIEW view_vehicle_utilization AS
SELECT 
    v.vehicle_id,
    v.registration_no,
    v.brand,
    v.model,
    v.status AS current_status,
    COUNT(b.booking_id) AS completed_or_active_trips,
    COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.return_at, CURRENT_TIMESTAMP) - b.pickup_at)) / 86400.0), 0) AS total_days_rented,
    COUNT(m.maintenance_id) AS maintenance_count,
    COALESCE(SUM(m.cost), 0) AS total_maintenance_cost
FROM vehicles v
LEFT JOIN bookings b ON v.vehicle_id = b.vehicle_id AND b.status IN ('ACTIVE', 'COMPLETED')
LEFT JOIN maintenance_records m ON v.vehicle_id = m.vehicle_id
GROUP BY v.vehicle_id, v.registration_no, v.brand, v.model, v.status
ORDER BY total_days_rented DESC;
