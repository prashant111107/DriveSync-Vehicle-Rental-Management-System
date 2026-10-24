import os
from dotenv import load_dotenv
from psycopg_pool import ConnectionPool
import psycopg

load_dotenv()
conninfo = f"host={os.getenv('DB_HOST')} port={os.getenv('DB_PORT')} dbname={os.getenv('DB_NAME')} user={os.getenv('DB_USER')} password={os.getenv('DB_PASSWORD')}"
pool = ConnectionPool(conninfo=conninfo, min_size=1, max_size=2)

# Case 1: insert using with conn.transaction():
with pool.connection() as conn:
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
    print("Exiting pool.connection() block...")

# Case 2: what about vehicles.py where conn.commit() is called?
# Case 3: what about when conn.commit() is NOT called or an exception occurs?
