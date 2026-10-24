<div align="center">

# 🚗 DriveSync
### **Vehicle Rental Management System**

*A modern, full-stack enterprise application designed for seamless fleet inventory, reservations, customer verification, and financial ledger tracking.*

[Features](#-key-features) • [Tech Stack](#-technology-stack) • [Project Architecture](#-project-layout) • [Getting Started](#-getting-started) • [API Documentation](#-rest-api-overview)

---

</div>

## 📌 Overview

**DriveSync** is an administrative solution built to manage end-to-end operations for a vehicle rental business. It bridges a responsive **React & Vite** dashboard[cite: 1] with a robust **FastAPI** REST backend[cite: 1], anchored by a production-ready **PostgreSQL** database enforcing strict relational constraints, automated triggers, and high-performance reporting views[cite: 1]. 

> **Database Safety Notice:** The system relies on an existing pre-configured database schema (`vehicle_rental_db`)[cite: 1]. All tables, triggers, GiST exclusion constraints (preventing overlapping reservations), and views are fully established[cite: 1]. 

---

## 🛠️ Technology Stack

| Layer | Technology Used |
| :--- | :--- |
| **Frontend Dashboard** | React 19, Vite, Lucide React, Modern CSS[cite: 1] |
| **Backend API** | Python, FastAPI, Pydantic, psycopg 3 connection pooling[cite: 1] |
| **Database & Constraints** | PostgreSQL (Relational Integrity, GiST Overlap Exclusion, Triggers)[cite: 1] |
| **Communication Protocol** | REST / JSON[cite: 1] |

---

## 🚀 Key Features

* **Real-Time Dashboard:** High-level metrics tracking fleet utilization, total revenue, verification counts, overdue reservations, pending balances, security deposits held, and active maintenance alerts[cite: 1].
* **Fleet Inventory Management:** Comprehensive search and dynamic filtering by category, fuel type, transmission, daily pricing, and operational status (Available, Maintenance, Inactive)[cite: 1].
* **Customer Lifecycle & Compliance:** Complete directory management with secure driving-licence verification flags and strict foreign-key protection against deleting active clients[cite: 1].
* **Advanced Booking System:** Server-side pricing calculation, automated licence gating before confirmation/handover, status state machines, and robust conflict protection backed by PostgreSQL GiST constraints[cite: 1].
* **Financial Ledger:** Tracks multi-type entries (rentals, deposits, late fees, damages, and refunds) with clear validation against captured amounts and uniqueness rules for transaction references[cite: 1].
* **Maintenance & Returns Operations:** Workflow handling for vehicle returns (odometer checks, fuel levels, condition reporting) and service scheduling that prevents overlapping rental use[cite: 1].
* **Data Analytics & Reports:** Pre-built views tracking monthly revenue, popular vehicles, customer history, outstanding balances, and overall vehicle utilization[cite: 1].

---

## 📁 Project Layout

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

---

## ⚙️ Configuration & Environment Setup

1. **Clone or navigate** to the project root directory.
2. **Configure Environment Variables:** Create a root-level `.env` file referencing `.env.example` as a template.



```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vehicle_rental_db
DB_USER=postgres
DB_PASSWORD=your_secure_local_password

API_HOST=127.0.0.1
API_PORT=8000
CORS_ORIGINS=http://localhost:5173,[http://127.0.0.1:5173](http://127.0.0.1:5173)

```

---

## 🏃 Running Locally (Windows PowerShell)

### Step 1: Initialize and Start the Backend API

```powershell
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000

```

### Step 2: Start the Frontend Application (New Terminal)

```powershell
Set-Location .\frontend
npm install
npm run dev

```

---

| Resource | Path / URL |
| :--- | :--- |
| **Frontend User Interface** | `http://localhost:5173` |
| **API Health Check** | `http://127.0.0.1:8000/health` |
| **Interactive API Docs (Swagger)** | `http://127.0.0.1:8000/docs` |
| **OpenAPI Schema Definition** | `http://127.0.0.1:8000/openapi.json` |

---

## 🔌 REST API Overview

All core business route endpoints are versioned under `/api/v1`:

* **Dashboard:** `GET /api/v1/dashboard/stats`


* **Vehicles:** `GET/POST /api/v1/vehicles`, `GET/PUT/DELETE /api/v1/vehicles/{id}`, `PATCH /api/v1/vehicles/{id}/status`, `GET /api/v1/vehicles/categories`


* **Customers:** `GET/POST /api/v1/customers`, `GET/PUT/DELETE /api/v1/customers/{id}`, `PATCH /api/v1/customers/{id}/verify`


* **Bookings:** `GET/POST /api/v1/bookings`, `GET /api/v1/bookings/{id}`, `PATCH /api/v1/bookings/{id}/status`, `POST /api/v1/bookings/{id}/cancel`, `GET /api/v1/bookings/{id}/history`


* **Payments:** `GET/POST /api/v1/payments`


* **Returns:** `GET/POST /api/v1/returns`, `GET /api/v1/returns/{booking_id}`


* **Maintenance:** `GET/POST /api/v1/maintenance`, `PATCH /api/v1/maintenance/{id}`


* **Reports:** `GET /api/v1/reports/monthly-revenue`, `/popular-vehicles`, `/customer-history`, `/outstanding-payments`, `/vehicle-utilization`



---

Here is just the final section for your `README.md`, perfectly formatted in one go:

```markdown
---

## 🧪 Testing & Code Quality

### Run Backend Integration Tests
```powershell
$env:PYTHONPATH = "."
& ".\backend\.venv\Scripts\pytest.exe" backend\tests -v

```

### Run Frontend Build & Linter Checks

```powershell
npm run lint
npm run build

```

---

## 📚 Related Documentation

* [`sql/01_existing_schema_documentation.sql`](https://www.google.com/search?q=./sql/01_existing_schema_documentation.sql) — existing schema reference[cite: 1].
* [`sql/02_additional_views.sql`](https://www.google.com/search?q=./sql/02_additional_views.sql) — supplementary reporting-view definitions[cite: 1].

```

---

<ElicitationsGroup>
</ElicitationsGroup>

<FollowUp>
Does this complete the final piece of your README file?
</FollowUp>

```

```

---

```
