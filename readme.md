# Codex Edumine

**A complete school & coaching-centre management platform — students, academics, attendance, exams, results, billing, payroll, and communication in one system.**

Codex Edumine replaces the spreadsheets, registers, and paper receipts that most educational institutes still run on. Every user — from the Principal to a parent — logs into the same platform and sees exactly the information they are allowed to see.

One standout capability: **automatic OMR answer-sheet scanning**. Upload photos or scans of MCQ answer sheets and the system reads the bubbles, scores them against the answer key, and pushes the marks straight into the results workflow.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)
- [Project Architecture](#project-architecture)
- [User Roles](#user-roles)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Future Improvements](#future-improvements)
- [Conclusion](#conclusion)

---

## Project Overview

### The problem

Educational institutes juggle a dozen disconnected systems: one register for attendance, a spreadsheet for marks, a notebook for fee collection, printed slips for salaries, and phone calls for announcements. Data gets duplicated, results take days to compile, and no one has a single reliable view of the institution.

### The solution

Codex Edumine is a **single, role-based platform** covering the full operational lifecycle of an institute:

| Area | What it replaces |
|---|---|
| People & admissions | Paper admission forms, scattered contact lists |
| Academics & routine | Manually drawn timetables with clashing teachers |
| Attendance | Paper registers and standalone biometric software |
| Exams & results | Marks spreadsheets and manual result compilation |
| OMR answer sheets | Hand-checking hundreds of MCQ sheets |
| Billing & fees | Receipt books and due-tracking notebooks |
| Payroll & expenses | Manual salary sheets and unapproved spending |
| Communication | Ad-hoc phone calls and printed notices |

Everything is governed by **role-based access control (RBAC)**, enforced both in the interface and again on the server, so a teacher can never see payroll and a guardian can only ever see their own children's records.

The platform is designed for a **single institution** (one school or coaching centre per deployment).

---

## Key Features

### 🎓 Academic Management
- Academic years with the ability to **carry forward** classes, subjects, rooms, and routines into a new year
- Classes, sections, subjects, and rooms
- Student enrolment and promotion between classes
- Class routines with **automatic teacher-conflict detection** — a teacher cannot be double-booked for the same period

### 👥 People Management
- Students, teachers, guardians, and staff, each with a full profile
- Guardians can be linked to **multiple children**
- Account management for admins, accountants, receptionists, and staff

### 🕐 Attendance
- **Biometric attendance** — device registration and daily entry/exit punch records
- **Subject-wise class attendance** marked by the teacher for each period
- Combined daily view per student (entry/exit time plus period-wise attendance)

### 📝 Exams & Question Papers
- Create exams, select participating classes, and configure subjects with mark schemes
- Teachers submit question papers for their assigned subjects
- **Question approval workflow** — draft → pending → approved / revision requested
- Printable exam papers and per-subject submission tracking
- Deadline **extension requests** from teachers, approved by admin

### 🖨️ OMR Answer-Sheet Scanning
- Define an **answer key** per exam subject
- Create a scanning **batch** and upload sheet images in bulk
- The engine aligns each sheet, reads the bubbles, and extracts roll number, class, subject code, set code, and all answers
- Automatic scoring with confidence levels; low-confidence or ambiguous sheets are flagged for **manual review**
- Individual sheets can be corrected or reprocessed
- Export batch results to **CSV or Excel**, or **apply** them directly to exam results

### 📊 Results
- Teachers enter marks → Admin compiles → **Principal approves** → **Principal publishes**
- Results become visible to students and guardians **only after publication**
- Individual exam result cards and year-end aggregated reporting

### 💰 Billing & Fees
- Class-based fee structures (admission, session, monthly tuition, and custom fees)
- Discounts (flat or percentage), invoice generation, and printable invoices
- Cash and online payment recording with **due tracking** per student
- A database-level safeguard prevents overpayment against an invoice

### 🧾 Payroll, Expenses & Assets
- Salary structures, payroll runs, and payslips per employee
- Expense submission with a **mandatory approval step**
- Asset registry tracking type, quantity, and condition over time

### 📢 Communication
- Announcements targeted at selected roles or classes
- SMS delivery through a configurable gateway, with full send logs

### 🤖 AI Assistance (optional)
Powered by the Claude API, and **entirely optional** — the platform runs fully without it. AI output is always a *draft* shown to a human for review; nothing is auto-published or auto-sent.
- Exam question **draft assist** for teachers
- Result insight summaries
- Announcement / SMS drafting
- Dashboard insights: attendance patterns, financial narrative (Principal only), at-risk student worklists, and a guardian support assistant

### 🔐 Security & Auditing
- JWT authentication using **HTTP-only cookies** (access + refresh tokens)
- Permission-checked API routes and rate limiting on sensitive endpoints
- Password reset via email, with expiring single-use tokens
- **Audit logs** recording state-changing actions across the system

---

## How It Works

### The main workflow, end to end

```
1. SET UP THE YEAR
   Admin creates the academic year, classes, sections, subjects, and routine.

2. ADD PEOPLE
   Students, guardians, teachers, and staff are added and enrolled.

3. RUN THE DAY
   Biometric punches record entry/exit.
   Teachers mark period-wise attendance for their own classes.

4. RUN AN EXAM
   Admin creates the exam  →  teachers submit question papers
   →  admin reviews and approves  →  paper is printed.

5. COLLECT THE MARKS
   Written marks are entered by teachers.
   MCQ sheets are scanned through OMR and applied automatically.

6. PUBLISH RESULTS
   Admin compiles  →  Principal approves  →  Principal publishes.
   Only now can students and guardians see them.

7. MONEY & COMMUNICATION
   Invoices are generated and payments collected.
   Payroll runs, expenses are approved, announcements go out.
```

### The OMR scanning flow in detail

```
Answer key defined for the exam subject
        ↓
Batch created  →  sheet images uploaded (bulk)
        ↓
Engine: load → preprocess → align → read bubbles → extract → score
        ↓
Results reviewed (flagged sheets corrected or reprocessed)
        ↓
Export to CSV/Excel  or  apply marks to exam results
```

Sheets are matched to students by the roll number read from the sheet, and each batch stores a snapshot of the bubble template it was scanned with, so a change to the sheet layout never corrupts old batches.

### What happens on every request

```
Browser  →  Next.js (UI + /api proxy)  →  FastAPI
                                            ├─ Rate limiting & security headers
                                            ├─ Authentication (JWT cookie)
                                            ├─ Permission check for the route
                                            ├─ Business logic (service layer)
                                            ├─ Database access (repository layer)
                                            └─ Audit log entry (on changes)
                                                    ↓
                                             PostgreSQL
```

---

## Technology Stack

### Backend

| Technology | Purpose |
|---|---|
| **Python** (3.12 in production) | Language |
| **FastAPI** | REST API framework |
| **PostgreSQL** | Primary database |
| **SQLAlchemy 2.0** (async) + **asyncpg** | Database access |
| **Alembic** | Database migrations |
| **Pydantic** / pydantic-settings | Validation and configuration |
| **PyJWT** + **bcrypt** | Authentication and password hashing |
| **SlowAPI** | Rate limiting |
| **OpenCV** + **NumPy** | OMR image processing |
| **openpyxl** | Excel export |
| **Cloudinary** | Cloud file storage (optional; local disk is the default) |
| **Anthropic (Claude API)** | Optional AI assistance |
| **pytest** | Testing |

### Frontend

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router) | React framework |
| **React 19** + **TypeScript** | UI and type safety |
| **Tailwind CSS 4** + **shadcn/ui** + **Radix UI** | Styling and components |
| **TanStack Query** + **Axios** | Data fetching and caching |
| **React Hook Form** + **Zod** | Forms and validation |
| **Recharts** | Charts and dashboards |
| **next-themes** | Light / dark mode |

### Tooling

| Tool | Purpose |
|---|---|
| **GitHub Actions** | CI/CD pipeline |
| **Nginx + systemd** | Production process management and reverse proxy |
| **Ruff** | Python linting |
| **ESLint** | JavaScript/TypeScript linting |

---

## Project Architecture

Codex Edumine is a **two-service application**: a Next.js frontend and a FastAPI backend, sharing one PostgreSQL database.

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Next.js Frontend                                       │
│  • Role-based dashboards and pages                      │
│  • Optimistic route guarding (proxy.ts)                 │
│  • Proxies /api/* to the backend (keeps cookies         │
│    first-party, so login works across deployments)      │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  FastAPI Backend                                        │
│                                                         │
│  core/     config, security, middleware, storage,       │
│            rate limiting, email, SMS, logging           │
│  common/   shared models, enums, validators, deps       │
│  modules/  one self-contained folder per domain         │
│            (auth, students, exams, omr, billing, …)     │
│  db/       session, model registry, Alembic migrations  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  PostgreSQL                                             │
└─────────────────────────────────────────────────────────┘
```

### Backend design rules

Each module (`students`, `exams`, `billing`, …) follows the same internal shape:

```
module/
├── router.py       # API endpoints — no business logic
├── schemas.py      # Request/response validation
├── models.py       # Database tables
├── service.py      # Business rules
└── repository.py   # Database queries
```

**Routers call Services. Services call Repositories.** This layering keeps every module testable and replaceable on its own.

### Consistent API responses

Every endpoint returns the same envelope, so the frontend handles all responses uniformly:

```json
{
  "success": true,
  "message": "Student created successfully",
  "data": { },
  "meta": { "page": 1, "limit": 20, "total": 134 }
}
```

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "email", "issue": "Invalid email format" }]
  }
}
```

### Security layering

Authorisation is checked **three times**, and the browser-side checks are only for a smooth experience — the server is always the real gatekeeper:

1. **Route guard (frontend)** — reads a non-sensitive role hint cookie to route users to the right dashboard. Never trusted for access.
2. **Interface** — hides actions the user cannot perform.
3. **API (authoritative)** — every protected endpoint requires a specific permission before it runs.

---

## User Roles

Eight roles ship with the system, each with its own dashboard and permission set.

| Role | What they can do |
|---|---|
| **Principal** | Full system authority. Sees institution-wide data including finances. **Sole authority to approve and publish results.** |
| **Admin** | Day-to-day operations: people, academics, routines, exams, attendance, billing, payroll, expenses, assets, communication, and OMR. Cannot approve results. |
| **Teacher** | Own schedule and profile; marks attendance for own classes; submits question papers and marks for own subjects. |
| **Accountant** | Billing, invoices, payments, payroll, and expense submission. |
| **Receptionist** | Front desk: student and guardian records, fee collection, and announcements. |
| **Staff** | Own profile and activity; asset registry management. |
| **Student** | Read-only view of own attendance, results, routine, billing, and announcements. |
| **Guardian** | Read-only view of every linked child's attendance, results, routine, and billing. |

Permissions are stored in the database as granular codes (for example `results.publish`, `billing.collect_payment`, `omr.scan`) and mapped to roles, so a role's abilities can be adjusted without changing application code.

---

## Installation & Setup

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.12 recommended |
| Node.js | 20 or newer |
| PostgreSQL | A running instance (local or managed) |
| Git | Any recent version |

### 1. Clone the repository

```bash
git clone <repository-url>
cd codex-edumine
```

### 2. Set up the backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your environment file and fill in the values
cp .env.example .env
```

Create an empty PostgreSQL database, point `DATABASE_URL` at it, then apply the migrations:

```bash
alembic upgrade head
```

Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000`, with interactive documentation at `http://localhost:8000/docs`.

### 3. Set up the frontend

In a second terminal:

```bash
cd frontend

npm install

cp .env.local.example .env.local
```

Start the app:

```bash
npm run dev
```

Open **`http://localhost:3000`**.

### 4. (Optional) Load sample data

Two seed scripts are available for development. Run them from the `backend/` directory with the virtual environment active:

```bash
python scripts/seed_dev_data.py      # realistic, interconnected sample data
python scripts/seed_bulk_data.py     # larger volume, for performance checks
```

Both are safe to re-run — existing records are skipped rather than duplicated.

### 5. Run the tests

```bash
cd backend
pytest
```

The suite covers configuration, data integrity, RBAC boundaries, the OMR engine and workflow, and an end-to-end scenario.

---

## Environment Variables

Two environment files are used. **Never commit real credentials** — both `.env` files are git-ignored, and the `.example` files exist to be copied and filled in locally.

### Backend — `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `APP_NAME` | No | Display name of the API. |
| `ENVIRONMENT` | No | `development` or `production`. |
| `DEBUG` | No | Enable verbose debugging. Keep `false` in production. |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. A provider's raw `postgres://` URL is accepted and normalised automatically. |
| `DATABASE_SSL` | No | SSL mode override (`disable`, `require`, `verify-full`, …). |
| `DATABASE_STATEMENT_CACHE` | No | Disable when connecting through a transaction pooler. |
| `DATABASE_NULL_POOL` | No | Set `true` on serverless hosts where connections do not survive between requests. |
| `FRONTEND_ORIGINS` | **Yes** | Comma-separated list of allowed browser origins (CORS). |
| `FRONTEND_URL` | No | Base URL used in emails such as password reset links. |
| `JWT_SECRET_KEY` | **Yes** | Secret used to sign tokens. **Generate a fresh random value for every environment** — never reuse an example value. |
| `JWT_ALGORITHM` | No | Token signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Access token lifetime. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | Refresh token lifetime. |
| `COOKIE_SECURE` | No | Must be `true` in production (HTTPS only). |
| `COOKIE_SAMESITE` / `COOKIE_DOMAIN` | No | Cookie scoping options. |
| `RATE_LIMIT_DEFAULT` | No | Global request rate limit. |
| `LOGIN_RATE_LIMIT`, `REGISTER_RATE_LIMIT`, `PASSWORD_RESET_RATE_LIMIT` | No | Limits on sensitive endpoints. |
| `LOG_LEVEL` | No | Logging verbosity. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | No | Outgoing email (password resets). Leave blank to run without email. |
| `ANTHROPIC_API_KEY` | No | Enables the optional AI features. Leave unset to disable them entirely. |
| `SMS_GATEWAY_URL`, `SMS_GATEWAY_API_KEY`, `SMS_SENDER_ID` | No | SMS provider. Without a gateway URL, sends are logged as failed rather than falsely reported as delivered. |
| `STORAGE_PROVIDER` | No | `local` (default) or `cloudinary`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` | Conditional | Required only when `STORAGE_PROVIDER=cloudinary`. The app refuses to start if any is missing. |
| `OMR_TEMPLATE_NAME` | No | Which calibrated bubble template to use. |
| `OMR_MAX_SHEETS_PER_REQUEST` | No | Maximum sheets accepted in a single upload. |
| `OMR_SAVE_ANNOTATED_IMAGES` | No | Save an annotated overlay image per sheet for review. |
| `OMR_UPLOAD_RATE_LIMIT` | No | Rate limit on the sheet-upload endpoint (the most expensive route). |

### Frontend — `frontend/.env.local`

| Variable | Required | Description |
|---|---|---|
| `BACKEND_ORIGIN` | **Yes** | Where Next.js forwards `/api/*` requests. Read at build time; never exposed to the browser. |
| `NEXT_PUBLIC_API_BASE_URL` | No | **Leave unset.** The app then calls its own origin through the proxy, which keeps auth cookies first-party. Setting a cross-origin URL breaks login. |

> **Security note:** the repository's example files and default configuration values are placeholders for local development only. Generate fresh secrets for every deployed environment, and rotate any credential that has ever been committed to version control.

---

## Usage

### Signing in

Open the application and log in from the landing page. After authentication you are redirected to the dashboard for your role — `/admin`, `/teacher`, `/student`, and so on. Attempting to open another role's area redirects to a **Forbidden** page.

Password reset is self-service via **Forgot password**, provided SMTP is configured.

### Typical tasks

| I want to… | Where to go |
|---|---|
| Add a student | Admin → Students → Add |
| Build the timetable | Admin → Academic → Routine |
| Mark class attendance | Teacher → Attendance |
| Create an exam | Admin → Exams |
| Submit a question paper | Teacher → Exams |
| Approve question papers | Admin → Exams → Question Review |
| Scan MCQ sheets | Admin → OMR → Answer Keys, then OMR → Batches |
| Publish results | Principal → Results |
| Collect a fee payment | Accountant / Receptionist → Billing |
| Run payroll | Accountant → Payroll |
| Approve an expense | Admin → Expenses |
| Send an announcement | Admin → Communication |
| Check my child's results | Guardian → Results |

### API documentation

With the backend running, FastAPI serves interactive documentation:

- Swagger UI — `http://localhost:8000/docs`
- ReDoc — `http://localhost:8000/redoc`

All endpoints live under `/api/v1`.

---

## Deployment

The project supports two deployment shapes.

### Option A — Single server (the documented production setup)

One virtual machine runs both services behind Nginx, with a managed PostgreSQL database:

```
GitHub (main branch)
      │  push
      ▼
GitHub Actions ──build frontend──▶ SSH deploy ──▶ Server
                                                  ├─ Nginx  :80/:443  (reverse proxy + TLS)
                                                  ├─ FastAPI :8000    (systemd + uvicorn)
                                                  └─ Next.js :3000    (systemd, standalone build)
                                                         │
                                                         ▼
                                                  PostgreSQL (managed)
```

The pipeline in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs automatically on every push to `main`: it builds the frontend as a standalone bundle, copies it to the server, pulls the latest backend code, installs dependencies, applies database migrations, restarts both services, and health-checks them.

A full walkthrough — networking, TLS, systemd units, and Nginx configuration — is in [docs/deployment.md](docs/deployment.md).

### Option B — Serverless / platform hosting

Both services can be deployed separately to a platform host. [backend/vercel.json](backend/vercel.json) configures the API for serverless execution with Cloudinary storage, connection pooling disabled, and secure cookies enabled. The frontend deploys as a standard Next.js app with `BACKEND_ORIGIN` pointing at the API deployment.

### Production checklist

- [ ] Generate a **new** `JWT_SECRET_KEY`
- [ ] Set `DEBUG=false` and `ENVIRONMENT=production`
- [ ] Set `COOKIE_SECURE=true` and serve over HTTPS
- [ ] Set `FRONTEND_ORIGINS` to your real domain(s) only
- [ ] Use a strong, unique database password
- [ ] Review and change any seeded demo accounts before going live
- [ ] Configure backups for the database

---

## Project Structure

```
codex-edumine/
│
├── backend/                      FastAPI application
│   ├── app/
│   │   ├── main.py               App setup and route registration
│   │   ├── core/                 Config, security, middleware, storage,
│   │   │                         rate limiting, email, SMS, logging
│   │   ├── common/               Shared models, enums, validators, dependencies
│   │   ├── db/                   Session, model registry, Alembic migrations
│   │   └── modules/              One folder per domain
│   │       ├── auth/             Login, tokens, password reset
│   │       ├── users/            Staff account management
│   │       ├── students/         Student profiles
│   │       ├── teachers/         Teacher profiles
│   │       ├── guardians/        Guardian profiles and child links
│   │       ├── academic/         Years, classes, sections, subjects, rooms
│   │       ├── routine/          Timetables and conflict checks
│   │       ├── attendance/       Biometric and class attendance
│   │       ├── exams/            Exams, subjects, question workflow
│   │       ├── results/          Marks, compilation, approval, publishing
│   │       ├── omr/              Answer-sheet scanning
│   │       │   ├── engine/       Image pipeline (align, read, score)
│   │       │   └── templates/    Calibrated bubble layouts
│   │       ├── billing/          Fees, invoices, payments
│   │       ├── payroll/          Salary structures and payroll runs
│   │       ├── expenses/         Expense requests and approvals
│   │       ├── assets/           Asset registry
│   │       ├── communication/    Announcements and SMS
│   │       ├── dashboard/        Role-based dashboard data
│   │       ├── audit/            Audit log access
│   │       ├── uploads/          File uploads
│   │       └── health/           Health check
│   ├── scripts/                  Development seed scripts
│   ├── tests/                    Test suite and OMR fixtures
│   └── requirements.txt
│
├── frontend/                     Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           Login, signup, password reset
│   │   │   ├── (dashboard)/      One area per role
│   │   │   ├── forbidden/        Access-denied page
│   │   │   └── page.tsx          Public landing page
│   │   ├── components/
│   │   │   ├── ui/               Base UI components
│   │   │   ├── layout/           Shell, sidebar, navigation
│   │   │   ├── modules/          Feature components per domain
│   │   │   ├── dashboard/        Dashboard widgets
│   │   │   └── landing/          Landing page sections
│   │   ├── hooks/                Data hooks, one per module
│   │   ├── lib/
│   │   │   ├── api/              Typed API clients
│   │   │   ├── auth/             Role definitions and helpers
│   │   │   └── validators/       Form validation schemas
│   │   ├── providers/            Auth, data-fetching, and theme providers
│   │   └── proxy.ts              Route guarding
│   └── package.json
│
├── docs/                         Project documentation
│   ├── requirements.md           Full functional requirements
│   ├── Architecture.md           System architecture
│   ├── Database.md               Database design
│   ├── database-architecture.md  Schema details
│   ├── Security.md               Security model
│   ├── Error-handling.md         Error conventions
│   ├── omr-implementation.md     OMR engine design
│   ├── ui-design.md              Design system
│   ├── deployment.md             Deployment guide
│   └── Phases.md                 Development roadmap
│
└── .github/workflows/deploy.yml  CI/CD pipeline
```

---

## Future Improvements

Identified from the project's own documentation and current code state:

- **Live biometric device integration.** The database schema, device registration, and punch ingestion exist; connecting a physical F18 fingerprint device end to end is the remaining step.
- **Separate demo seeding from migrations.** Demo login accounts are currently created by a database migration, which means they also appear in production. Moving this into an explicit, opt-in script (or gating it on `ENVIRONMENT`) is planned.
- **Background processing for OMR.** Sheets are scanned synchronously at roughly one second each, which caps how many can be uploaded per request. Moving scanning to a background job queue would remove that limit.
- **Per-section result marks.** Exam subjects can be broken into sections (for example CQ / MCQ / Practical), but these are currently configuration and display only — marks are stored as a single total per subject.
- **Multi-institution support.** The platform is deliberately single-tenant today; supporting multiple institutions in one deployment would be a significant extension.
- **Additional bubble templates.** The OMR engine ships with one calibrated sheet layout; batches already snapshot their template, so more layouts can be added without a database migration.

> Items not listed here should be treated as **Not specified**.

---

## Conclusion

**Codex Edumine brings an entire educational institute onto one platform.** Admissions, timetables, attendance, exams, answer-sheet scanning, results, fees, payroll, and communication all live in the same system, with each user seeing precisely what their role permits.

The result is less duplicated data entry, faster exam turnaround — especially for MCQ papers, which are scanned and scored automatically — and a single trustworthy view of the institution for the people who run it. For developers, the modular backend and consistent conventions make each feature area straightforward to extend or replace on its own.
