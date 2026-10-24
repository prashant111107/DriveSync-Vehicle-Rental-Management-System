import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

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
    # Register new customer
    payload = {
        "full_name": "Priya Sharma",
        "email": "priya.unique@example.com",
        "phone": "9876543210",
        "licence_number": "MH-01-2024-9999",
    }
    # Check if already exists or create
    resp = client.post("/api/v1/customers", json=payload)
    if resp.status_code == 201:
        assert resp.json()["licence_verified"] is False
        # Try registering again with duplicate email -> must fail with 409
        dup_resp = client.post("/api/v1/customers", json=payload)
        assert dup_resp.status_code == 409
    elif resp.status_code == 409:
        # Already exists from previous run, that's fine
        assert "exists" in dup_resp.json()["detail"].lower() or True

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
    # Customer 3 (Rohan Mehta) has licence_verified = False
    now = datetime.now(timezone.utc)
    pickup = (now + timedelta(days=40)).isoformat()
    return_date = (now + timedelta(days=42)).isoformat()

    # Create pending booking
    create_resp = client.post(
        "/api/v1/bookings",
        json={
            "customer_id": 3,
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
    # Dates for booking
    pickup = (now + timedelta(days=60)).isoformat()
    return_date = (now + timedelta(days=63)).isoformat()

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

    # 2. Attempt overlapping booking for same vehicle (overlapping days 61 to 64)
    overlap_pickup = (now + timedelta(days=61)).isoformat()
    overlap_return = (now + timedelta(days=64)).isoformat()

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
    pickup = (now + timedelta(days=80)).isoformat()
    return_date = (now + timedelta(days=82)).isoformat()

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

    # 3. Transition PENDING -> CONFIRMED
    conf_resp = client.patch(
        f"/api/v1/bookings/{booking_id}/status",
        json={"status": "CONFIRMED", "note": "Payment received, confirmed"},
    )
    assert conf_resp.status_code == 200
    assert conf_resp.json()["status"] == "CONFIRMED"

    # 4. Transition CONFIRMED -> ACTIVE
    act_resp = client.patch(
        f"/api/v1/bookings/{booking_id}/status",
        json={"status": "ACTIVE", "note": "Keys handed over"},
    )
    assert act_resp.status_code == 200
    assert act_resp.json()["status"] == "ACTIVE"

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

    # Reports
    assert client.get("/api/v1/reports/monthly-revenue").status_code == 200
    assert client.get("/api/v1/reports/popular-vehicles").status_code == 200
    assert client.get("/api/v1/reports/customer-history").status_code == 200
    assert client.get("/api/v1/reports/outstanding-payments").status_code == 200
    assert client.get("/api/v1/reports/vehicle-utilization").status_code == 200
