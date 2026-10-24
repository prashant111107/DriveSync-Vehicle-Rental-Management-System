import os
import sys
import json
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
import psycopg
# pyrefly: ignore [missing-import]
from psycopg.rows import dict_row

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "vehicle_rental_db")
DB_USER = os.getenv("DB_USER", "postgres")

DB_PASSWORD = os.getenv("DB_PASSWORD", "")

conn_str = f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} user={DB_USER} password={DB_PASSWORD}"

def serialize(val):
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    if hasattr(val, '__str__'):
        return str(val)
    return val

def run():
    with psycopg.connect(conn_str, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """)
            tables = [r['table_name'] for r in cur.fetchall()]
            
            cur.execute("""
                SELECT table_name 
                FROM information_schema.views 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            views = [r['table_name'] for r in cur.fetchall()]
            
            result = {"tables": {}, "views": {}}
            
            for t in tables:
                cur.execute("""
                    SELECT column_name, data_type, udt_name, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = %s
                    ORDER BY ordinal_position;
                """, (t,))
                cols = cur.fetchall()
                
                cur.execute("""
                    SELECT conname, contype, pg_get_constraintdef(c.oid) as definition
                    FROM pg_constraint c
                    JOIN pg_class t_cls ON c.conrelid = t_cls.oid
                    JOIN pg_namespace n ON t_cls.relnamespace = n.oid
                    WHERE n.nspname = 'public' AND t_cls.relname = %s;
                """, (t,))
                constraints = cur.fetchall()
                
                cur.execute(f"SELECT * FROM \"{t}\" LIMIT 5;")
                raw_rows = cur.fetchall()
                sample_rows = [{k: serialize(v) for k, v in row.items()} for row in raw_rows]
                
                cur.execute("""
                    SELECT tgname, pg_get_triggerdef(oid) as def
                    FROM pg_trigger
                    WHERE tgrelid = %s::regclass AND NOT tgisinternal;
                """, (f'"{t}"',))
                triggers = cur.fetchall()
                
                # Also check indexes
                cur.execute("""
                    SELECT indexname, indexdef
                    FROM pg_indexes
                    WHERE schemaname = 'public' AND tablename = %s;
                """, (t,))
                indexes = cur.fetchall()
                
                result["tables"][t] = {
                    "columns": cols,
                    "constraints": constraints,
                    "sample_rows": sample_rows,
                    "triggers": triggers,
                    "indexes": indexes
                }
                
            for v in views:
                cur.execute("SELECT pg_get_viewdef(%s::regclass, true) as def;", (f'"{v}"',))
                row = cur.fetchone()
                result["views"][v] = row['def'] if row else ""
                
            with open("schema_details.json", "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
                
            print("Successfully written schema_details.json!")

if __name__ == "__main__":
    run()
    
