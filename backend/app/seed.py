import logging
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.identity import Department, Role, Permission, User, UserRole, RolePermission
from app.models.organization import Sector, Organization
from app.models.workflow import Escalation
from app.models.supervision import SupervisoryCase, SupervisoryDecision
from app.core.security import get_password_hash
from app.core.config import settings
from app.rbac.permissions import ALL_PERMISSIONS
from app.rbac.mappings import ROLE_DEFINITIONS, DEPARTMENTS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_DEMO_PASSWORD = "DemoPassword123!"

DEMO_USERS = [
    {
        "email": "admin@sat-sa.local",
        "username": "admin_user",
        "first_name": "System",
        "last_name": "Administrator",
        "role": "CSE Administrator",
        "department": "CSE Administrator",
        "organization": None,
        "sector": None
    },
    {
        "email": "soc@sat-sa.local",
        "username": "soc_analyst",
        "first_name": "Sarah",
        "last_name": "Connor",
        "role": "SOC Analyst",
        "department": "Operations",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
    {
        "email": "supervision.analyst@sat-sa.local",
        "username": "sup_analyst",
        "first_name": "Alex",
        "last_name": "Vance",
        "role": "Supervision Analyst",
        "department": "Supervision",
        "organization": None,
        "sector": "Financial Services"
    },
    {
        "email": "supervision.auth@sat-sa.local",
        "username": "sup_authority",
        "first_name": "Marcus",
        "last_name": "Aurelius",
        "role": "Supervision Authority",
        "department": "Supervision",
        "organization": None,
        "sector": "Financial Services"
    },
    {
        "email": "sector.auth@sat-sa.local",
        "username": "sector_authority",
        "first_name": "Elena",
        "last_name": "Rostova",
        "role": "Sector Security Authority",
        "department": "Supervision",
        "organization": None,
        "sector": "Financial Services"
    },
    {
        "email": "assessor@sat-sa.local",
        "username": "auth_assessor",
        "first_name": "Alice",
        "last_name": "Morgan",
        "role": "Authorized Assessor",
        "department": "Assessment / Audit",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
    {
        "email": "auditor@sat-sa.local",
        "username": "audit_reviewer",
        "first_name": "Arthur",
        "last_name": "Dent",
        "role": "Auditor Reviewer",
        "department": "Assessment / Audit",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
    {
        "email": "grc@sat-sa.local",
        "username": "grc_officer",
        "first_name": "Grace",
        "last_name": "Hopper",
        "role": "GRC/Risk Officer",
        "department": "Security",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
    {
        "email": "remediation@sat-sa.local",
        "username": "remediation_owner",
        "first_name": "Robert",
        "last_name": "Oppen",
        "role": "Remediation Owner",
        "department": "Operations",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
    {
        "email": "ciso@sat-sa.local",
        "username": "chief_iso",
        "first_name": "Claire",
        "last_name": "Redfield",
        "role": "CISO",
        "department": "Security",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
    {
        "email": "mgmt@sat-sa.local",
        "username": "senior_mgmt",
        "first_name": "Gordon",
        "last_name": "Gekko",
        "role": "Senior Management",
        "department": "Security",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
    {
        "email": "it_infra@sat-sa.local",
        "username": "it_infra",
        "first_name": "Ian",
        "last_name": "Torvalds",
        "role": "IT Infrastructure Team",
        "department": "Operations",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
    {
        "email": "control_owner@sat-sa.local",
        "username": "ctrl_owner",
        "first_name": "Catherine",
        "last_name": "Nakamoto",
        "role": "Control Owner",
        "department": "Operations",
        "organization": "National Central Bank",
        "sector": "Financial Services"
    },
]

def seed_data():
    db = SessionLocal()
    try:
        # 1. Seed Organizations
        orgs_dict = {}
        orgs_to_create = [
            ("National Central Bank", "Central Banking Organization"),
            ("Apex Power Grid", "Power and Energy Grid Entity")
        ]
        for name, desc in orgs_to_create:
            org = db.query(Organization).filter(Organization.name == name).first()
            if not org:
                org = Organization(name=name, description=desc)
                db.add(org)
                db.flush()
            orgs_dict[name] = org

        # 2. Seed Sectors
        sectors_dict = {}
        sectors_to_create = [
            ("Financial Services", "Financial Services Sector", orgs_dict["National Central Bank"].id),
            ("Energy & Utilities", "Energy & Utilities Sector", orgs_dict["Apex Power Grid"].id)
        ]
        for name, desc, org_id in sectors_to_create:
            sector = db.query(Sector).filter(Sector.name == name).first()
            if not sector:
                sector = Sector(name=name, description=desc, organization_id=org_id)
                db.add(sector)
                db.flush()
            sectors_dict[name] = sector

        # 3. Seed Departments
        depts_dict = {}
        for dept_name in DEPARTMENTS:
            dept = db.query(Department).filter(Department.name == dept_name).first()
            if not dept:
                dept = Department(name=dept_name, description=f"{dept_name} Department")
                db.add(dept)
                db.flush()
            depts_dict[dept_name] = dept

        # 4. Seed Granular Permissions
        perms_dict = {}
        for perm_name in ALL_PERMISSIONS:
            perm = db.query(Permission).filter(Permission.name == perm_name).first()
            if not perm:
                perm = Permission(name=perm_name, description=f"Permission to {perm_name}")
                db.add(perm)
                db.flush()
            perms_dict[perm_name] = perm

        # 5. Seed Roles and Role-Permission Mappings
        roles_dict = {}
        for role_name, role_info in ROLE_DEFINITIONS.items():
            scope_val = role_info["scope"].value if hasattr(role_info["scope"], "value") else str(role_info["scope"])
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(
                    name=role_name,
                    description=role_info["description"],
                    scope_type=scope_val,
                    is_active=True
                )
                db.add(role)
                db.flush()
            else:
                role.scope_type = scope_val
                role.description = role_info["description"]
                db.flush()
            roles_dict[role_name] = role

            # Attach permissions
            current_perms = set(p.name for p in role.permissions)
            for perm_name in role_info["permissions"]:
                if perm_name in perms_dict and perm_name not in current_perms:
                    role.permissions.append(perms_dict[perm_name])
            db.flush()

        # 6. Seed Demo Users
        hashed_password = get_password_hash(DEFAULT_DEMO_PASSWORD)

        for udata in DEMO_USERS:
            user = db.query(User).filter(User.email == udata["email"]).first()
            dept = depts_dict.get(udata["department"])
            org = orgs_dict.get(udata["organization"]) if udata["organization"] else None
            sec = sectors_dict.get(udata["sector"]) if udata["sector"] else None
            role = roles_dict.get(udata["role"])

            if not user:
                user = User(
                    email=udata["email"],
                    username=udata["username"],
                    first_name=udata["first_name"],
                    last_name=udata["last_name"],
                    password_hash=hashed_password,
                    is_active=True,
                    department_id=dept.id if dept else None,
                    organization_id=org.id if org else None,
                    sector_id=sec.id if sec else None
                )
                db.add(user)
                db.flush()
            else:
                user.department_id = dept.id if dept else None
                user.organization_id = org.id if org else None
                user.sector_id = sec.id if sec else None
                db.flush()

            # Ensure role assignment
            if role and role not in user.roles:
                user.roles.append(role)
            db.flush()

        # Also support settings.DEMO_ADMIN_EMAIL (admin@sat-sa.com) as admin demo user
        admin_alias = db.query(User).filter(User.email == settings.DEMO_ADMIN_EMAIL).first()
        admin_role = roles_dict.get("CSE Administrator")
        admin_dept = depts_dict.get("CSE Administrator")
        if not admin_alias:
            admin_alias = User(
                email=settings.DEMO_ADMIN_EMAIL,
                username="admin",
                first_name="Demo",
                last_name="Admin",
                password_hash=get_password_hash(settings.DEMO_ADMIN_PASSWORD),
                is_active=True,
                department_id=admin_dept.id if admin_dept else None
            )
            db.add(admin_alias)
            db.flush()
        if admin_role and admin_role not in admin_alias.roles:
            admin_alias.roles.append(admin_role)

        # 7. Seed System Settings
        settings_to_seed = [
            ("platform.name", "SAT-SA Cyber Supervision Platform", "Platform", "Official name of the platform deployment", False),
            ("platform.environment", "Demonstration / Staging", "Platform", "Current runtime environment tier", False),
            ("security.session_timeout_minutes", "60", "Security", "JWT bearer token validity duration in minutes", False),
            ("security.mfa_enforced", "false", "Security", "Enforce Multi-Factor Authentication for all administrative sessions", False),
            ("security.password_min_length", "12", "Security", "Minimum required characters for user passwords", False),
            ("notifications.email_alerts_enabled", "true", "Notifications", "Dispatch high-priority event alerts via SMTP gateway", False),
            ("notifications.digest_frequency", "daily", "Notifications", "Supervisory aggregation digest interval", False),
            ("retention.audit_log_days", "365", "Retention", "Statutory retention duration for immutable audit trails", False),
            ("retention.evidence_archive_days", "730", "Retention", "Archival period for investigation evidence artifacts", False),
            ("system.maintenance_mode", "false", "System", "Temporary administrative lockdown mode", False),
        ]
        from app.models.system import SystemSetting
        from app.models.access import AccessRequest

        for key, val, cat, desc, is_sec in settings_to_seed:
            s_obj = db.query(SystemSetting).filter(SystemSetting.key == key).first()
            if not s_obj:
                s_obj = SystemSetting(key=key, value=val, category=cat, description=desc, is_secret=is_sec)
                db.add(s_obj)

        # 8. Seed Sample Access Requests for development/demo
        soc_user = db.query(User).filter(User.email == "soc@sat-sa.local").first()
        grc_role = roles_dict.get("GRC/Risk Officer")
        ncb_org = orgs_dict.get("National Central Bank")
        apex_org = orgs_dict.get("Apex Power Grid")
        fin_sec = sectors_dict.get("Financial Services")
        energy_sec = sectors_dict.get("Energy & Utilities")

        if soc_user and grc_role:
            existing_req = db.query(AccessRequest).filter(
                AccessRequest.requester_id == soc_user.id,
                AccessRequest.requested_role_id == grc_role.id
            ).first()
            if not existing_req:
                sample_req = AccessRequest(
                    requester_id=soc_user.id,
                    requested_role_id=grc_role.id,
                    requested_organization_id=ncb_org.id if ncb_org else None,
                    requested_sector_id=fin_sec.id if fin_sec else None,
                    status="PENDING",
                    reason="Requesting secondary role assignment to assist in financial risk assessments and control compliance."
                )
                db.add(sample_req)

        # 9. Seed Security Operations (Events, Alerts, CSE, Investigation, Evidence, Escalation)
        from app.models.security import SecurityEvent, Alert, CSE, Investigation, Evidence
        from app.models.workflow import WorkflowTransition, Assignment, Escalation

        sup_auth_role = roles_dict.get("Supervision Authority")
        sup_auth_user = db.query(User).filter(User.email == "supervision.auth@sat-sa.local").first()

        # Security Events
        sec_evt_1 = db.query(SecurityEvent).filter(SecurityEvent.business_id == "SEC-2026-00001").first()
        if not sec_evt_1:
            sec_evt_1 = SecurityEvent(
                business_id="SEC-2026-00001",
                title="Abnormal outbound encrypted tunnel from Core Banking API Gateway",
                description="Network sensor detected high-entropy TLS session to anomalous ASN 48325 over non-standard port 8443.",
                event_type="DATA_EXFILTRATION",
                source="NETWORK_SENSOR",
                source_system="Zeek Network Monitor",
                severity="CRITICAL",
                organization_id=ncb_org.id if ncb_org else None,
                sector_id=fin_sec.id if fin_sec else None,
                raw_metadata={"dest_ip": "198.51.100.44", "dest_port": 8443, "bytes_transferred": 52428800}
            )
            db.add(sec_evt_1)
            db.flush()

        sec_evt_2 = db.query(SecurityEvent).filter(SecurityEvent.business_id == "SEC-2026-00002").first()
        if not sec_evt_2:
            sec_evt_2 = SecurityEvent(
                business_id="SEC-2026-00002",
                title="Repeated failed authentications against SCADA Front-End Processor",
                description="Over 400 failed SSH authentication attempts from internal jump host in 3 minutes.",
                event_type="BRUTE_FORCE",
                source="EDR",
                source_system="CrowdStrike Falcon",
                severity="MEDIUM",
                organization_id=apex_org.id if apex_org else None,
                sector_id=energy_sec.id if energy_sec else None,
                raw_metadata={"target_host": "scada-fep-01.grid.local", "failed_attempts": 412}
            )
            db.add(sec_evt_2)
            db.flush()

        # Alerts
        alt_1 = db.query(Alert).filter(Alert.business_id == "ALT-2026-00001").first()
        if not alt_1:
            alt_1 = Alert(
                business_id="ALT-2026-00001",
                title="Data Exfiltration Alert: Core Banking Gateway",
                description="Continuous large payload stream directed to external endpoint outside regulated geofence.",
                severity="HIGH",
                priority="P1",
                status="TRIAGED",
                source="SIEM",
                security_event_id=sec_evt_1.id if sec_evt_1 else None,
                organization_id=ncb_org.id if ncb_org else None,
                sector_id=fin_sec.id if fin_sec else None,
                assigned_to_id=soc_user.id if soc_user else None,
                triage_notes="Confirmed unauthorized egress connection; endpoint process injected. Escalating to formal CSE.",
                triage_decision="CONFIRMED_SECURITY_EVENT",
                triaged_by_id=soc_user.id if soc_user else None,
                triaged_at=datetime.now(timezone.utc)
            )
            db.add(alt_1)
            db.flush()

        alt_2 = db.query(Alert).filter(Alert.business_id == "ALT-2026-00002").first()
        if not alt_2:
            alt_2 = Alert(
                business_id="ALT-2026-00002",
                title="SCADA Gateway Authentication Spikes",
                description="High rate of authentication failures detected on energy substation gateway.",
                severity="MEDIUM",
                priority="P2",
                status="NEW",
                source="SIEM",
                security_event_id=sec_evt_2.id if sec_evt_2 else None,
                organization_id=apex_org.id if apex_org else None,
                sector_id=energy_sec.id if energy_sec else None
            )
            db.add(alt_2)
            db.flush()

        # CSE
        cse_1 = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
        if not cse_1:
            cse_1 = CSE(
                business_id="CSE-2026-00001",
                title="Active Data Exfiltration Incident on Core Banking Gateway",
                description="Investigating confirmed exfiltration of encrypted financial records through compromised gateway server.",
                severity="CRITICAL",
                priority="P1",
                status="INVESTIGATING",
                source="ALERT",
                organization_id=ncb_org.id if ncb_org else None,
                sector_id=fin_sec.id if fin_sec else None,
                created_by_id=soc_user.id if soc_user else None,
                assigned_to_id=soc_user.id if soc_user else None
            )
            db.add(cse_1)
            db.flush()
            if alt_1:
                alt_1.cse_id = cse_1.id

            # Transitions & Assignments
            db.add(WorkflowTransition(
                resource_type="CSE",
                resource_id=cse_1.id,
                from_state="NEW",
                to_state="TRIAGED",
                actor_id=soc_user.id if soc_user else None,
                reason="Alert ALT-2026-00001 triage confirmed security incident."
            ))
            db.add(WorkflowTransition(
                resource_type="CSE",
                resource_id=cse_1.id,
                from_state="TRIAGED",
                to_state="INVESTIGATING",
                actor_id=soc_user.id if soc_user else None,
                reason="Formal investigation INV-2026-00001 launched."
            ))
            if soc_user:
                db.add(Assignment(
                    resource_type="CSE",
                    resource_id=cse_1.id,
                    assigned_to_id=soc_user.id,
                    assigned_by_id=soc_user.id,
                    assignment_type="LEAD",
                    status="ACTIVE",
                    notes="Primary incident lead assigned for containment and forensic extraction."
                ))

        # Investigation
        inv_1 = db.query(Investigation).filter(Investigation.business_id == "INV-2026-00001").first()
        if not inv_1 and cse_1:
            inv_1 = Investigation(
                business_id="INV-2026-00001",
                title="Gateway Endpoint Memory & Network Forensic Analysis",
                description="Volatile memory capture and packet inspection to identify C2 beacon frequency and exfiltrated payloads.",
                status="IN_PROGRESS",
                cse_id=cse_1.id,
                lead_analyst_id=soc_user.id if soc_user else None,
                started_at=datetime.now(timezone.utc),
                findings_summary="Observed DLL injection inside java.exe worker process. C2 IP mapped to known threat group infrastructure."
            )
            db.add(inv_1)
            db.flush()

        # Evidence
        evd_1 = db.query(Evidence).filter(Evidence.business_id == "EVD-2026-00001").first()
        if not evd_1 and cse_1 and inv_1:
            evd_1 = Evidence(
                business_id="EVD-2026-00001",
                title="PCAP Network Flow Dump - Session 8443",
                description="Network packet capture containing TLS handshake metadata and anomalous packet sizes.",
                evidence_type="LOG",
                source="NETWORK_TAP",
                filename="core_banking_egress_8443.pcap",
                content_type="application/vnd.tcpdump.pcap",
                file_size=1048576,
                checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                uploaded_by_id=soc_user.id if soc_user else None,
                cse_id=cse_1.id,
                investigation_id=inv_1.id
            )
            db.add(evd_1)

        # Escalation
        esc_1 = db.query(Escalation).filter(Escalation.business_id == "ESC-2026-00001").first()
        if not esc_1 and cse_1:
            esc_1 = Escalation(
                business_id="ESC-2026-00001",
                resource_type="CSE",
                resource_id=cse_1.id,
                reason="Potential systemic exposure to inter-bank clearing interfaces; notifying Supervisory Authority for cross-entity impact assessment.",
                severity="CRITICAL",
                status="OPEN",
                escalated_by_id=soc_user.id if soc_user else None,
                escalated_to_role_id=sup_auth_role.id if sup_auth_role else None,
                escalated_to_id=sup_auth_user.id if sup_auth_user else None
            )
            db.add(esc_1)

        # 10. Seed Connected Findings, Controls, and Review Comments
        from app.models.finding import Finding, FindingComment
        from app.models.control import Control
        from datetime import timedelta

        auditor_user = db.query(User).filter(User.email == "auditor@sat-sa.local").first()
        sup_analyst_user = db.query(User).filter(User.email == "supervision.analyst@sat-sa.local").first()
        grc_user = db.query(User).filter(User.email == "grc@sat-sa.local").first()

        # Seed Controls
        ctrl_1 = db.query(Control).filter(Control.business_id == "CTRL-2026-00001").first()
        if not ctrl_1:
            ctrl_1 = Control(
                business_id="CTRL-2026-00001",
                name="AC-02: Account Management & Session Validation",
                description="Controls governing the lifecycle, issuance, revocation, and cryptographical validation of administrative session credentials.",
                category="Access Control",
                status="IMPLEMENTED",
                owner_id=grc_user.id if grc_user else None,
                organization_id=ncb_org.id if ncb_org else None,
                sector_id=fin_sec.id if fin_sec else None
            )
            db.add(ctrl_1)
            db.flush()

        ctrl_2 = db.query(Control).filter(Control.business_id == "CTRL-2026-00002").first()
        if not ctrl_2:
            ctrl_2 = Control(
                business_id="CTRL-2026-00002",
                name="SC-07: Boundary Protection & Egress Filtering",
                description="Firewall rules and boundary monitoring mechanisms that regulate and restrict outbound communications to verified destinations.",
                category="System and Communications Protection",
                status="DEGRADED",
                owner_id=grc_user.id if grc_user else None,
                organization_id=ncb_org.id if ncb_org else None,
                sector_id=fin_sec.id if fin_sec else None
            )
            db.add(ctrl_2)
            db.flush()

        now_utc = datetime.now(timezone.utc)

        # Finding 1: Connected to Investigation INV-2026-00001 & CSE-2026-00001
        fnd_1 = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
        if not fnd_1 and cse_1 and inv_1:
            fnd_1 = Finding(
                business_id="FND-2026-00001",
                title="Unauthorized Administrative Access Token Generated via Stolen Session",
                description="Forensic artifact analysis during investigation INV-2026-00001 identified an administrative token forged through session reuse on Core Banking API Gateway.",
                severity="HIGH",
                priority="URGENT",
                status="REVIEW",
                classification="Security",
                source_type="INVESTIGATION",
                source_id=inv_1.id,
                cse_id=cse_1.id,
                investigation_id=inv_1.id,
                control_id=ctrl_1.id if ctrl_1 else None,
                organization_id=ncb_org.id if ncb_org else None,
                sector_id=fin_sec.id if fin_sec else None,
                created_by_id=soc_user.id if soc_user else None,
                assigned_to_id=auditor_user.id if auditor_user else None,
                assigned_by_id=soc_user.id if soc_user else None,
                assigned_at=now_utc - timedelta(days=1),
                due_date=now_utc + timedelta(days=5),
                remediation_required=False
            )
            db.add(fnd_1)
            db.flush()

            # Attach evidence 1 to finding 1
            if evd_1:
                evd_1.finding_id = fnd_1.id

            # Add comments
            if soc_user:
                db.add(FindingComment(
                    finding_id=fnd_1.id,
                    author_id=soc_user.id,
                    comment="Discovered volatile memory dump showing DLL injection inside java.exe. Submitting finding for formal review.",
                    comment_type="REVIEW_NOTE"
                ))

            # Transitions
            db.add(WorkflowTransition(
                resource_type="FINDING",
                resource_id=fnd_1.id,
                from_state="IDENTIFIED",
                to_state="SUBMITTED",
                actor_id=soc_user.id if soc_user else None,
                reason="Submitted for formal audit/supervisory review"
            ))
            db.add(WorkflowTransition(
                resource_type="FINDING",
                resource_id=fnd_1.id,
                from_state="SUBMITTED",
                to_state="REVIEW",
                actor_id=auditor_user.id if auditor_user else (soc_user.id if soc_user else None),
                reason="Independent review commenced"
            ))

        # Finding 2: Connected to CSE-2026-00001, Confirmed, Remediation Required, Overdue
        fnd_2 = db.query(Finding).filter(Finding.business_id == "FND-2026-00002").first()
        if not fnd_2 and cse_1:
            fnd_2 = Finding(
                business_id="FND-2026-00002",
                title="Unrestricted Outbound C2 Traffic Permitted by Perimeter Firewall Policy",
                description="Perimeter firewall policy failed to inspect or throttle high-bandwidth outbound TCP streams on non-standard port 8443, enabling data exfiltration.",
                severity="CRITICAL",
                priority="URGENT",
                status="CONFIRMED",
                classification="Control Deficiency",
                source_type="CSE",
                source_id=cse_1.id,
                cse_id=cse_1.id,
                control_id=ctrl_2.id if ctrl_2 else None,
                organization_id=ncb_org.id if ncb_org else None,
                sector_id=fin_sec.id if fin_sec else None,
                created_by_id=soc_user.id if soc_user else None,
                assigned_to_id=auditor_user.id if auditor_user else None,
                assigned_by_id=soc_user.id if soc_user else None,
                assigned_at=now_utc - timedelta(days=7),
                due_date=now_utc - timedelta(days=2),  # OVERDUE
                remediation_required=True
            )
            db.add(fnd_2)
            db.flush()

            if auditor_user:
                db.add(FindingComment(
                    finding_id=fnd_2.id,
                    author_id=auditor_user.id,
                    comment="Egress gap confirmed. Remediation required immediately to reconfigure stateful packet inspection on gateway.",
                    comment_type="DECISION_NOTE"
                ))

            db.add(WorkflowTransition(
                resource_type="FINDING",
                resource_id=fnd_2.id,
                from_state="REVIEW",
                to_state="CONFIRMED",
                actor_id=auditor_user.id if auditor_user else None,
                reason="Confirmed by independent review; remediation mandated"
            ))

        # Finding 3: Supervisory Review Finding
        fnd_3 = db.query(Finding).filter(Finding.business_id == "FND-2026-00003").first()
        if not fnd_3:
            fnd_3 = Finding(
                business_id="FND-2026-00003",
                title="Weak Multi-Factor Authentication Bypass Mechanism on Customer Portal",
                description="Supervisory observation identified SMS OTP fallback without rate-limiting or SIM swap detection.",
                severity="MEDIUM",
                priority="HIGH",
                status="IDENTIFIED",
                classification="Supervisory",
                source_type="SUPERVISORY_REVIEW",
                organization_id=ncb_org.id if ncb_org else None,
                sector_id=fin_sec.id if fin_sec else None,
                created_by_id=sup_analyst_user.id if sup_analyst_user else None,
                assigned_to_id=soc_user.id if soc_user else None,
                assigned_at=now_utc,
                due_date=now_utc + timedelta(days=14),
                remediation_required=False
            )
            db.add(fnd_3)

        # Finding 4: Apex Power Grid (Different Org / Sector) for Scope Isolation Testing
        fnd_4 = db.query(Finding).filter(Finding.business_id == "FND-2026-00004").first()
        if not fnd_4:
            admin_user = db.query(User).filter(User.email == "admin@sat-sa.local").first()
            fnd_4 = Finding(
                business_id="FND-2026-00004",
                title="Unencrypted SCADA Telemetry Archive in Public Cloud Storage",
                description="Substation operational telemetry snapshot was stored in an unencrypted object storage bucket.",
                severity="HIGH",
                priority="URGENT",
                status="DRAFT",
                classification="Compliance",
                source_type="AUDIT",
                organization_id=apex_org.id if apex_org else None,
                sector_id=energy_sec.id if energy_sec else None,
                created_by_id=admin_user.id if admin_user else None,
                due_date=now_utc + timedelta(days=7),
                remediation_required=False
            )
            db.add(fnd_4)

        db.commit()
        print("Connected Findings seed data successfully inserted.")

        # 11. Seed Connected Assessments, Controls, Evidence Verification, and Approvals
        from app.models.assessment import Assessment, AssessmentControl
        from app.models.workflow import Approval

        assessor_user = db.query(User).filter(User.email == "assessor@sat-sa.local").first()
        auditor_user = db.query(User).filter(User.email == "auditor@sat-sa.local").first()
        admin_user = db.query(User).filter(User.email == "admin@sat-sa.local").first()

        # Assessment 1: Core Banking Egress Security Control Assessment (Under Review)
        asm_1 = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00001").first()
        if not asm_1 and ncb_org and fin_sec:
            asm_1 = Assessment(
                business_id="ASM-2026-00001",
                title="Core Banking Egress Security Control Assessment",
                description="Comprehensive evaluation of outbound egress controls, perimeter boundary filtering, and multi-factor authentication on Core Banking gateways following incident CSE-2026-00001.",
                assessment_type="SECURITY_CONTROL_ASSESSMENT",
                status="UNDER_REVIEW",
                priority="HIGH",
                scope="Core banking application server cluster, egress gateways, and privileged access mechanisms.",
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                cse_id=cse_1.id if cse_1 else None,
                investigation_id=inv_1.id if inv_1 else None,
                assessor_id=assessor_user.id if assessor_user else None,
                reviewer_id=auditor_user.id if auditor_user else None,
                created_by_id=assessor_user.id if assessor_user else None,
                start_date=now_utc - timedelta(days=4),
                due_date=now_utc + timedelta(days=10),
                submitted_date=now_utc - timedelta(days=1)
            )
            db.add(asm_1)
            db.flush()

            # Attach Controls to Assessment 1
            if ctrl_1:
                ac_1 = AssessmentControl(
                    assessment_id=asm_1.id,
                    control_id=ctrl_1.id,
                    evaluator_id=assessor_user.id if assessor_user else None,
                    status="EVALUATED",
                    effectiveness="PARTIALLY_EFFECTIVE",
                    evaluation_notes="MFA enforced on external portal but secondary jump host lacked mandatory hardware tokens.",
                    evidence_required=True,
                    evidence_submitted=True,
                    evidence_verified=False,
                    finding_id=fnd_1.id if fnd_1 else None,
                    evaluated_at=now_utc - timedelta(days=2)
                )
                db.add(ac_1)

            if ctrl_2:
                ac_2 = AssessmentControl(
                    assessment_id=asm_1.id,
                    control_id=ctrl_2.id,
                    evaluator_id=assessor_user.id if assessor_user else None,
                    status="EVALUATED",
                    effectiveness="INEFFECTIVE",
                    evaluation_notes="Unrestricted egress on TCP port 443 allowed encrypted data exfiltration to external IP.",
                    reviewer_comments="Auditor verified firewall logs confirm rule deficiency.",
                    evidence_required=True,
                    evidence_submitted=True,
                    evidence_verified=True,
                    evaluated_at=now_utc - timedelta(days=2),
                    reviewed_at=now_utc - timedelta(hours=6)
                )
                db.add(ac_2)

            # Link Evidence EVD-2026-00001
            if evd_1:
                evd_1.assessment_id = asm_1.id
                evd_1.control_id = ctrl_2.id if ctrl_2 else None
                evd_1.verification_status = "VERIFIED"
                evd_1.verified_by_id = auditor_user.id if auditor_user else None
                evd_1.verified_at = now_utc - timedelta(hours=6)
                evd_1.reviewer_comments = "Checksum and flow records verified against firewall syslog."

            # Link Finding FND-2026-00001
            if fnd_1:
                fnd_1.assessment_id = asm_1.id

            # Record Workflow Transitions
            db.add(WorkflowTransition(
                resource_type="ASSESSMENT",
                resource_id=asm_1.id,
                from_state="DRAFT",
                to_state="ASSIGNED",
                actor_id=admin_user.id if admin_user else None,
                reason="Assigned to Lead Assessor"
            ))
            db.add(WorkflowTransition(
                resource_type="ASSESSMENT",
                resource_id=asm_1.id,
                from_state="ASSIGNED",
                to_state="IN_PROGRESS",
                actor_id=assessor_user.id if assessor_user else None,
                reason="Assessor initiated control testing"
            ))
            db.add(WorkflowTransition(
                resource_type="ASSESSMENT",
                resource_id=asm_1.id,
                from_state="IN_PROGRESS",
                to_state="SUBMITTED",
                actor_id=assessor_user.id if assessor_user else None,
                reason="All controls evaluated; submitted for auditor review"
            ))
            db.add(WorkflowTransition(
                resource_type="ASSESSMENT",
                resource_id=asm_1.id,
                from_state="SUBMITTED",
                to_state="UNDER_REVIEW",
                actor_id=auditor_user.id if auditor_user else None,
                reason="Auditor Reviewer opened assessment review package"
            ))

        # Assessment 2: Jump Host Finding Validation (In Progress)
        asm_2 = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00002").first()
        if not asm_2 and ncb_org and fin_sec:
            asm_2 = Assessment(
                business_id="ASM-2026-00002",
                title="Jump Host Authentication Finding Validation",
                description="Validation of remediated authentication tokens and certificate rotation on secondary jump hosts.",
                assessment_type="FINDING_VALIDATION",
                status="IN_PROGRESS",
                priority="HIGH",
                scope="Validation of secondary jump host authentication tokens.",
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                assessor_id=assessor_user.id if assessor_user else None,
                reviewer_id=auditor_user.id if auditor_user else None,
                created_by_id=assessor_user.id if assessor_user else None,
                start_date=now_utc - timedelta(days=2),
                due_date=now_utc + timedelta(days=8)
            )
            db.add(asm_2)
            db.flush()

            if ctrl_1:
                ac_3 = AssessmentControl(
                    assessment_id=asm_2.id,
                    control_id=ctrl_1.id,
                    evaluator_id=assessor_user.id if assessor_user else None,
                    status="IN_PROGRESS",
                    effectiveness="PARTIALLY_EFFECTIVE",
                    evaluation_notes="Verifying updated RADIUS token policy on host.",
                    evidence_required=True
                )
                db.add(ac_3)

            if fnd_2:
                fnd_2.assessment_id = asm_2.id

        # Assessment 3: Cloud Compliance Assessment (Changes Requested)
        asm_3 = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00003").first()
        if not asm_3 and ncb_org and fin_sec:
            asm_3 = Assessment(
                business_id="ASM-2026-00003",
                title="Quarterly Cloud Infrastructure Compliance Assessment",
                description="Review of ISO 27001 Annex A.12 operational controls in production Kubernetes environments.",
                assessment_type="COMPLIANCE_ASSESSMENT",
                status="CHANGES_REQUESTED",
                priority="MEDIUM",
                scope="Production Kubernetes clusters and object storage configurations.",
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                assessor_id=assessor_user.id if assessor_user else None,
                reviewer_id=auditor_user.id if auditor_user else None,
                created_by_id=assessor_user.id if assessor_user else None,
                due_date=now_utc + timedelta(days=12),
                submitted_date=now_utc - timedelta(days=3)
            )
            db.add(asm_3)
            db.flush()

            db.add(WorkflowTransition(
                resource_type="ASSESSMENT",
                resource_id=asm_3.id,
                from_state="SUBMITTED",
                to_state="CHANGES_REQUESTED",
                actor_id=auditor_user.id if auditor_user else None,
                reason="Auditor requested additional container scan artifacts and IAM role boundary configurations."
            ))

        # Assessment 4: Annual Perimeter Defense Assessment (Approved)
        asm_4 = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00004").first()
        if not asm_4 and ncb_org and fin_sec:
            asm_4 = Assessment(
                business_id="ASM-2026-00004",
                title="Annual Sectoral Perimeter Defense Assessment",
                description="Annual follow-up review for banking perimeter DMZ infrastructure.",
                assessment_type="FOLLOW_UP_ASSESSMENT",
                status="APPROVED",
                priority="LOW",
                scope="Annual baseline validation of boundary firewalls and perimeter load balancers.",
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                assessor_id=assessor_user.id if assessor_user else None,
                reviewer_id=auditor_user.id if auditor_user else None,
                created_by_id=admin_user.id if admin_user else None,
                start_date=now_utc - timedelta(days=20),
                submitted_date=now_utc - timedelta(days=7),
                approved_date=now_utc - timedelta(days=5),
                due_date=now_utc - timedelta(days=6)
            )
            db.add(asm_4)
            db.flush()

            db.add(Approval(
                resource_type="ASSESSMENT",
                resource_id=asm_4.id,
                approver_id=auditor_user.id if auditor_user else None,
                status="APPROVED",
                comments="Annual baseline validation fully compliant with regulatory directives."
            ))

        # Assessment 5: SCADA Substation Telemetry Assessment (Draft, Apex Power Grid / Energy)
        asm_5 = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00005").first()
        if not asm_5 and apex_org and energy_sec:
            asm_5 = Assessment(
                business_id="ASM-2026-00005",
                title="SCADA Substation Telemetry Control Assessment",
                description="Assessment of telemetry protection across regional electrical distribution substations.",
                assessment_type="CSE_ASSESSMENT",
                status="DRAFT",
                priority="URGENT",
                scope="Assessment of telemetry protection across regional electrical distribution substations.",
                organization_id=apex_org.id,
                sector_id=energy_sec.id,
                created_by_id=admin_user.id if admin_user else None,
                due_date=now_utc + timedelta(days=3)
            )
            db.add(asm_5)

        # 12. Seed Connected Risks, Treatments, and Exceptions
        from app.models.risk import Risk, RiskTreatment, RiskException

        ciso_user = db.query(User).filter(User.email == "ciso@sat-sa.local").first()
        grc_user = db.query(User).filter(User.email == "grc@sat-sa.local").first()
        soc_user = db.query(User).filter(User.email == "soc@sat-sa.local").first()
        fnd_1 = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
        fnd_2 = db.query(Finding).filter(Finding.business_id == "FND-2026-00002").first()
        fnd_3 = db.query(Finding).filter(Finding.business_id == "FND-2026-00003").first()
        fnd_4 = db.query(Finding).filter(Finding.business_id == "FND-2026-00004").first()
        asm_1 = db.query(Assessment).filter(Assessment.business_id == "ASM-2026-00001").first()
        cse_1 = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
        inv_1 = db.query(Investigation).filter(Investigation.business_id == "INV-2026-00001").first()
        ctrl_1 = db.query(Control).filter(Control.business_id == "CTRL-2026-00001").first()

        # Risk 1: Critical - Core Banking Credential Compromise & Exfiltration
        rsk_1 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00001").first()
        if not rsk_1 and ncb_org and fin_sec:
            rsk_1 = Risk(
                business_id="RSK-2026-00001",
                title="Critical Credential Compromise & Outbound Exfiltration Risk",
                description="Risk of systemic unauthorized funds transfer resulting from compromised privileged gateway credentials and cleartext key material.",
                category="Cybersecurity",
                source="CSE",
                source_reference="CSE-2026-00001",
                cse_id=cse_1.id if cse_1 else None,
                finding_id=fnd_1.id if fnd_1 else None,
                assessment_id=asm_1.id if asm_1 else None,
                control_id=ctrl_1.id if ctrl_1 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                asset_or_system="Core Banking Inter-Bank Clearing Gateway",
                owner_id=grc_user.id if grc_user else None,
                identified_by_id=soc_user.id if soc_user else None,
                likelihood=4,
                impact=5,
                inherent_score=20,
                inherent_risk_level="CRITICAL",
                existing_controls_description="Perimeter firewall logging, basic egress rate-limiting, and signature-based antivirus.",
                residual_likelihood=3,
                residual_impact=4,
                residual_score=12,
                residual_risk_level="HIGH",
                treatment_strategy="MITIGATE",
                treatment_owner_id=grc_user.id if grc_user else None,
                treatment_target_date=now_utc + timedelta(days=14),
                treatment_description="Enforce hardware-bound FIDO2 authentication on clearing gateways and implement real-time DLP inspection.",
                status="TREATMENT_REQUIRED",
                target_date=now_utc + timedelta(days=14)
            )
            db.add(rsk_1)
            db.flush()

            # Treatment 1 for Risk 1
            trt_1 = db.query(RiskTreatment).filter(RiskTreatment.business_id == "TRT-2026-00001").first()
            if not trt_1:
                trt_1 = RiskTreatment(
                    business_id="TRT-2026-00001",
                    risk_id=rsk_1.id,
                    title="Hardware MFA & Egress TLS Inspection Deployment",
                    description="Mandate PKI-backed hardware tokens for gateway administrative consoles and deploy automated outbound anomaly blocking.",
                    strategy="MITIGATE",
                    status="IN_PROGRESS",
                    mitigation_actions="1. Procure FIDO2 security keys.\n2. Reconfigure gateway RADIUS/IdP federation.\n3. Enable TLS decrypt proxy on DMZ egress.",
                    owner_id=grc_user.id if grc_user else None,
                    created_by_id=grc_user.id if grc_user else None,
                    target_date=now_utc + timedelta(days=14)
                )
                db.add(trt_1)

        # Risk 2: High - Lateral Movement via Secondary Jump Host
        rsk_2 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00002").first()
        if not rsk_2 and ncb_org and fin_sec:
            rsk_2 = Risk(
                business_id="RSK-2026-00002",
                title="Unrestricted Lateral Movement via Legacy Jump Host",
                description="Risk of adversary traversing administrative tiers due to missing multi-factor controls and cached credentials on secondary bastion hosts.",
                category="Access Control",
                source="INVESTIGATION",
                source_reference="INV-2026-00001",
                cse_id=cse_1.id if cse_1 else None,
                finding_id=fnd_2.id if fnd_2 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                asset_or_system="Bastion Management Subnet",
                owner_id=grc_user.id if grc_user else None,
                identified_by_id=soc_user.id if soc_user else None,
                likelihood=3,
                impact=5,
                inherent_score=15,
                inherent_risk_level="HIGH",
                existing_controls_description="SSH key-pair authentication with static user authorization lists.",
                residual_likelihood=2,
                residual_impact=3,
                residual_score=6,
                residual_risk_level="MEDIUM",
                treatment_strategy="MITIGATE",
                treatment_owner_id=grc_user.id if grc_user else None,
                treatment_target_date=now_utc + timedelta(days=30),
                treatment_description="Decommission legacy jump box; transition all administrative access to ephemeral PAM vault with session recording.",
                status="TREATMENT_PLANNED",
                target_date=now_utc + timedelta(days=30)
            )
            db.add(rsk_2)
            db.flush()

        # Risk 3: Medium - Legacy TLS 1.0/1.1 Deprecation Delay (Accepted with Exception)
        rsk_3 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00003").first()
        if not rsk_3 and ncb_org and fin_sec:
            rsk_3 = Risk(
                business_id="RSK-2026-00003",
                title="Legacy TLS 1.0/1.1 Deprecation Delay on Partner Ingress",
                description="Risk of eavesdropping or downgrade attacks on partner communication channels due to delayed protocol upgrade.",
                category="Compliance",
                source="FINDING",
                source_reference="FND-2026-00003",
                finding_id=fnd_3.id if fnd_3 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                asset_or_system="B2B Partner API Gateway",
                owner_id=grc_user.id if grc_user else None,
                identified_by_id=grc_user.id if grc_user else None,
                accepted_by_id=ciso_user.id if ciso_user else None,
                likelihood=2,
                impact=4,
                inherent_score=8,
                inherent_risk_level="MEDIUM",
                existing_controls_description="IP allowlisting and HMAC request payload signing.",
                residual_likelihood=2,
                residual_impact=3,
                residual_score=6,
                residual_risk_level="MEDIUM",
                treatment_strategy="ACCEPT",
                acceptance_justification="Temporary dependency by external government clearing house. Deprecation timeline agreed for Q4. Compensating WAF virtual patching active.",
                accepted_at=now_utc - timedelta(days=3),
                review_date=now_utc + timedelta(days=90),
                status="ACCEPTED",
                target_date=now_utc + timedelta(days=90)
            )
            db.add(rsk_3)
            db.flush()

            # Exception 1 for Risk 3
            exc_1 = db.query(RiskException).filter(RiskException.business_id == "EXP-2026-00001").first()
            if not exc_1:
                exc_1 = RiskException(
                    business_id="EXP-2026-00001",
                    risk_id=rsk_3.id,
                    title="Temporary Protocol Waiver for Legacy Ingress Ciphers",
                    justification="Required to maintain critical inter-agency settlement messages until clearing house deploys TLS 1.3 endpoints.",
                    requested_by_id=grc_user.id if grc_user else None,
                    owner_id=grc_user.id if grc_user else None,
                    approved_by_id=ciso_user.id if ciso_user else None,
                    start_date=now_utc - timedelta(days=5),
                    expiry_date=now_utc + timedelta(days=90),
                    reviewed_at=now_utc - timedelta(days=3),
                    reviewer_comments="Waiver granted with condition that IP whitelisting is strictly audited monthly.",
                    status="APPROVED"
                )
                db.add(exc_1)

        # Risk 4: Low - Outdated Audit Log Retention Policy
        rsk_4 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00004").first()
        if not rsk_4 and ncb_org and fin_sec:
            rsk_4 = Risk(
                business_id="RSK-2026-00004",
                title="Database Audit Log Purge SLA Non-Compliance Risk",
                description="Risk of non-compliance with statutory audit log retention timelines due to manual archive script execution.",
                category="Data Security",
                source="FINDING",
                source_reference="FND-2026-00004",
                finding_id=fnd_4.id if fnd_4 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                asset_or_system="Core Oracle Database Clusters",
                owner_id=grc_user.id if grc_user else None,
                identified_by_id=grc_user.id if grc_user else None,
                likelihood=2,
                impact=2,
                inherent_score=4,
                inherent_risk_level="LOW",
                existing_controls_description="Weekly tape backups and offsite cold storage.",
                treatment_strategy="MITIGATE",
                status="MONITORED",
                target_date=now_utc + timedelta(days=60)
            )
            db.add(rsk_4)
            db.flush()

        # Risk 5: High - SCADA Substation Telemetry Interception (Apex Power Grid / Energy)
        rsk_5 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00005").first()
        if not rsk_5 and apex_org and energy_sec:
            rsk_5 = Risk(
                business_id="RSK-2026-00005",
                title="SCADA Substation Remote Telemetry Interception Vulnerability",
                description="Risk of unauthorized command injection or state falsification in electrical transmission grid substations.",
                category="Infrastructure",
                source="ASSESSMENT",
                source_reference="ASM-2026-00005",
                organization_id=apex_org.id,
                sector_id=energy_sec.id,
                asset_or_system="Regional High-Voltage RTU Telemetry Bus",
                identified_by_id=admin_user.id if admin_user else None,
                likelihood=4,
                impact=4,
                inherent_score=16,
                inherent_risk_level="HIGH",
                status="IDENTIFIED",
                target_date=now_utc + timedelta(days=20)
            )
            db.add(rsk_5)

        db.commit()

        # 13. Seed Remediations & Remediation Evidence (Step 11)
        from app.models.remediation import Remediation
        from app.models.finding import Finding
        from app.models.risk import Risk, RiskTreatment
        from app.models.control import Control

        remediation_user = db.query(User).filter(User.email == "remediation@sat-sa.local").first()
        infra_user = db.query(User).filter(User.email == "soc@sat-sa.local").first()

        fnd_1 = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
        fnd_2 = db.query(Finding).filter(Finding.business_id == "FND-2026-00002").first()
        fnd_3 = db.query(Finding).filter(Finding.business_id == "FND-2026-00003").first()
        fnd_4 = db.query(Finding).filter(Finding.business_id == "FND-2026-00004").first()
        rsk_1 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00001").first()
        rsk_2 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00002").first()
        rsk_3 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00003").first()
        rsk_4 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00004").first()
        trt_1 = db.query(RiskTreatment).filter(RiskTreatment.business_id == "TRT-2026-00001").first()
        trt_2 = db.query(RiskTreatment).filter(RiskTreatment.business_id == "TRT-2026-00002").first()
        ctrl_1 = db.query(Control).filter(Control.business_id == "CTRL-2026-00001").first()
        ctrl_2 = db.query(Control).filter(Control.business_id == "CTRL-2026-00002").first()

        # Remediation 1: In Progress, linked to FND-1 & RSK-1 & TRT-1
        rem_1 = db.query(Remediation).filter(Remediation.business_id == "REM-2026-00001").first()
        if not rem_1 and ncb_org and fin_sec:
            rem_1 = Remediation(
                business_id="REM-2026-00001",
                title="Insecure Gateway Vault Integration & Private Key Relocation",
                description="Migrate unencrypted TLS gateway private keys into certified HSM/Key Vault and enforce outbound geofencing.",
                priority="CRITICAL",
                status="IN_PROGRESS",
                corrective_action="1. Deploy HashiCorp Vault cluster;\n2. Relocate API gateway certificates;\n3. Enforce egress mTLS.",
                root_cause="Legacy configuration script stored private keys on flat file system during initial deployment.",
                implementation_steps="Phase 1: Vault setup (Complete)\nPhase 2: Key rotation (In Progress)\nPhase 3: Gateway reload & audit verification.",
                expected_outcome="Elimination of raw private key exposure on filesystem; automated secret rotation.",
                completion_criteria="All gateway private keys stored in HSM; filesystem scan returns 0 exposed PEM files.",
                dependencies="HSM appliance network route provisioning by Network Engineering.",
                required_evidence_types="CONFIGURATION, SYSTEM_LOG, SCAN_REPORT",
                source="FINDING",
                finding_id=fnd_1.id if fnd_1 else None,
                risk_id=rsk_1.id if rsk_1 else None,
                risk_treatment_id=trt_1.id if trt_1 else None,
                control_id=ctrl_1.id if ctrl_1 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                owner_id=remediation_user.id if remediation_user else None,
                assigned_team="IT Infrastructure Team",
                assigned_by_id=grc_user.id if grc_user else None,
                assigned_at=now_utc - timedelta(days=5),
                target_date=now_utc + timedelta(days=14),
                due_date=now_utc + timedelta(days=14),
                started_at=now_utc - timedelta(days=2),
                created_by_id=grc_user.id if grc_user else None
            )
            db.add(rem_1)
            db.flush()

            # Attach initial evidence
            evd_rem1 = db.query(Evidence).filter(Evidence.business_id == "EVD-2026-00005").first()
            if not evd_rem1:
                evd_rem1 = Evidence(
                    business_id="EVD-2026-00005",
                    title="Vault KMS Integration Configuration Export",
                    description="Redacted configuration dump showing HSM integration and tokenized secret backend.",
                    evidence_type="CONFIGURATION",
                    remediation_id=rem_1.id,
                    finding_id=fnd_1.id if fnd_1 else None,
                    control_id=ctrl_1.id if ctrl_1 else None,
                    uploaded_by_id=remediation_user.id if remediation_user else None,
                    verification_status="PENDING"
                )
                db.add(evd_rem1)

        # Remediation 2: BLOCKED, linked to FND-2 & RSK-2
        rem_2 = db.query(Remediation).filter(Remediation.business_id == "REM-2026-00002").first()
        if not rem_2 and ncb_org and fin_sec:
            rem_2 = Remediation(
                business_id="REM-2026-00002",
                title="Perimeter Core Switch Firmware Microcode Upgrade",
                description="Deploy vendor emergency security patch for CVE-2026-1934 to mitigate remote buffer overflow vulnerability.",
                priority="HIGH",
                status="BLOCKED",
                corrective_action="Apply switch OS patch 15.4.3-SEC to perimeter distribution switches and reload core stack.",
                root_cause="End-of-life firmware branch maintained due to custom SNMP polling dependencies.",
                implementation_steps="1. Backup running config;\n2. Stage firmware image on secondary flash;\n3. Execute failover reboot.",
                expected_outcome="Vulnerability CVE-2026-1934 neutralized on perimeter network layer.",
                completion_criteria="Switch reporting OS version 15.4.3-SEC; zero packet loss across redundant fabric.",
                blocked_reason="Pending change-freeze lifting during end-of-quarter interbank settlement processing window.",
                blocked_by_id=remediation_user.id if remediation_user else None,
                blocked_at=now_utc - timedelta(days=1),
                source="RISK",
                risk_id=rsk_2.id if rsk_2 else None,
                control_id=ctrl_2.id if ctrl_2 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                owner_id=remediation_user.id if remediation_user else None,
                assigned_team="Network Engineering",
                assigned_by_id=ciso_user.id if ciso_user else None,
                assigned_at=now_utc - timedelta(days=4),
                target_date=now_utc + timedelta(days=7),
                due_date=now_utc + timedelta(days=7),
                started_at=now_utc - timedelta(days=3),
                created_by_id=ciso_user.id if ciso_user else None
            )
            db.add(rem_2)

        # Remediation 3: VALIDATION, linked to FND-3 & RSK-3, has evidence attached
        rem_3 = db.query(Remediation).filter(Remediation.business_id == "REM-2026-00003").first()
        if not rem_3 and ncb_org and fin_sec:
            rem_3 = Remediation(
                business_id="REM-2026-00003",
                title="Hardcoded API Key Invalidation & Mobile Build Secret Management",
                description="Invalidate leaked gateway API credentials from decompiled Android package, update mobile client build pipeline with ProGuard obfuscation, and deploy environment variable secret injection.",
                priority="CRITICAL",
                status="VALIDATION",
                corrective_action="Revoked compromised API token, reissued cryptographically bound JWT tokens, deployed mobile client v2.4.1 hotfix to production stores.",
                root_cause="Developer hardcoded test credentials into client source tree during integration sprint.",
                implementation_steps="1. Key revocation (Done);\n2. CI/CD secret scanner gate (Done);\n3. App store release (Done).",
                expected_outcome="Zero client-side plaintext secret exposure; CI gate prevents secret commits.",
                completion_criteria="SonarQube and Gitleaks report 0 secrets; mobile v2.4.1 forced update threshold at 98%.",
                required_evidence_types="SCAN_REPORT, CHANGE_RECORD",
                source="FINDING",
                finding_id=fnd_3.id if fnd_3 else None,
                risk_id=rsk_3.id if rsk_3 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                owner_id=remediation_user.id if remediation_user else None,
                assigned_team="AppDev Mobile Squad",
                assigned_by_id=grc_user.id if grc_user else None,
                assigned_at=now_utc - timedelta(days=6),
                target_date=now_utc + timedelta(days=5),
                due_date=now_utc + timedelta(days=5),
                started_at=now_utc - timedelta(days=5),
                completed_at=now_utc - timedelta(hours=4),
                created_by_id=soc_user.id if soc_user else None
            )
            db.add(rem_3)
            db.flush()

            # Attach evidence in validation
            evd_rem3 = db.query(Evidence).filter(Evidence.business_id == "EVD-2026-00006").first()
            if not evd_rem3:
                evd_rem3 = Evidence(
                    business_id="EVD-2026-00006",
                    title="Mobile App v2.4.1 Production Secret Scan Report",
                    description="Gitleaks and TruffleHog scan artifacts verifying 0 secrets in mobile release binary.",
                    evidence_type="SCAN_REPORT",
                    remediation_id=rem_3.id,
                    finding_id=fnd_3.id if fnd_3 else None,
                    uploaded_by_id=remediation_user.id if remediation_user else None,
                    verification_status="PENDING"
                )
                db.add(evd_rem3)

        # Remediation 4: VERIFIED, linked to FND-4 & RSK-4
        rem_4 = db.query(Remediation).filter(Remediation.business_id == "REM-2026-00004").first()
        if not rem_4 and ncb_org and fin_sec:
            rem_4 = Remediation(
                business_id="REM-2026-00004",
                title="Deprecate Insecure TLS 1.0/1.1 Ciphers on Customer Ingress Endpoints",
                description="Disable CBC and 3DES cipher suites across reverse proxies; enforce TLS 1.2+ with forward secrecy.",
                priority="MEDIUM",
                status="VERIFIED",
                corrective_action="Updated NGINX ssl_ciphers directives; retested endpoint TLS grade to A+ on SSL Labs.",
                root_cause="Legacy backwards compatibility flag remained enabled after core platform migration.",
                implementation_steps="1. Update proxy configs;\n2. Reload NGINX master;\n3. Execute Qualys scan validation.",
                expected_outcome="Mitigation of BEAST, POODLE, and SWEET32 attacks.",
                completion_criteria="A+ rating on external Qualys SSL test.",
                source="FINDING",
                finding_id=fnd_4.id if fnd_4 else None,
                risk_id=rsk_4.id if rsk_4 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                owner_id=remediation_user.id if remediation_user else None,
                assigned_team="Web Operations",
                assigned_by_id=ciso_user.id if ciso_user else None,
                assigned_at=now_utc - timedelta(days=10),
                target_date=now_utc - timedelta(days=2),
                due_date=now_utc - timedelta(days=2),
                started_at=now_utc - timedelta(days=8),
                completed_at=now_utc - timedelta(days=2),
                verified_at=now_utc - timedelta(days=1),
                verified_by_id=ciso_user.id if ciso_user else None,
                validator_comments="Independent Qualys SSL scan confirmed A+ rating with TLS 1.2/1.3 only across all external domains.",
                validation_decision="VERIFIED",
                created_by_id=ciso_user.id if ciso_user else None
            )
            db.add(rem_4)
            db.flush()

            # Attach verified evidence
            evd_rem4 = db.query(Evidence).filter(Evidence.business_id == "EVD-2026-00007").first()
            if not evd_rem4:
                evd_rem4 = Evidence(
                    business_id="EVD-2026-00007",
                    title="Qualys SSL Labs A+ Verification Certificate",
                    description="Automated report confirming TLS 1.3/1.2 forward secrecy and 0 deprecated ciphers.",
                    evidence_type="SCAN_REPORT",
                    remediation_id=rem_4.id,
                    finding_id=fnd_4.id if fnd_4 else None,
                    uploaded_by_id=remediation_user.id if remediation_user else None,
                    verification_status="VERIFIED",
                    verified_by_id=ciso_user.id if ciso_user else None,
                    verified_at=now_utc - timedelta(days=1),
                    reviewer_comments="Certificate and ciphers confirmed compliant."
                )
                db.add(evd_rem4)

        # Remediation 5: OVERDUE SLA Scenario (Apex Power Grid)
        rem_5 = db.query(Remediation).filter(Remediation.business_id == "REM-2026-00005").first()
        if not rem_5 and apex_org and energy_sec:
            rem_5 = Remediation(
                business_id="REM-2026-00005",
                title="High-Voltage Telemetry Isolation & Firewall Segmentation Enforcement",
                description="Implement air-gapped unidirectional data diodes between SCADA substation controllers and corporate analytics network.",
                priority="HIGH",
                status="IN_PROGRESS",
                corrective_action="Deploy hardware data diodes and re-route RTU telemetry stream over dedicated serial links.",
                root_cause="Shared commercial router connected OT sensors directly to corporate WAN.",
                implementation_steps="1. Fiber pull to substation racks;\n2. Diode hardware mount;\n3. Switch cutover.",
                expected_outcome="Physical impossibility of inbound packet injection into substation controllers.",
                completion_criteria="Bi-directional packet test confirms total block on inbound channel.",
                source="RISK",
                risk_id=rsk_5.id if rsk_5 else None,
                organization_id=apex_org.id,
                sector_id=energy_sec.id,
                owner_id=admin_user.id if admin_user else None,
                assigned_team="OT SCADA Security Team",
                assigned_by_id=admin_user.id if admin_user else None,
                assigned_at=now_utc - timedelta(days=20),
                target_date=now_utc - timedelta(days=3), # Overdue!
                due_date=now_utc - timedelta(days=3),
                started_at=now_utc - timedelta(days=18),
                created_by_id=admin_user.id if admin_user else None
            )
            db.add(rem_5)
            db.flush()

        # ==========================================
        # 11. Seed Supervisory Cases, Escalations & Decisions
        # ==========================================
        # Resolve users
        sup_analyst_user = db.query(User).filter(User.email == "supervision.analyst@sat-sa.local").first()
        sup_auth_user = db.query(User).filter(User.email == "supervision.auth@sat-sa.local").first()
        sector_auth_user = db.query(User).filter(User.email == "sector.auth@sat-sa.local").first()
        
        # Resolve source entities
        cse_1 = db.query(CSE).filter(CSE.business_id == "CSE-2026-00001").first()
        fnd_1 = db.query(Finding).filter(Finding.business_id == "FND-2026-00001").first()
        rsk_1 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00001").first()
        rem_1 = db.query(Remediation).filter(Remediation.business_id == "REM-2026-00001").first()

        fnd_2 = db.query(Finding).filter(Finding.business_id == "FND-2026-00002").first()
        rsk_2 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00002").first()
        rem_2 = db.query(Remediation).filter(Remediation.business_id == "REM-2026-00002").first()

        fnd_3 = db.query(Finding).filter(Finding.business_id == "FND-2026-00003").first()
        rsk_3 = db.query(Risk).filter(Risk.business_id == "RSK-2026-00003").first()

        # Case 1: Traceable chain (Critical CSE -> Finding -> Risk -> Remediation -> Escalation -> Case -> Decision)
        sup_case_1 = db.query(SupervisoryCase).filter(SupervisoryCase.business_id == "SUP-2026-00001").first()
        if not sup_case_1 and ncb_org and fin_sec:
            sup_case_1 = SupervisoryCase(
                business_id="SUP-2026-00001",
                title="Cross-Sector Systemic APT29 Intrusion & Exfiltration Investigation",
                description="Supervisory oversight of critical CSE-2026-00001 and severe Swift network lateral movement risk RSK-2026-00001 across financial sector.",
                priority="CRITICAL",
                status="ACTION_REQUIRED",
                trigger_type="CRITICAL_CSE",
                source_cse_id=cse_1.id if cse_1 else None,
                source_finding_id=fnd_1.id if fnd_1 else None,
                source_risk_id=rsk_1.id if rsk_1 else None,
                source_remediation_id=rem_1.id if rem_1 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                created_by_id=sup_analyst_user.id if sup_analyst_user else None,
                assigned_analyst_id=sup_analyst_user.id if sup_analyst_user else None,
                supervisory_authority_id=sup_auth_user.id if sup_auth_user else None,
                analyst_notes="Threat actor established persistence via forged SAML token; financial messaging gateways require forensic audit.",
                recommendation="Mandate immediate enterprise-wide Kerberos Golden Ticket revocation, deploy hardware security keys, and isolate all domain controller replication links.",
                recommendation_submitted_at=now_utc - timedelta(days=3),
                final_decision="REQUIRE_ACTION",
                decision_reason="High probability of cross-entity infection justifies direct supervisory action and quarterly control verification.",
                decided_by_id=sup_auth_user.id if sup_auth_user else None,
                decided_at=now_utc - timedelta(days=2),
                due_date=now_utc + timedelta(days=14),
            )
            db.add(sup_case_1)
            db.flush()

            # Escalation 1
            esc_1 = db.query(Escalation).filter(Escalation.business_id == "ESC-2026-00001").first()
            if not esc_1:
                esc_1 = Escalation(
                    business_id="ESC-2026-00001",
                    resource_type="CSE",
                    resource_id=cse_1.id if cse_1 else sup_case_1.id,
                    reason="APT29 state-sponsored actor penetrated perimeter gateway and gained domain admin privileges.",
                    severity="CRITICAL",
                    priority="CRITICAL",
                    level="LEVEL_3",
                    status="RESOLVED",
                    escalated_by_id=sup_analyst_user.id if sup_analyst_user else None,
                    escalated_to_id=sup_auth_user.id if sup_auth_user else None,
                    organization_id=ncb_org.id,
                    sector_id=fin_sec.id,
                    supervisory_case_id=sup_case_1.id,
                    resolution="Supervisory directive issued: hardware keys and replication links isolated.",
                    resolved_at=now_utc - timedelta(days=2),
                )
                db.add(esc_1)

            # Decision 1
            dec_1 = db.query(SupervisoryDecision).filter(SupervisoryDecision.business_id == "DEC-2026-00001").first()
            if not dec_1 and sup_auth_user:
                dec_1 = SupervisoryDecision(
                    business_id="DEC-2026-00001",
                    supervisory_case_id=sup_case_1.id,
                    decision_type="REQUIRE_ACTION",
                    status="APPROVED",
                    decision_maker_id=sup_auth_user.id,
                    rationale="Immediate remediation required across all inter-bank gateways to mitigate systemic contagion.",
                    conditions="Entity must supply third-party forensic attestation within 14 calendar days.",
                    action_required="Deploy out-of-band hardware authentication tokens and isolate replication interfaces.",
                    effective_date=now_utc - timedelta(days=2),
                    review_date=now_utc + timedelta(days=14),
                    organization_id=ncb_org.id,
                    sector_id=fin_sec.id,
                )
                db.add(dec_1)

        # Case 2: Overdue Critical Remediation (Under Review)
        sup_case_2 = db.query(SupervisoryCase).filter(SupervisoryCase.business_id == "SUP-2026-00002").first()
        if not sup_case_2 and ncb_org and fin_sec:
            sup_case_2 = SupervisoryCase(
                business_id="SUP-2026-00002",
                title="Overdue Critical Remediation SLA Breach: SWIFT Gateway Isolation",
                description="Remediation REM-2026-00002 breached 30-day regulatory SLA without verified hardware deployment.",
                priority="CRITICAL",
                status="UNDER_REVIEW",
                trigger_type="OVERDUE_REMEDIATION",
                source_finding_id=fnd_2.id if fnd_2 else None,
                source_risk_id=rsk_2.id if rsk_2 else None,
                source_remediation_id=rem_2.id if rem_2 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                created_by_id=sup_analyst_user.id if sup_analyst_user else None,
                assigned_analyst_id=sup_analyst_user.id if sup_analyst_user else None,
                supervisory_authority_id=sup_auth_user.id if sup_auth_user else None,
                analyst_notes="Initial evidence incomplete. Requesting updated timeline from National Central Bank infrastructure team.",
                due_date=now_utc + timedelta(days=7),
            )
            db.add(sup_case_2)
            db.flush()

            esc_2 = db.query(Escalation).filter(Escalation.business_id == "ESC-2026-00002").first()
            if not esc_2:
                esc_2 = Escalation(
                    business_id="ESC-2026-00002",
                    resource_type="REMEDIATION",
                    resource_id=rem_2.id if rem_2 else sup_case_2.id,
                    reason="Critical remediation target date breached by 12 days; gateway remains exposed.",
                    severity="CRITICAL",
                    priority="CRITICAL",
                    level="LEVEL_2",
                    status="IN_REVIEW",
                    escalated_by_id=sup_analyst_user.id if sup_analyst_user else None,
                    escalated_to_id=sup_analyst_user.id if sup_analyst_user else None,
                    organization_id=ncb_org.id,
                    sector_id=fin_sec.id,
                    supervisory_case_id=sup_case_2.id,
                )
                db.add(esc_2)

        # Case 3: High Risk (Recommendation Ready)
        sup_case_3 = db.query(SupervisoryCase).filter(SupervisoryCase.business_id == "SUP-2026-00003").first()
        if not sup_case_3 and ncb_org and fin_sec:
            sup_case_3 = SupervisoryCase(
                business_id="SUP-2026-00003",
                title="Critical Unencrypted Core Database Data-At-Rest Exposure",
                description="Enterprise Risk RSK-2026-00003 identified with 16/25 score. Analyst formulated mitigation directives.",
                priority="HIGH",
                status="RECOMMENDATION_READY",
                trigger_type="CRITICAL_RISK",
                source_finding_id=fnd_3.id if fnd_3 else None,
                source_risk_id=rsk_3.id if rsk_3 else None,
                organization_id=ncb_org.id,
                sector_id=fin_sec.id,
                created_by_id=sup_analyst_user.id if sup_analyst_user else None,
                assigned_analyst_id=sup_analyst_user.id if sup_analyst_user else None,
                supervisory_authority_id=sup_auth_user.id if sup_auth_user else None,
                recommendation="Mandate hardware-accelerated AES-256 transparent data encryption (TDE) before Q4 regulatory cycle.",
                recommendation_submitted_at=now_utc - timedelta(hours=8),
                due_date=now_utc + timedelta(days=21),
            )
            db.add(sup_case_3)
            db.flush()

            esc_3 = db.query(Escalation).filter(Escalation.business_id == "ESC-2026-00003").first()
            if not esc_3:
                esc_3 = Escalation(
                    business_id="ESC-2026-00003",
                    resource_type="RISK",
                    resource_id=rsk_3.id if rsk_3 else sup_case_3.id,
                    reason="Unencrypted credit ledger database contains over 1.2M consumer financial records.",
                    severity="HIGH",
                    priority="HIGH",
                    level="LEVEL_1",
                    status="OPEN",
                    escalated_by_id=sup_analyst_user.id if sup_analyst_user else None,
                    organization_id=ncb_org.id,
                    sector_id=fin_sec.id,
                    supervisory_case_id=sup_case_3.id,
                )
                db.add(esc_3)

        # Case 4: Energy Sector Monitoring
        sup_case_4 = db.query(SupervisoryCase).filter(SupervisoryCase.business_id == "SUP-2026-00004").first()
        if not sup_case_4 and apex_org and energy_sec:
            sup_case_4 = SupervisoryCase(
                business_id="SUP-2026-00004",
                title="Energy Grid SCADA Gateway Hardening & Telemetry Monitoring",
                description="Supervisory oversight of critical infrastructure telemetry segmentation across Energy Sector.",
                priority="HIGH",
                status="MONITORING",
                trigger_type="HIGH_FINDING",
                source_remediation_id=rem_5.id if rem_5 else None,
                organization_id=apex_org.id,
                sector_id=energy_sec.id,
                created_by_id=sup_auth_user.id if sup_auth_user else None,
                supervisory_authority_id=sup_auth_user.id if sup_auth_user else None,
                final_decision="CONTINUE_MONITORING",
                decision_reason="Initial physical isolation completed; monitoring network flow telemetry for 60 days.",
                decided_by_id=sup_auth_user.id if sup_auth_user else None,
                decided_at=now_utc - timedelta(days=5),
                due_date=now_utc + timedelta(days=55),
            )
            db.add(sup_case_4)

        db.commit()
        print("Connected Remediations, Supervisory Cases, Escalations & Decisions seed data successfully inserted.")
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
