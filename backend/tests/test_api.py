from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4
import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from backend.app.config import DATABASE_CONN_INFO, DB_NAME
from backend.app.database import get_db
from backend.app.main import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def rollback_database_changes():
    connection = psycopg.connect(**DATABASE_CONN_INFO, row_factory=dict_row)
    with connection as conn:
        conn.execute("SELECT 1")
        database_name = conn.execute("SELECT current_database()").fetchone()["current_database"]
        if database_name != DB_NAME:
            raise RuntimeError(f"Tests must connect to configured database {DB_NAME!r}, got {database_name!r}.")

        def get_test_connection():
            yield conn

        app.dependency_overrides[get_db] = get_test_connection
        try:
            yield
        finally:
            conn.rollback()
            app.dependency_overrides.pop(get_db, None)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"

def test_categories_and_vehicles():
    # 1. Categories
    cat_resp = client.get("/api/v1/vehicles/categories")
    assert cat_resp.status_code == 200
    categories = cat_resp.json()
    assert len(categories) >= 3
    cat_names = [c["category_name"] for c in categories]
    assert "Hatchback" in cat_names
    assert "SUV" in cat_names
    assert "Bike" in cat_names

    # 2. Vehicles
    veh_resp = client.get("/api/v1/vehicles")
    assert veh_resp.status_code == 200
    vehicles = veh_resp.json()
    assert len(vehicles) >= 3
    regs = [v["registration_no"] for v in vehicles]
    assert "MH01AB1001" in regs

def test_customer_registration_and_duplicate():
    token = uuid4().hex
    payload = {
        "full_name": "Priya Sharma",
        "email": f"priya.{token}@example.com",
        "phone": str(10_000_000 + int(token[:7], 16) % 90_000_000),
        "licence_number": f"TEST-{token.upper()}",
    }
    resp = client.post("/api/v1/customers", json=payload)
    assert resp.status_code == 201
    assert resp.json()["licence_verified"] is False
    dup_resp = client.post("/api/v1/customers", json=payload)
    assert dup_resp.status_code == 409

def test_booking_invalid_dates():
    now = datetime.now(timezone.utc)
    # return_at earlier than pickup_at
    payload = {
        "customer_id": 1,
        "vehicle_id": 2,
        "pickup_at": (now + timedelta(days=5)).isoformat(),
        "return_at": (now + timedelta(days=2)).isoformat(),
    }
    response = client.post("/api/v1/bookings", json=payload)
    assert response.status_code in (400, 422)
    assert "strictly after" in str(response.json()["detail"]).lower()

def test_booking_unverified_licence_enforcement():
    now = datetime.now(timezone.utc)
    token = uuid4().hex
    customer_resp = client.post(
        "/api/v1/customers",
        json={
            "full_name": "Unverified Test Customer",
            "email": f"unverified.{token}@example.com",
            "phone": str(10_000_000 + int(token[:7], 16) % 90_000_000),
            "licence_number": f"TEST-{token.upper()}",
        },
    )
    assert customer_resp.status_code == 201
    pickup = (now + timedelta(days=3650)).isoformat()
    return_date = (now + timedelta(days=3652)).isoformat()

    # Create pending booking
    create_resp = client.post(
        "/api/v1/bookings",
        json={
            "customer_id": customer_resp.json()["customer_id"],
            "vehicle_id": 3,
            "pickup_at": pickup,
            "return_at": return_date,
        },
    )
    assert create_resp.status_code == 201
    booking_id = create_resp.json()["booking_id"]
    assert create_resp.json()["status"] == "PENDING"

    # Attempt to confirm booking with unverified licence -> MUST BE REJECTED
    confirm_resp = client.patch(
        f"/api/v1/bookings/{booking_id}/status",
        json={"status": "CONFIRMED", "note": "Attempt confirm without licence"},
    )
    assert confirm_resp.status_code == 400
    assert "licence" in confirm_resp.json()["detail"].lower()

    # Clean up by cancelling
    client.post(f"/api/v1/bookings/{booking_id}/cancel")

def test_overlapping_reservation_conflict():
    now = datetime.now(timezone.utc)
    pickup = (now + timedelta(days=5000)).isoformat()
    return_date = (now + timedelta(days=5003)).isoformat()

    # 1. Create first booking for Vehicle 2
    b1_resp = client.post(
        "/api/v1/bookings",
        json={
            "customer_id": 1,
            "vehicle_id": 2,
            "pickup_at": pickup,
            "return_at": return_date,
        },
    )
    assert b1_resp.status_code == 201
    b1_id = b1_resp.json()["booking_id"]

    # 2. Attempt an overlapping booking for the same vehicle.
    overlap_pickup = (now + timedelta(days=5001)).isoformat()
    overlap_return = (now + timedelta(days=5004)).isoformat()

    b2_resp = client.post(
        "/api/v1/bookings",
        json={
            "customer_id": 2,
            "vehicle_id": 2,
            "pickup_at": overlap_pickup,
            "return_at": overlap_return,
        },
    )
    # PostgreSQL Exclusion Constraint bookings_no_overlapping_active_reservations MUST trigger 409 CONFLICT!
    assert b2_resp.status_code == 409
    assert "overlapping" in b2_resp.json()["detail"].lower() or "conflict" in b2_resp.json()["detail"].lower()

    # Cancel first booking to keep database tidy
    client.post(f"/api/v1/bookings/{b1_id}/cancel")

def test_booking_payment_and_return_lifecycle():
    now = datetime.now(timezone.utc)
    pickup = (now - timedelta(seconds=5)).isoformat()
    return_date = (now + timedelta(days=2) - timedelta(seconds=5)).isoformat()

    # 1. Create Booking for Vehicle 1 with verified customer 1
    create_resp = client.post(
        "/api/v1/bookings",
        json={
            "customer_id": 1,
            "vehicle_id": 1,
            "pickup_at": pickup,
            "return_at": return_date,
        },
    )
    assert create_resp.status_code == 201
    booking = create_resp.json()
    booking_id = booking["booking_id"]
    assert booking["status"] == "PENDING"
    assert Decimal(booking["total_amount"]) == Decimal("1800.00") * 2

    # 2. Record Payment
    pay_resp = client.post(
        "/api/v1/payments",
        json={
            "booking_id": booking_id,
            "amount": float(booking["total_amount"]),
            "payment_type": "RENTAL",
            "payment_method": "UPI",
            "status": "SUCCESS",
        },
    )
    assert pay_resp.status_code == 201
    assert pay_resp.json()["status"] == "SUCCESS"

    excessive_refund = client.post(
        "/api/v1/payments",
        json={
            "booking_id": booking_id,
            "amount": float(booking["total_amount"]) + 1,
            "payment_type": "REFUND",
            "payment_method": "UPI",
            "status": "SUCCESS",
        },
    )
    assert excessive_refund.status_code == 409
    partial_refund = client.post(
        "/api/v1/payments",
        json={
            "booking_id": booking_id,
            "amount": 100,
            "payment_type": "REFUND",
            "payment_method": "UPI",
            "status": "SUCCESS",
        },
    )
    assert partial_refund.status_code == 201

    # 3. Transition PENDING -> CONFIRMED
    conf_resp = client.patch(
        f"/api/v1/bookings/{booking_id}/status",
        json={"status": "CONFIRMED", "note": "Payment received, confirmed"},
    )
    assert conf_resp.status_code == 200
    assert conf_resp.json()["status"] == "CONFIRMED"

    confirmed_return = client.post(
        "/api/v1/returns",
        json={"booking_id": booking_id, "odometer_start": 20000, "odometer_end": 20350},
    )
    assert confirmed_return.status_code == 400

    # 4. Transition CONFIRMED -> ACTIVE
    act_resp = client.patch(
        f"/api/v1/bookings/{booking_id}/status",
        json={"status": "ACTIVE", "note": "Keys handed over"},
    )
    assert act_resp.status_code == 200
    assert act_resp.json()["status"] == "ACTIVE"

    completion_without_return = client.patch(
        f"/api/v1/bookings/{booking_id}/status",
        json={"status": "COMPLETED", "note": "Must require return inspection"},
    )
    assert completion_without_return.status_code == 400

    # 5. Check History logged by trigger
    hist_resp = client.get(f"/api/v1/bookings/{booking_id}/history")
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) >= 2
    transitions = [(h["old_status"], h["new_status"]) for h in history]
    assert ("PENDING", "CONFIRMED") in transitions
    assert ("CONFIRMED", "ACTIVE") in transitions

    # 6. Process Return
    return_resp = client.post(
        "/api/v1/returns",
        json={
            "booking_id": booking_id,
            "odometer_start": 20000,
            "odometer_end": 20350,
            "fuel_level": "FULL",
            "damage_notes": "All clean, no scratches",
            "late_fee": 0,
            "damage_fee": 0,
        },
    )
    assert return_resp.status_code == 201
    assert return_resp.json()["odometer_end"] == 20350

    # 7. Verify booking is now COMPLETED
    b_updated = client.get(f"/api/v1/bookings/{booking_id}").json()
    assert b_updated["status"] == "COMPLETED"

    # 8. Verify vehicle is now AVAILABLE
    v_updated = client.get(f"/api/v1/vehicles/{booking['vehicle_id']}").json()
    assert v_updated["status"] == "AVAILABLE"

def test_dashboard_and_reports():
    # Dashboard
    dash_resp = client.get("/api/v1/dashboard/stats")
    assert dash_resp.status_code == 200
    stats = dash_resp.json()
    assert "vehicles" in stats
    assert "bookings" in stats
    assert "revenue" in stats
    assert "overdue_returns" in stats
    assert "maintenance_alerts" in stats

    # Reports
    assert client.get("/api/v1/reports/monthly-revenue").status_code == 200
    assert client.get("/api/v1/reports/popular-vehicles").status_code == 200
    assert client.get("/api/v1/reports/customer-history").status_code == 200
    assert client.get("/api/v1/reports/outstanding-payments").status_code == 200
    assert client.get("/api/v1/reports/vehicle-utilization").status_code == 200
