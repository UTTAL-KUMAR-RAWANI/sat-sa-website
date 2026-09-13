# SAT-SA Platform: Presentation Demo Scenarios & Script

This guide provides a step-by-step presentation script for demonstrating the **SAT-SA (Supervisory Assessment & Threat Platform)** prototype to academic evaluators, hackathon judges (e.g., Smart India Hackathon / SIH), or cybersecurity regulatory panels.

---

## 1. Demo Credentials Quick Reference

All demo accounts share the standard password: **`DemoPassword123!`**.
On the login screen (`/login`), click the quick-fill chips to automatically populate credentials.

| Role | Email | Department | Primary Focus in Demo |
|---|---|---|---|
| **SOC Analyst** | `soc@sat-sa.local` | Operations | Incident intake, alert triage, CSE escalation |
| **Remediation Owner** | `remediation@sat-sa.local` | Operations | Executing corrective actions, uploading fix evidence |
| **Authorized Assessor** | `assessor@sat-sa.local` | Assessment / Audit | Conducting audits, submitting control findings |
| **Auditor Reviewer** | `auditor@sat-sa.local` | Assessment / Audit | Reviewing assessments, validating remediation evidence |
| **GRC/Risk Officer** | `grc@sat-sa.local` | Security | Risk scoring, risk treatments, policy exceptions |
| **Supervision Analyst** | `supervision.analyst@sat-sa.local` | Supervision | Sector oversight, formulating supervisory recommendations |
| **Supervision Authority** | `supervision.auth@sat-sa.local` | Supervision | Issuing binding directives & regulatory decisions |
| **CISO** | `ciso@sat-sa.local` | Security | Strategic posture, risk velocity, telemetry health |
| **Senior Management** | `mgmt@sat-sa.local` | Security | High-level risk appetite, governance oversight |
| **CSE Administrator** | `admin@sat-sa.local` | Administration | RBAC governance, audit trails, system status |

---

## 2. Step-by-Step Presentation Script (17 Milestones)

### Part I: Incident to Regulatory Supervision (The Connected Chain)

#### Step 1: Login as SOC Analyst
- **URL**: `/login`
- Click the **"SOC Lead"** button (`soc@sat-sa.local`).
- Explain: *"SAT-SA enforces role-based access control with scoped data visibility at the entity, sector, and national supervisory levels."*

#### Step 2: Show Role-Based Operations Dashboard
- **URL**: `/dashboard`
- Note the role-tailored KPIs: Active Alerts, In-Progress Incidents, and My Assigned Tasks.

#### Step 3: Triage Security Alert to Formal Incident
- **URL**: `/alerts`
- Select **`ALT-2026-00001`** (*Data Exfiltration Alert: Core Banking Gateway*).
- Demonstrate the alert details, payload metadata, and triage notes.
- Show the link leading to **`CSE-2026-00001`** (*Core Banking Unauthorized Data Egress*).

#### Step 4: Open Incident Investigation & Review Forensic Evidence
- **URL**: `/investigations`
- Select **`INV-2026-00001`**.
- Show the timeline of forensic evidence: Network egress PCAP, memory dump hash, and host baseline logs.

#### Step 5: Trace Incident Finding
- **URL**: `/findings`
- Select **`FND-2026-00001`** (*Unrestricted Outbound Data Flow via Legacy Gateway*).
- Highlight: *"Findings aren't isolated tickets; they link directly back to the originating CSE and forward to enterprise risk."*

#### Step 6: Evaluate Risk Scoring Matrix
- **URL**: `/risks`
- Select **`RSK-2026-00001`** (*Core Banking Exfiltration Risk*).
- Point out the quantitative impact x likelihood risk score and treatment strategy (`MITIGATE`).

#### Step 7: Review Corrective Remediation
- **URL**: `/remediations`
- Select **`REM-2026-00001`** (*Implement Egress Filtering and Zero-Trust Proxy*).
- Show owner assignment (`remediation@sat-sa.local`) and implementation milestone steps.

#### Step 8: Separation of Duties (Validation)
- Log out and log in as **`auditor@sat-sa.local`**.
- Return to **`REM-2026-00001`** and view the Evidence tab.
- Explain: *"Separation of Duties prevents the remediation owner from self-validating. Only an independent auditor or validator can verify the corrective fix."*

#### Step 9: Sector Supervisory Case Oversight
- Log out and log in as **`supervision.analyst@sat-sa.local`**.
- **URL**: `/supervision/cases`
- Select **`SUP-2026-00001`** (*Regulatory Supervisory Review: NCB Core Egress Breach*).
- Review the analyst recommendation recommending formal corrective directives.

#### Step 10: Authority Final Binding Decision
- Log out and log in as **`supervision.auth@sat-sa.local`**.
- **URL**: `/supervision/decisions`
- Select **`DEC-2026-00001`** (*Mandatory Egress Controls & Regulatory Penalty Consideration*).
- Explain: *"Only the Supervision Authority has the statutory role to execute binding directives, maintaining strict separation between recommendation and decision."*

---

### Part II: Assessment & Audit Lifecycle

#### Step 11: Assessment & Audit Review
- Log in as **`assessor@sat-sa.local`**.
- **URL**: `/assessments`
- Select **`ASM-2026-00001`** (*Q3 Financial Infrastructure Cyber Resilience Audit*).
- Show control evaluations (NIST CSF / ISO 27001 mapping) and the full lifecycle:
  `DRAFT → SUBMITTED → UNDER REVIEW → CHANGES REQUESTED → APPROVED`.

---

### Part III: Data Telemetry & Negative-Space Detection

#### Step 12: Telemetry Dataset Ingestion
- **URL**: `/datasets`
- Click **"Upload Dataset"** (`/datasets/upload`).
- Show the 6-step ingestion pipeline: Upload → Schema Detection → Column Mapping → Validation → Ingestion → Dossier.

#### Step 13: 4-Pillar Quality Scoring & Telemetry Analytics
- **URL**: `/datasets` → Select **`DS-2026-00001`**.
- Review the deterministic quality score (Validity, Completeness, Conformity, Uniqueness).
- Explore the interactive Recharts visualizations: Severity distribution, event categories, time series line chart, and top originating source IPs.

#### Step 14: Negative-Space Assessment & Detection Gaps
- **URL**: `/negative-space`
- Explain the foundational concept:
  > *"Traditional SOC tools look for signatures of known malicious events. Negative-space analysis compares expected behavioral patterns against actual observed telemetry to detect silent omissions—such as telemetry outages or disabled audit logging."*
- Review the signal cards labeled **"Potential Detection Gap"** (emphasize safe, non-hallucinatory terminology).

---

### Part IV: Executive Oversight & Governance

#### Step 15: CISO Executive Dashboard
- Log in as **`ciso@sat-sa.local`**.
- **URL**: `/ciso`
- Show real-time KPI aggregations calculated directly from database records:
  - Critical incident count
  - High/Critical risk count
  - Remediation SLA compliance velocity
  - Telemetry monitoring coverage status

#### Step 16: Senior Management Governance Dashboard
- Log in as **`mgmt@sat-sa.local`**.
- **URL**: `/management`
- Show macro-level posture indicators, sector comparison gauges, and executive action summaries.

#### Step 17: Platform Activity Timeline & Notifications
- **URL**: `/notifications` and `/my-work`
- Show real-time system notifications for task assignments, review requests, and approvals.
- **URL**: `/admin/audit-logs` (as `admin@sat-sa.local`)
- Demonstrate the tamper-evident audit trail capturing *who, what, when, before-state, and after-state*.

---

## 3. Presentation Summary Takeaway

When concluding the presentation, emphasize:
1. **Unified Relational Pipeline**: SAT-SA is **not** a loose set of disconnected dashboards; an operational security alert flows through investigations, findings, risk calculations, remediations, and regulatory decisions with complete foreign-key traceability.
2. **Strict Backend Authorization**: Security is enforced at the API and database levels, ensuring strict tenant isolation and Separation of Duties.
3. **Realistic, Explainable Analytics**: Quality scoring and negative-space evaluations rely on deterministic mathematical rules without opaque or misleading ML claims.
