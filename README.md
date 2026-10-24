# DriveSync — Vehicle Rental Management System (DBMS Micro Project)

A full-stack, enterprise-grade Vehicle Rental Management System built on PostgreSQL 18.6, FastAPI (Python with psycopg 3), and React with Vite.

Designed for real-world rental operations with robust transactional integrity, exclusion constraints, triggers, and comprehensive analytical reporting.

---

## Architecture & Technology Stack

- **Database**: PostgreSQL 18.6
  - Connection Driver: `psycopg 3` (`psycopg[binary,pool]`)
  - Concurrency Control: PostgreSQL GiST Exclusion Constraint `bookings_no_overlapping_active_reservations`
  - Automated Triggers: `trg_booking_status_history` logging transitions to `booking_status_history`
  - Views: `available_vehicles`, `booking_details`, `view_monthly_revenue`, `view_popular_vehicles`, `view_outstanding_payments`, `view_vehicle_utilization`
- **Backend**: Python 3.14+, FastAPI, Pydantic V2, Uvicorn
- **Frontend**: React 19, Vite, Vanilla CSS (Modern dark/light glassmorphism theme), Lucide Icons
- **API Standard**: REST & JSON with OpenAPI / Swagger documentation (`/docs`)

---

## Database Design & Objects

### 1. Existing Tables Inspected & Preserved
- `vehicle_categories`: Segment taxonomy (`Hatchback`, `SUV`, `Bike`)
- `vehicles`: Fleet inventory with rates, fuel types, transmission, and operational statuses (`AVAILABLE`, `MAINTENANCE`, `INACTIVE`)
- `customers`: Customer profiles with driving licence numbers and `licence_verified` status
- `bookings`: Reservations with temporal intervals (`pickup_at`, `return_at`), rate snapshots, and status state machine
- `payments`: Financial ledger with payment methods (`UPI`, `CARD`, `CASH`, `BANK_TRANSFER`), transaction references, and statuses
- `rental_returns`: Vehicle check-in inspections with start/end odometer, fuel levels, damage notes, and late/damage fee assessments
- `maintenance_records`: Servicing schedule, downtime logs, and maintenance cost accounting
- `booking_status_history`: Automated status audit trail generated via database trigger `trg_booking_status_history`

### 2. Constraints & Business Logic
- **Exclusion Constraint**: `bookings_no_overlapping_active_reservations` prevents concurrent or overlapping active reservations for the same vehicle at the database engine level (`tstzrange(pickup_at, return_at, '[)') WITH &&`).
- **Row-Level Serialization**: `SELECT ... FOR UPDATE` serializes concurrent booking attempts for the same vehicle.
- **Driving Licence Enforcement**: Enforces that a customer's driving licence must be verified before a reservation can be accepted or confirmed.
- **Atomic Transactions**: Booking creation, returns check-in, and payments run inside atomic database transactions (`conn.transaction()`).

### 3. Supplementary Reporting Views
Defined in [`sql/02_additional_views.sql`](file:///c:/Users/Prashant%20Singh/OneDrive/Desktop/DBMS_Micro_Project/sql/02_additional_views.sql):
- `view_monthly_revenue`: Monthly breakdown of transaction amounts, types, and methods.
- `view_popular_vehicles`: Fleet ranking by rental demand, gross booking value, and average rental days.
- `view_outstanding_payments`: Difference between booking amounts and successful payments.
- `view_vehicle_utilization`: Total days on road versus service downtime and maintenance costs.

---

## Directory Structure

```text
DBMS_Micro_Project/
├── backend/
│   ├── app/
│   │   ├── config.py              # Environment configuration
│   │   ├── database.py            # psycopg 3 connection pool & health checks
│   │   ├── main.py                # FastAPI app with CORS & lifespan
│   │   ├── schemas.py             # Pydantic validation schemas
│   │   └── routes/
│   │       ├── dashboard.py       # Executive overview metrics
│   │       ├── vehicles.py        # Fleet management & filters
│   │       ├── customers.py       # Customer directory & licence verification
│   │       ├── bookings.py        # Reservation lifecycle & exclusion checks
│   │       ├── payments.py        # Payment recording & ledger
│   │       ├── returns.py         # Odometer/fuel check-in & fee calculations
│   │       ├── maintenance.py     # Fleet servicing & downtime
│   │       └── reports.py         # Analytics & reporting endpoints
│   ├── tests/
│   │   └── test_api.py            # Comprehensive test suite
│   ├── requirements.txt
│   └── .venv/                     # Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── components/            # Sidebar, Navbar, Modal, Toast
│   │   ├── pages/                 # Dashboard, Vehicles, Bookings, Customers, ReturnsPayments, Maintenance, Reports
│   │   ├── services/api.js        # REST API client
│   │   ├── App.jsx                # Master coordinator
│   │   └── index.css              # Custom responsive design system
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── sql/
│   ├── 01_existing_schema_documentation.sql
│   └── 02_additional_views.sql
├── .env                           # Local PostgreSQL credentials (git-ignored)
├── .env.example                   # Example credentials template
├── .gitignore
└── README.md
```

---

## Setup & Running Instructions

### 1. Environment Configuration
Create or verify `.env` in the project root:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vehicle_rental_db
DB_USER=postgres
DB_PASSWORD=your_password_here
API_HOST=127.0.0.1
API_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### 2. Backend Setup & Run

Open PowerShell in the project directory:
```powershell
# 1. Activate virtual environment
.\backend\.venv\Scripts\Activate.ps1

# 2. Run backend API server
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```
- API will be accessible at: `http://127.0.0.1:8000`
- Interactive Swagger API docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### 3. Frontend Setup & Run

In a second PowerShell terminal:
```powershell
# Navigate to frontend and start dev server
cd frontend
npm run dev
```
- Web dashboard will be accessible at: `http://localhost:5173`

---

## Running Automated Tests

Run the full validation test suite covering booking conflicts, unverified licences, invalid dates, payments, returns, and reports:

```powershell
$env:PYTHONPATH="."
& ".\backend\.venv\Scripts\pytest.exe" backend\tests -v
```

All 8 tests validate:
1. Database connectivity and health endpoint.
2. Vehicle fleet listing and category verification.
3. Customer registration and duplicate constraint conflicts.
4. Validation of invalid dates (`return_at <= pickup_at`).
5. Enforcing driving licence verification before a reservation is confirmed.
6. Overlapping reservation conflict detection via PostgreSQL exclusion constraint (409 Conflict).
7. Full reservation lifecycle (Booking &rarr; Payment &rarr; Handover &rarr; Return check-in &rarr; Vehicle restoration &rarr; Trigger audit log).
8. Dashboard and analytical reports endpoints.
