from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, DB_NAME, DB_HOST, DB_PORT
from .database import init_db_pool, close_db_pool, check_db_health
from .routes import (
    vehicles,
    customers,
    bookings,
    payments,
    returns,
    maintenance,
    dashboard,
    reports,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vehicle_rental.api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Vehicle Rental Management System API...")
    init_db_pool()
    yield
    logger.info("Shutting down API...")
    close_db_pool()

app = FastAPI(
    title="Vehicle Rental Management System API",
    description="Full-stack DBMS Micro Project API for Vehicle Rental Management with PostgreSQL 18.6",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all route modules
app.include_router(dashboard.router)
app.include_router(vehicles.router)
app.include_router(customers.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(returns.router)
app.include_router(maintenance.router)
app.include_router(reports.router)

@app.get("/", tags=["Health"])
def root():
    return {
        "system": "Vehicle Rental Management System API",
        "version": "1.0.0",
        "docs_url": "/docs",
        "database": DB_NAME,
        "status": "online",
    }

@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
def health():
    db_ok = check_db_health()
    if not db_ok:
        return {
            "status": "degraded",
            "database": "disconnected",
            "database_name": DB_NAME,
            "database_host": f"{DB_HOST}:{DB_PORT}",
        }
    return {
        "status": "healthy",
        "database": "connected",
        "database_name": DB_NAME,
        "database_host": f"{DB_HOST}:{DB_PORT}",
    }
