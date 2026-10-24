from decimal import Decimal
from typing import Optional, List
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..schemas import (
    VehicleCreate,
    VehicleUpdate,
    VehicleStatusUpdate,
    VehicleResponse,
    CategoryResponse,
)

router = APIRouter(prefix="/api/v1/vehicles", tags=["Vehicles"])

def validate_vehicle_status_change(cur, vehicle_id, current_status, new_status):
    if new_status == current_status:
        return

    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM bookings
            WHERE vehicle_id = %s AND status = 'ACTIVE'
        ) AS rented,
        EXISTS (
            SELECT 1 FROM maintenance_records
            WHERE vehicle_id = %s AND status = 'IN_PROGRESS'
        ) AS in_maintenance;
        """,
        (vehicle_id, vehicle_id),
    )
    operational_state = cur.fetchone()
    if operational_state["rented"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active rental prevents changing this vehicle's operational status.",
        )
    if operational_state["in_maintenance"] and new_status != "MAINTENANCE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A vehicle with in-progress maintenance must remain in maintenance status.",
        )


@router.get("/categories")
def get_categories(db: psycopg.Connection = Depends(get_db)):
    try:
        with db.cursor() as cur:
            cur.execute("SELECT category_id, category_name FROM categories ORDER BY category_name;")
            categories = cur.fetchall()
            return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[VehicleResponse])
def list_vehicles(
    category_id: Optional[int] = Query(None),
    transmission: Optional[str] = Query(None),
    fuel_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    min_rate: Optional[Decimal] = Query(None),
    max_rate: Optional[Decimal] = Query(None),
    search: Optional[str] = Query(None),
    conn: psycopg.Connection = Depends(get_db),
):
    query = """
        SELECT 
            v.vehicle_id,
            v.category_id,
            v.registration_no,
            v.brand,
            v.model,
            v.manufacture_year,
            v.fuel_type,
            v.transmission,
            v.seating_capacity,
            v.daily_rate,
            v.status,
            vc.category_name
        FROM vehicles v
        JOIN vehicle_categories vc ON v.category_id = vc.category_id
        WHERE 1=1
    """
    params = []

    if category_id is not None:
        query += " AND v.category_id = %s"
        params.append(category_id)

    if transmission:
        query += " AND v.transmission = %s"
        params.append(transmission.upper())

    if fuel_type:
        query += " AND v.fuel_type = %s"
        params.append(fuel_type.upper())

    if status:
        query += " AND v.status = %s"
        params.append(status.upper())

    if min_rate is not None:
        query += " AND v.daily_rate >= %s"
        params.append(min_rate)

    if max_rate is not None:
        query += " AND v.daily_rate <= %s"
        params.append(max_rate)

    if search:
        query += " AND (v.brand ILIKE %s OR v.model ILIKE %s OR v.registration_no ILIKE %s)"
        pattern = f"%{search.strip()}%"
        params.extend([pattern, pattern, pattern])

    query += " ORDER BY v.vehicle_id ASC;"

    with conn.cursor() as cur:
        cur.execute(query, tuple(params))
        return cur.fetchall()

@router.get("/{vehicle_id}", response_model=VehicleResponse)
def get_vehicle(vehicle_id: int, conn: psycopg.Connection = Depends(get_db)):
    query = """
        SELECT 
            v.vehicle_id,
            v.category_id,
            v.registration_no,
            v.brand,
            v.model,
            v.manufacture_year,
            v.fuel_type,
            v.transmission,
            v.seating_capacity,
            v.daily_rate,
            v.status,
            vc.category_name
        FROM vehicles v
        JOIN vehicle_categories vc ON v.category_id = vc.category_id
        WHERE v.vehicle_id = %s;
    """
    with conn.cursor() as cur:
        cur.execute(query, (vehicle_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle with ID {vehicle_id} not found")
        return row

@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehicleCreate, conn: psycopg.Connection = Depends(get_db)):
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SELECT category_name FROM categories WHERE category_id = %s;", (payload.category_id,))
                cat = cur.fetchone()
                if not cat:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected category does not exist")

                cur.execute(
                    """
                    INSERT INTO vehicles (
                        category_id, registration_no, brand, model, manufacture_year,
                        fuel_type, transmission, seating_capacity, daily_rate, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING vehicle_id, category_id, registration_no, brand, model,
                              manufacture_year, fuel_type, transmission, seating_capacity,
                              daily_rate, status;
                    """,
                    (
                        payload.category_id,
                        payload.registration_no.strip().upper(),
                        payload.brand.strip(),
                        payload.model.strip(),
                        payload.manufacture_year,
                        payload.fuel_type,
                        payload.transmission,
                        payload.seating_capacity,
                        payload.daily_rate,
                        payload.status,
                    ),
                )
                created = cur.fetchone()
                created["category_name"] = cat["category_name"]
                return created
    except psycopg.errors.UniqueViolation as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A vehicle with registration number '{payload.registration_no}' already exists.",
        ) from e
    except psycopg.Error as e:
        # This will now show the exact PostgreSQL error in your frontend toast and backend terminal!
        print(f"Database Error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Database error: {e}") from e

    
@router.put("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, conn: psycopg.Connection = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_vehicle(vehicle_id, conn)
    if any(value is None for field, value in data.items() if field != "manufacture_year"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Update fields cannot be null.")
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT vehicle_id, status FROM vehicles WHERE vehicle_id = %s FOR UPDATE;",
                    (vehicle_id,),
                )
                current = cur.fetchone()
                if not current:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle {vehicle_id} not found")

                if "status" in data:
                    validate_vehicle_status_change(cur, vehicle_id, current["status"], data["status"])
                if "registration_no" in data:
                    data["registration_no"] = data["registration_no"].strip().upper()
                if "brand" in data:
                    data["brand"] = data["brand"].strip()
                if "model" in data:
                    data["model"] = data["model"].strip()
                updates = [f"{field} = %s" for field in data]
                values = [data[field] for field in data]
                values.append(vehicle_id)
                cur.execute(
                    f"""
                        UPDATE vehicles
                        SET {', '.join(updates)}
                        WHERE vehicle_id = %s
                        RETURNING vehicle_id, category_id, registration_no, brand, model,
                                  manufacture_year, fuel_type, transmission, seating_capacity,
                                  daily_rate, status;
                    """,
                    tuple(values),
                )
                updated = cur.fetchone()
                cur.execute(
                    "SELECT category_name FROM vehicle_categories WHERE category_id = %s;",
                    (updated["category_id"],),
                )
                updated["category_name"] = cur.fetchone()["category_name"]
                return updated
    except psycopg.errors.UniqueViolation as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A vehicle with this registration number already exists.",
        ) from e
    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to update vehicle.") from e

@router.patch("/{vehicle_id}/status", response_model=VehicleResponse)
def update_vehicle_status(vehicle_id: int, payload: VehicleStatusUpdate, conn: psycopg.Connection = Depends(get_db)):
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT vehicle_id, category_id, status
                    FROM vehicles
                    WHERE vehicle_id = %s
                    FOR UPDATE;
                    """,
                    (vehicle_id,),
                )
                vehicle = cur.fetchone()
                if not vehicle:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle {vehicle_id} not found")

                validate_vehicle_status_change(cur, vehicle_id, vehicle["status"], payload.status)

                cur.execute(
                    """
                    UPDATE vehicles
                    SET status = %s
                    WHERE vehicle_id = %s
                    RETURNING vehicle_id, category_id, registration_no, brand, model,
                              manufacture_year, fuel_type, transmission, seating_capacity,
                              daily_rate, status;
                    """,
                    (payload.status, vehicle_id),
                )
                updated = cur.fetchone()
                cur.execute(
                    "SELECT category_name FROM vehicle_categories WHERE category_id = %s;",
                    (updated["category_id"],),
                )
                updated["category_name"] = cur.fetchone()["category_name"]
                return updated
    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to update vehicle status.") from e

@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: int, conn: psycopg.Connection = Depends(get_db)):
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM vehicles WHERE vehicle_id = %s RETURNING vehicle_id;",
                    (vehicle_id,),
                )
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Vehicle {vehicle_id} not found.",
                    )
    except psycopg.errors.ForeignKeyViolation as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This vehicle has booking or maintenance history and cannot be deleted.",
        ) from e
