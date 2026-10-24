from typing import Optional, List
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import get_db
from ..schemas import (
    CustomerCreate,
    CustomerUpdate,
    CustomerVerifyUpdate,
    CustomerResponse,
)

router = APIRouter(prefix="/api/v1/customers", tags=["Customers"])

@router.get("", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = Query(None),
    verified: Optional[bool] = Query(None),
    conn: psycopg.Connection = Depends(get_db),
):
    query = """
        SELECT customer_id, full_name, email, phone, licence_number, licence_verified, created_at
        FROM customers
        WHERE 1=1
    """
    params = []

    if verified is not None:
        query += " AND licence_verified = %s"
        params.append(verified)

    if search:
        query += " AND (full_name ILIKE %s OR email ILIKE %s OR phone ILIKE %s OR licence_number ILIKE %s)"
        pattern = f"%{search.strip()}%"
        params.extend([pattern, pattern, pattern, pattern])

    query += " ORDER BY customer_id ASC;"

    with conn.cursor() as cur:
        cur.execute(query, tuple(params))
        return cur.fetchall()

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, conn: psycopg.Connection = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT customer_id, full_name, email, phone, licence_number, licence_verified, created_at
            FROM customers
            WHERE customer_id = %s;
        """, (customer_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Customer with ID {customer_id} not found")
        return row

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def register_customer(payload: CustomerCreate, conn: psycopg.Connection = Depends(get_db)):
    insert_query = """
        INSERT INTO customers (full_name, email, phone, licence_number, licence_verified)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING customer_id, full_name, email, phone, licence_number, licence_verified, created_at;
    """
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    insert_query,
                    (
                        payload.full_name.strip(),
                        payload.email.strip().lower(),
                        payload.phone.strip(),
                        payload.licence_number.strip().upper(),
                        False,
                    ),
                )
                return cur.fetchone()
    except psycopg.errors.UniqueViolation as e:
        constraint = e.diag.constraint_name
        messages = {
            "customers_email_key": "A customer with this email address already exists.",
            "customers_phone_key": "A customer with this phone number already exists.",
            "customers_licence_number_key": "A customer with this driving licence number already exists.",
        }
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=messages.get(constraint, "Duplicate customer detail exists."),
        ) from e
    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to register customer.") from e

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    conn: psycopg.Connection = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_customer(customer_id, conn)
    if any(value is None for value in data.values()):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Update fields cannot be null.")

    normalized = {
        "full_name": data.get("full_name", "").strip() if "full_name" in data else None,
        "email": data.get("email", "").strip().lower() if "email" in data else None,
        "phone": data.get("phone", "").strip() if "phone" in data else None,
        "licence_number": data.get("licence_number", "").strip().upper() if "licence_number" in data else None,
    }
    if any(not value for value in normalized.values() if value is not None):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Update fields cannot be blank.")
    updates = [f"{field} = %s" for field in normalized if field in data]
    params = [normalized[field] for field in normalized if field in data]
    params.append(customer_id)

    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT licence_number FROM customers WHERE customer_id = %s FOR UPDATE;",
                    (customer_id,),
                )
                current = cur.fetchone()
                if not current:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Customer {customer_id} not found.",
                    )

                if "licence_number" in data and normalized["licence_number"] != current["licence_number"]:
                    updates.append("licence_verified = FALSE")
                cur.execute(
                    f"""
                        UPDATE customers
                        SET {', '.join(updates)}
                        WHERE customer_id = %s
                        RETURNING customer_id, full_name, email, phone, licence_number,
                                  licence_verified, created_at;
                    """,
                    tuple(params),
                )
                updated = cur.fetchone()
                if not updated:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Customer {customer_id} not found.",
                    )
                return updated
    except psycopg.errors.UniqueViolation as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A customer with one of these email, phone, or licence details already exists.",
        ) from e
    except psycopg.Error as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to update customer.") from e

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, conn: psycopg.Connection = Depends(get_db)):
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM customers WHERE customer_id = %s RETURNING customer_id;",
                    (customer_id,),
                )
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Customer {customer_id} not found.",
                    )
    except psycopg.errors.ForeignKeyViolation as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This customer has booking history and cannot be deleted.",
        ) from e

@router.patch("/{customer_id}/verify", response_model=CustomerResponse)
def verify_customer_licence(
    customer_id: int,
    payload: CustomerVerifyUpdate,
    conn: psycopg.Connection = Depends(get_db),
):
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE customers
                SET licence_verified = %s
                WHERE customer_id = %s
                RETURNING customer_id, full_name, email, phone, licence_number, licence_verified, created_at;
            """, (payload.licence_verified, customer_id))
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Customer {customer_id} not found")
            return updated
