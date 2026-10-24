# DriveSync — Vehicle Rental Management System

DriveSync is a full-stack admin application for managing a vehicle rental fleet. It uses React and Vite for the dashboard, FastAPI for business logic and REST APIs, and PostgreSQL for persistent data and database-enforced rules.

> **Database safety:** The application connects to the existing `vehicle_rental_db`. Its tables, data, constraints, indexes, views, and triggers are part of the existing database and should be preserved. Do not reset the database or run scripts that drop or recreate these objects.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Lucide React, CSS |
| Backend | Python, FastAPI, Pydantic, psycopg 3 connection pool |
| Database | PostgreSQL |
| API format | REST / JSON |

## Features

- **Dashboard:** Fleet and booking summaries, revenue totals, customer verification counts, recent bookings, and recent payments. The dashboard API also returns overdue active bookings, pending payment totals/counts, deposits held, and scheduled or in-progress maintenance alerts.
- **Vehicles:** Search and filter by category, fuel, transmission, rate, and status; add, edit, and delete vehicles; update operational status; start a booking for an available vehicle.
- **Customers:** Search and filter the customer directory, register, edit, and delete customers, and verify or revoke driving-licence verification.
- **Bookings:** Create reservations with a server-calculated price, check the licence before confirmation or handover, enforce allowed status transitions, cancel bookings, process vehicle handover, and view database-recorded status history. Completion requires a return inspection.
- **Payments:** Record ledger entries for rental, deposit, late fee, damage, and refund types with pending, successful, or failed status. Refund requests are checked against captured amounts. Transaction references are unique when provided. This is a payment ledger; no external payment processor is integrated.
- **Returns:** Record the return time, odometer readings, fuel level, condition notes, and late/damage charges. A return can only be recorded for an active rental. The vehicle is not made available while maintenance is in progress.
- **Maintenance:** Schedule and update service records; in-progress maintenance marks the vehicle as under maintenance and cannot start during an active rental.
- **Reports:** Monthly revenue, popular vehicles, customer payment history, outstanding balances, and vehicle utilization, using PostgreSQL views and queries.
- **API health:** `/health` and `/api/v1/health` report whether the database connection is healthy.

### Current API scope

The backend supports customer and vehicle create, read, update, delete, search/filter, and licence verification where applicable. Foreign-key history prevents deleting customers or vehicles that are referenced by bookings or maintenance. Payment records can be entered with supported payment types and statuses, but there is no payment gateway or automated refund processing. Return fees are stored on the return record; recording a return does not itself create payment-ledger transactions. Because the existing payment schema does not link a refund to its original payment, reports treat a refund as a booking-level reversal and cannot identify whether a deposit or rental charge was refunded.

## Existing PostgreSQL schema

The application uses these existing public tables:

- `vehicle_categories`
- `vehicles`
- `customers`
- `bookings`
- `booking_status_history`
- `payments`
- `rental_returns`
- `maintenance_records`

Existing database rules include the `bookings_no_overlapping_active_reservations` GiST exclusion constraint, unique customer and vehicle identifiers, unique payment transaction references, and one return record per booking. The `trg_booking_status_history` trigger logs booking status changes.

Existing views include:

- `available_vehicles`
- `booking_details`
- `view_monthly_revenue`
- `view_popular_vehicles`
- `view_outstanding_payments`
- `view_vehicle_utilization`

The booking API locks the relevant vehicle row while creating a reservation, calculates the price from the stored daily rate, and translates overlapping-reservation conflicts into an HTTP 409 response. PostgreSQL remains the final authority for preventing overlapping active reservations.

No database reset is required to run the application. The SQL files under `sql/` document existing database objects and supplementary reporting views; inspect the live database before applying any SQL changes.

## Project layout

```text
DBMS_Micro_Project/
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── schemas.py
│   │   └── routes/
│   │       ├── bookings.py
│   │       ├── customers.py
│   │       ├── dashboard.py
│   │       ├── maintenance.py
│   │       ├── payments.py
│   │       ├── reports.py
│   │       ├── returns.py
│   │       └── vehicles.py
│   ├── tests/test_api.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/api.js
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── sql/
├── .env.example
└── README.md
```

## Requirements

- Python 3.14 or a compatible Python version
- Node.js and npm
- PostgreSQL with the existing `vehicle_rental_db` database and required schema

## Configuration

Create a root-level `.env` file using `.env.example` as a template. The backend also checks `backend\.env` as a fallback. Set the credentials for the existing `vehicle_rental_db`; never commit the real `.env` file. If `DATABASE_URL` is used for credentials/host, `DB_NAME` still selects the database name (default: `vehicle_rental_db`).

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vehicle_rental_db
DB_USER=postgres
DB_PASSWORD=replace_with_your_local_password

API_HOST=127.0.0.1
API_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

The Vite development server proxies `/api` and `/health` requests to `http://127.0.0.1:8000`. If port 5173 is already in use, Vite may select another port; use the URL printed by Vite. The proxy configuration works independently of the frontend port.

## Run locally (Windows PowerShell)

Open a terminal at the project root.

### 1. Start the API

```powershell
.\backend\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

If a local virtual environment has not been created yet:

```powershell
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Start the frontend

In a second terminal:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

### Useful URLs

| Purpose | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| API health | `http://127.0.0.1:8000/health` |
| Interactive API docs | `http://127.0.0.1:8000/docs` |
| OpenAPI schema | `http://127.0.0.1:8000/openapi.json` |

## REST API overview

All application routes are versioned under `/api/v1`.

| Area | Main routes |
| --- | --- |
| Dashboard | `GET /dashboard/stats` |
| Vehicles | `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/{id}`, `PATCH /vehicles/{id}/status`, `GET /vehicles/categories` |
| Customers | `GET/POST /customers`, `GET/PUT/DELETE /customers/{id}`, `PATCH /customers/{id}/verify` |
| Bookings | `GET/POST /bookings`, `GET /bookings/{id}`, `PATCH /bookings/{id}/status`, `POST /bookings/{id}/cancel`, `GET /bookings/{id}/history` |
| Payments | `GET/POST /payments` |
| Returns | `GET/POST /returns`, `GET /returns/{booking_id}` |
| Maintenance | `GET/POST /maintenance`, `PATCH /maintenance/{id}` |
| Reports | `GET /reports/monthly-revenue`, `/popular-vehicles`, `/customer-history`, `/outstanding-payments`, `/vehicle-utilization` |

## Tests and frontend checks

Run the backend API tests from the project root:

```powershell
$env:PYTHONPATH = "."
& ".\backend\.venv\Scripts\pytest.exe" backend\tests -v
```

Run frontend checks from the `frontend` directory:

```powershell
npm run lint
npm run build
```

The API tests exercise database-backed workflows, so configure `.env` and make the existing database available before running them. Review test behavior before using it against data that must remain unchanged.

## Related documentation

- [`sql/01_existing_schema_documentation.sql`](./sql/01_existing_schema_documentation.sql) — existing schema reference.
- [`sql/02_additional_views.sql`](./sql/02_additional_views.sql) — supplementary reporting-view definitions.
