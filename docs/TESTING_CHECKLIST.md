# SAT-SA Platform: Complete Testing & QA Checklist

This document provides a systematic verification matrix for the **SAT-SA (Supervisory Assessment & Threat Platform)** prototype across technical, functional, security, workflow, data-integrity, and presentation-readiness dimensions.

---

## 1. Environment & Service Startup QA

| Component | Test Item | Verification Command / Step | Expected Outcome | Status |
|---|---|---|---|---|
| **Database** | PostgreSQL Service | Docker or native port 5432 | Accepts connections from backend pool | **PASS** |
| **Migrations** | Alembic Head | `alembic upgrade head` | Migrations apply cleanly to head revision without missing dependencies | **PASS** |
| **Backend** | FastAPI Service | `uvicorn app.main:app --port 8000` | OpenAPI docs accessible at `/docs`, healthcheck returns `{"status":"healthy"}` | **PASS** |
| **Frontend** | Next.js Server | `npm run dev` or `npm start` | App accessible at `http://localhost:3000`, 44 routes prerendered/active | **PASS** |
| **CORS** | Browser API Access | Preflight `OPTIONS /api/v1/auth/me` | HTTP 200 with `Access-Control-Allow-Credentials: true` | **PASS** |
| **Docker** | Container Compose | `docker-compose up --build` | Launches `postgres`, `backend`, and `frontend` in isolated bridge network | **PASS** |

---

## 2. Authentication & Identity QA

| Test Scenario | Input / Action | Expected Result | Status |
|---|---|---|---|
| **Valid Credentials** | Valid seeded email + `DemoPassword123!` | HTTP 200, Sets HttpOnly `access_token` cookie, returns JWT payload | **PASS** |
| **Invalid Credentials** | Valid email + incorrect password | HTTP 401 Unauthorized (`Invalid credentials`) | **PASS** |
| **Missing Credentials** | Empty body or missing fields | HTTP 422 Unprocessable Entity | **PASS** |
| **Current User Profile** | `GET /api/v1/auth/me` with valid JWT | Returns user ID, email, roles list, effective scope, permissions list | **PASS** |
| **Unauthenticated Request** | `GET /api/v1/alerts` without cookie | HTTP 401 Unauthorized | **PASS** |
| **User Logout** | `POST /api/v1/auth/logout` | Clears `access_token` cookie, redirects to `/login` | **PASS** |

---

## 3. RBAC Matrix — All 13 Roles Verified

Each of the 13 canonical roles is verified against backend permission enforcement:

| # | Role Name | Demo Email | Department | Scope Type | Key Permissions Verified |
|---|---|---|---|---|---|
| 1 | **CSE Administrator** | `admin@sat-sa.local` | CSE Administrator | Global/Enterprise | User/Role/Dept management, system audit, full administrative bypass |
| 2 | **CISO** | `ciso@sat-sa.local` | Security | Enterprise | Executive analytics, CISO dashboard, risk posture, remediation oversight |
| 3 | **Senior Management** | `mgmt@sat-sa.local` | Security | Enterprise | Senior management dashboard, risk appetite, executive governance |
| 4 | **GRC/Risk Officer** | `grc@sat-sa.local` | Security | Enterprise | Risk matrix, treatment plans, exception reviews, policy controls |
| 5 | **Authorized Assessor** | `assessor@sat-sa.local` | Assessment / Audit | Assigned/Org | Assessment execution, evidence submission, finding creation |
| 6 | **Auditor Reviewer** | `auditor@sat-sa.local` | Assessment / Audit | Organization | Assessment review, approve/reject, changes requested, independent review |
| 7 | **Supervision Authority** | `supervision.auth@sat-sa.local` | Supervision | Enterprise | Supervisory decisions, formal directives, regulatory sanctions, case closure |
| 8 | **Supervision Analyst** | `supervision.analyst@sat-sa.local` | Supervision | Sector | Case review, evidence analysis, supervisory recommendations |
| 9 | **Sector Security Authority** | `sector.auth@sat-sa.local` | Supervision | Sector | Sector-wide threat visibility, cross-entity coordination |
| 10 | **SOC Analyst** | `soc@sat-sa.local` | Operations | Organization | Security event ingestion, alert triage, incident escalation to CSE |
| 11 | **Remediation Owner** | `remediation@sat-sa.local` | Operations | Assigned/Org | Action plan execution, evidence upload, remediation status tracking |
| 12 | **IT Infrastructure Team** | `it_infra@sat-sa.local` | Operations | Organization | Infrastructure asset mapping, technical control remediation |
| 13 | **Control Owner** | `control_owner@sat-sa.local` | Operations | Organization | Control implementation status, operational evidence provisioning |

---

## 4. Separation of Duties (SoD) & Scope Enforcement

| SoD Rule | Unauthorized Attempt | Expected HTTP Code | Backend Protection |
|---|---|---|---|
| **No Self-Assessment Approval** | Assessor attempts `POST /api/v1/assessments/{id}/approve` | **403 Forbidden** | `require_permission(p.ASSESSMENT_APPROVE)` |
| **No Self-Remediation Validation** | Remediation Owner attempts `POST /api/v1/remediations/{id}/validate` | **403 Forbidden** | `require_permission(p.REMEDIATION_VALIDATE)` |
| **Analyst Cannot Issue Decisions** | Supervision Analyst attempts `POST /api/v1/supervision/cases/{id}/record-decision` | **403 Forbidden** | `require_any_permission(p.SUPERVISION_DECIDE, ...)` |
| **Premature Remediation Closure** | GRC attempts `POST /api/v1/remediations/{id}/close` while in `OPEN` state | **400 Bad Request** | Status guard: must be `VERIFIED` |
| **Tenant Scope Isolation** | National Central Bank SOC attempts `GET /api/v1/alerts/{apex_id}` | **403 Forbidden** | Authoritative `_verify_scope` check |

---

## 5. Connected End-to-End Operational Lifecycle (Scenario A)

```
[Security Event EVT-2026-00001]
       ↓
[Alert ALT-2026-00001] (Triaged by SOC Analyst)
       ↓
[Critical Security Event CSE-2026-00001] (Core Banking Exfiltration)
       ↓
[Investigation INV-2026-00001] (Forensic Evidence Uploaded)
       ↓
[Finding FND-2026-00001] (Unrestricted Egress Legacy Gateway)
       ↓
[Risk RSK-2026-00001] (Matrix Score: Critical Impact x High Likelihood)
       ↓
[Remediation REM-2026-00001] (Implement Zero-Trust Proxy)
       ↓
[Supervision Case SUP-2026-00001] (Sector Supervisory Oversight)
       ↓
[Supervisory Decision DEC-2026-00001] (Authority Formal Directive)
```

**Verification**: Tested and passed in `tests/test_e2e_workflows.py::test_connected_scenario_a_traceability`.

---

## 6. Assessment Lifecycle QA (Scenario B)

- **State Transitions**: `DRAFT` → `ASSIGNED` → `IN_PROGRESS` → `EVIDENCE_REQUIRED` → `SUBMITTED` → `UNDER_REVIEW` → `CHANGES_REQUESTED` → `RESUBMITTED` → `APPROVED` → `CLOSED`.
- **Validation**: Assessor can submit evidence and request review; Reviewer can request changes or grant approval; all transitions emit audit logs and notifications.

---

## 7. Dataset Ingestion & Analytics QA

- **Upload & Schema Detection**: Automatic type inference across CSV/JSON rows.
- **4-Pillar Quality Score**: Validity (35%), Completeness (30%), Conformity (20%), Uniqueness (15%).
- **Canonical Event Ingestion**: Batch ingested into `SecurityEvent` table with metadata preserved for forensics.
- **Aggregations**: Calculated deterministically from real database records (no mock chart arrays).

---

## 8. Negative-Space Assessment QA (Scenario C)

- **Engine Logic**: Compares baseline expected behavior patterns against observed telemetry.
- **Safety Terminology**: Flags items as **"Potential Detection Gap"** or **"Negative-Space Signal"** (never asserts "Confirmed Missed Attack").
- **Human-in-the-loop**: Requires analyst validation before escalating to a formal `Finding`.

---

## 9. Executive Dashboards QA (Scenario D)

- **CISO Dashboard (`/ciso`)**: Real-time KPI cards, top critical risks, active CSEs, remediation compliance velocity, and negative-space coverage alerts.
- **Senior Management Dashboard (`/management`)**: High-level risk appetite gauges, sector-wide compliance scores, and executive governance summaries.

---

## 10. Frontend Build & Responsive Layout

- **Next.js Production Build**: 44 routes compiled with 0 TypeScript and 0 lint errors.
- **Breakpoints Tested**:
  - Desktop (1440px): Full sidebar navigation, data tables with pagination.
  - Laptop (1280px): Collapsible drawer menus, responsive charts.
  - Tablet (768px): Responsive grid stacks, modal viewports.
  - Mobile (390px): Single-column flex layout, drawer drawer-sheets, horizontal table scrolling.
