from typing import Optional, List
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..schemas import MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse

router = APIRouter(prefix="/api/v1/maintenance", tags=["Maintenance"])

@router.get("", response_model=List[MaintenanceResponse])
def list_maintenance(
    vehicle_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    conn: psycopg.Connection = Depends(get_db),
):
    query = """
        SELECT m.maintenance_id, m.vehicle_id, m.description, m.start_at, m.end_at,
               m.cost, m.status, v.brand, v.model, v.registration_no
        FROM maintenance_records m
        JOIN vehicles v ON m.vehicle_id = v.vehicle_id
        WHERE 1=1
    """
    params = []

    if vehicle_id is not None:
        query += " AND m.vehicle_id = %s"
        params.append(vehicle_id)

    if status:
        query += " AND m.status = %s"
        params.append(status.upper())

    query += " ORDER BY m.start_at DESC;"

    with conn.cursor() as cur:
        cur.execute(query, tuple(params))
        return cur.fetchall()

@router.post("", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
def create_maintenance(payload: MaintenanceCreate, conn: psycopg.Connection = Depends(get_db)):
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                # Check vehicle exists
                cur.execute("SELECT vehicle_id, brand, model, registration_no, status FROM vehicles WHERE vehicle_id = %s FOR UPDATE;", (payload.vehicle_id,))
                veh = cur.fetchone()
                if not veh:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle {payload.vehicle_id} not found")

                if payload.status == "IN_PROGRESS":
                    cur.execute(
                        """
                        SELECT EXISTS (
                            SELECT 1 FROM bookings
                            WHERE vehicle_id = %s AND status = 'ACTIVE'
                        ) AS rented;
                        """,
                        (payload.vehicle_id,),
                    )
                    if cur.fetchone()["rented"]:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="An active rental prevents maintenance from starting.",
                        )

                insert_query = """
                    INSERT INTO maintenance_records (vehicle_id, description, start_at, end_at, cost, status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING maintenance_id, vehicle_id, description, start_at, end_at, cost, status;
                """
                cur.execute(
                    insert_query,
                    (
                        payload.vehicle_id,
                        payload.description.strip(),
                        payload.start_at,
                        payload.end_at,
                        payload.cost,
                        payload.status,
                    ),
                )
                created = cur.fetchone()

                # If maintenance is IN_PROGRESS, mark vehicle status as MAINTENANCE
                if payload.status == "IN_PROGRESS":
                    cur.execute("UPDATE vehicles SET status = 'MAINTENANCE' WHERE vehicle_id = %s;", (payload.vehicle_id,))

                created["brand"] = veh["brand"]
                created["model"] = veh["model"]
                created["registration_no"] = veh["registration_no"]
                return created

    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.patch("/{maintenance_id}", response_model=MaintenanceResponse)
def update_maintenance(
    maintenance_id: int,
    payload: MaintenanceUpdate,
    conn: psycopg.Connection = Depends(get_db),
):
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT m.*, v.brand, v.model, v.registration_no 
                    FROM maintenance_records m
                    JOIN vehicles v ON m.vehicle_id = v.vehicle_id
                    WHERE m.maintenance_id = %s
                    FOR UPDATE;
                """, (maintenance_id,))
                current = cur.fetchone()
                if not current:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Maintenance record {maintenance_id} not found")

                updates = []
                params = []
                data = payload.model_dump(exclude_unset=True)

                for k, v in data.items():
                    updates.append(f"{k} = %s")
                    params.append(v)

                if updates:
                    params.append(maintenance_id)
                    update_query = f"UPDATE maintenance_records SET {', '.join(updates)} WHERE maintenance_id = %s RETURNING *;"
                    cur.execute(update_query, tuple(params))
                    updated = cur.fetchone()
                else:
                    updated = current

                # Status transition side effects on vehicle
                target_status = data.get("status")
                if target_status in ("COMPLETED", "SCHEDULED"):
                    cur.execute(
                        """
                        UPDATE vehicles
                        SET status = CASE
                            WHEN EXISTS (
                                SELECT 1 FROM maintenance_records
                                WHERE vehicle_id = %s AND maintenance_id <> %s
                                  AND status = 'IN_PROGRESS'
                            ) THEN 'MAINTENANCE'
                            WHEN EXISTS (
                                SELECT 1 FROM bookings
                                WHERE vehicle_id = %s AND status = 'ACTIVE'
                            ) THEN status
                            WHEN status = 'INACTIVE' THEN status
                            ELSE 'AVAILABLE'
                        END
                        WHERE vehicle_id = %s;
                        """,
                        (
                            current["vehicle_id"],
                            maintenance_id,
                            current["vehicle_id"],
                            current["vehicle_id"],
                        ),
                    )
                elif target_status == "IN_PROGRESS":
                    cur.execute(
                        """
                        SELECT EXISTS (
                            SELECT 1 FROM bookings
                            WHERE vehicle_id = %s AND status = 'ACTIVE'
                        ) AS rented;
                        """,
                        (current["vehicle_id"],),
                    )
                    if cur.fetchone()["rented"]:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="An active rental prevents maintenance from starting.",
                        )
                    cur.execute("UPDATE vehicles SET status = 'MAINTENANCE' WHERE vehicle_id = %s;", (current["vehicle_id"],))

                updated["brand"] = current["brand"]
                updated["model"] = current["model"]
                updated["registration_no"] = current["registration_no"]
                return updated

    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
