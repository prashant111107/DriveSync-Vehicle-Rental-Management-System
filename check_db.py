import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn_str = f"host={os.getenv('DB_HOST')} port={os.getenv('DB_PORT')} dbname={os.getenv('DB_NAME')} user={os.getenv('DB_USER')} password={os.getenv('DB_PASSWORD')}"

with psycopg.connect(conn_str) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT vehicle_id, registration_no, brand, model, daily_rate, status FROM vehicles ORDER BY vehicle_id;")
        print("VEHICLES COUNT:", cur.rowcount)
        for row in cur.fetchall():
            print(" ", row)

        cur.execute("SELECT customer_id, full_name, email, phone, licence_number, licence_verified FROM customers ORDER BY customer_id;")
        print("\nCUSTOMERS COUNT:", cur.rowcount)
        for row in cur.fetchall():
            print(" ", row)

        cur.execute("SELECT booking_id, customer_id, vehicle_id, pickup_at, return_at, status FROM bookings ORDER BY booking_id;")
        print("\nBOOKINGS COUNT:", cur.rowcount)
        for row in cur.fetchall():
            print(" ", row)

        cur.execute("SELECT * FROM rental_returns;")
        print("\nRETURNS COUNT:", cur.rowcount)
        for row in cur.fetchall():
            print(" ", row)
