import os
from pathlib import Path
from psycopg.conninfo import conninfo_to_dict
from dotenv import load_dotenv

project_root = Path(__file__).resolve().parent.parent.parent
root_env = project_root / ".env"
backend_env = project_root / "backend" / ".env"
if root_env.exists():
    load_dotenv(dotenv_path=root_env)
elif backend_env.exists():
    load_dotenv(dotenv_path=backend_env)
else:
    load_dotenv()

DB_NAME = os.getenv("DB_NAME", "vehicle_rental_db")
DATABASE_URL = os.getenv("DATABASE_URL")
url_conn_info = conninfo_to_dict(DATABASE_URL) if DATABASE_URL else {}
DB_HOST = os.getenv("DB_HOST", url_conn_info.get("host", "localhost"))
DB_PORT = os.getenv("DB_PORT", url_conn_info.get("port", "5432"))
DB_USER = os.getenv("DB_USER", url_conn_info.get("user", "postgres"))
DB_PASSWORD = os.getenv("DB_PASSWORD", url_conn_info.get("password", ""))

API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))

# CORS origins
raw_cors = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]

DATABASE_CONN_INFO = {
    **url_conn_info,
    "host": DB_HOST,
    "port": DB_PORT,
    "dbname": DB_NAME,
    "user": DB_USER,
    "password": DB_PASSWORD,
}
