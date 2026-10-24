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

@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT category_id, category_name, description FROM vehicle_categories ORDER BY category_id;")
        return cur.fetchall()

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
        with conn.cursor() as cur:
            # Check category exists
            cur.execute("SELECT category_name FROM vehicle_categories WHERE category_id = %s;", (payload.category_id,))
            cat = cur.fetchone()
            if not cat:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected category does not exist")

            insert_query = """
                INSERT INTO vehicles (
                    category_id, registration_no, brand, model, manufacture_year,
                    fuel_type, transmission, seating_capacity, daily_rate, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING vehicle_id, category_id, registration_no, brand, model,
                          manufacture_year, fuel_type, transmission, seating_capacity,
                          daily_rate, status;
            """
            cur.execute(
                insert_query,
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
            conn.commit()
            return created
    except psycopg.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A vehicle with registration number '{payload.registration_no}' already exists.",
        )
    except psycopg.Error as e:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.put("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM vehicles WHERE vehicle_id = %s;", (vehicle_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle {vehicle_id} not found")

        updates = []
        params = []
        data = payload.model_dump(exclude_unset=True)

        for k, v in data.items():
            updates.append(f"{k} = %s")
            params.append(v)

        if not updates:
            # Nothing to update, return existing
            cur.execute("""
                SELECT v.*, vc.category_name 
                FROM vehicles v JOIN vehicle_categories vc ON v.category_id = vc.category_id
                WHERE v.vehicle_id = %s;
            """, (vehicle_id,))
            return cur.fetchone()

        params.append(vehicle_id)
        update_query = f"UPDATE vehicles SET {', '.join(updates)} WHERE vehicle_id = %s RETURNING *;"
        try:
            cur.execute(update_query, tuple(params))
            updated = cur.fetchone()
            cur.execute("SELECT category_name FROM vehicle_categories WHERE category_id = %s;", (updated["category_id"],))
            cat = cur.fetchone()
            updated["category_name"] = cat["category_name"] if cat else None
            conn.commit()
            return updated
        except psycopg.Error as e:
            conn.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.patch("/{vehicle_id}/status", response_model=VehicleResponse)
def update_vehicle_status(vehicle_id: int, payload: VehicleStatusUpdate, conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE vehicles 
            SET status = %s 
            WHERE vehicle_id = %s 
            RETURNING *;
        """, (payload.status, vehicle_id))
        updated = cur.fetchone()
        if not updated:
            conn.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle {vehicle_id} not found")
        
        cur.execute("SELECT category_name FROM vehicle_categories WHERE category_id = %s;", (updated["category_id"],))
        cat = cur.fetchone()
        updated["category_name"] = cat["category_name"] if cat else None
        conn.commit()
        return updated
