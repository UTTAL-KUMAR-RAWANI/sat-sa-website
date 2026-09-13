import { User } from "../auth/auth-types";

// Granular SAT-SA Permissions
export const Permissions = {
    // Admin & Identity
    USERS_MANAGE: "users.manage",
    USERS_READ: "users.read",
    ROLES_MANAGE: "roles.manage",
    ROLES_READ: "roles.read",
    PERMISSIONS_MANAGE: "permissions.manage",
    SYSTEM_SETTINGS_MANAGE: "system_settings.manage",
    SYSTEM_STATUS_READ: "system_status.read",
    AUDIT_LOGS_READ: "audit_logs.read",
    AUDIT_LOGS_EXPORT: "audit_logs.export",
    MY_WORK_READ: "my_work.read",

    // Supervision & Security Events
    ALERTS_READ: "alerts.read",
    ALERTS_MANAGE: "alerts.manage",
    CSE_READ: "cse.read",
    CSE_CREATE: "cse.create",
    CSE_UPDATE: "cse.update",
    CSE_ESCALATE: "cse.escalate",
    INVESTIGATIONS_READ: "investigations.read",
    INVESTIGATIONS_CREATE: "investigations.create",
    EVIDENCE_READ: "evidence.read",

    // Findings
    FINDING_READ: "finding.read",
    FINDING_CREATE: "finding.create",
    FINDING_UPDATE: "finding.update",
    FINDING_SUBMIT: "finding.submit",
    FINDING_REVIEW: "finding.review",
    FINDING_APPROVE: "finding.approve",
    FINDING_REJECT: "finding.reject",
    FINDING_CLOSE: "finding.close",

    // Assessments
    ASSESSMENT_READ: "assessment.read",
    ASSESSMENT_CREATE: "assessment.create",
    ASSESSMENT_UPDATE: "assessment.update",
    ASSESSMENT_ASSIGN: "assessment.assign",
    ASSESSMENT_SUBMIT: "assessment.submit",
    ASSESSMENT_REVIEW: "assessment.review",
    ASSESSMENT_APPROVE: "assessment.approve",
    ASSESSMENT_CLOSE: "assessment.close",
    CONTROL_READ: "control.read",
    CONTROL_UPDATE: "control.update",
    ASSESSMENT_CONTROLS_READ: "assessment_controls.read",
    ASSESSMENT_CONTROLS_UPDATE: "assessment_controls.update",
    EVIDENCE_VERIFY: "evidence.verify",

    // Risk & GRC
    RISK_READ: "risk.read",
    RISK_CREATE: "risk.create",
    RISK_UPDATE: "risk.update",
    RISK_ASSIGN: "risk.assign",
    RISK_ASSESS: "risk.assess",
    RISK_TREAT: "risk.treat",
    RISK_ACCEPT: "risk.accept",
    RISK_CLOSE: "risk.close",
    RISK_REVIEW: "risk.review",
    RISK_APPROVE: "risk.approve",
    RISK_EXCEPTION_READ: "risk_exception.read",
    RISK_EXCEPTION_CREATE: "risk_exception.create",
    RISK_EXCEPTION_REVIEW: "risk_exception.review",
    RISK_EXCEPTION_APPROVE: "risk_exception.approve",
    RISK_EXCEPTION_CLOSE: "risk_exception.close",
    RISK_TREATMENT_READ: "risk_treatment.read",
    RISK_TREATMENT_CREATE: "risk_treatment.create",
    RISK_TREATMENT_UPDATE: "risk_treatment.update",
    RISK_TREATMENT_REVIEW: "risk_treatment.review",

    // Remediation
    REMEDIATION_READ: "remediation.read",
    REMEDIATION_CREATE: "remediation.create",
    REMEDIATION_UPDATE: "remediation.update",
    REMEDIATION_ASSIGN: "remediation.assign",
    REMEDIATION_START: "remediation.start",
    REMEDIATION_BLOCK: "remediation.block",
    REMEDIATION_SUBMIT_EVIDENCE: "remediation.submit_evidence",
    REMEDIATION_VALIDATE: "remediation.validate",
    REMEDIATION_VERIFY: "remediation.verify",
    REMEDIATION_CLOSE: "remediation.close",
    REMEDIATION_EVIDENCE_READ: "remediation_evidence.read",
    REMEDIATION_EVIDENCE_CREATE: "remediation_evidence.create",
    REMEDIATION_EVIDENCE_VERIFY: "remediation_evidence.verify",
    REMEDIATION_EVIDENCE_REJECT: "remediation_evidence.reject",

    // Supervision
    SUPERVISION_READ: "supervision.read",
    SUPERVISION_CREATE: "supervision.create",
    SUPERVISION_ASSIGN: "supervision.assign",
    SUPERVISION_REVIEW: "supervision.review",
    SUPERVISION_RECOMMEND: "supervision.recommend",
    SUPERVISION_ESCALATE: "supervision.escalate",
    SUPERVISION_DECIDE: "supervision.decide",
    SUPERVISION_APPROVE: "supervision.approve",
    SUPERVISION_CLOSE: "supervision.close",
    SUPERVISION_DECISIONS: "supervision.decisions",

    SUPERVISORY_CASE_READ: "supervisory_case.read",
    SUPERVISORY_CASE_CREATE: "supervisory_case.create",
    SUPERVISORY_CASE_UPDATE: "supervisory_case.update",
    SUPERVISORY_CASE_ASSIGN: "supervisory_case.assign",
    SUPERVISORY_CASE_REVIEW: "supervisory_case.review",
    SUPERVISORY_CASE_CLOSE: "supervisory_case.close",

    ESCALATION_READ: "escalation.read",
    ESCALATION_CREATE: "escalation.create",
    ESCALATION_ASSIGN: "escalation.assign",
    ESCALATION_RESOLVE: "escalation.resolve",
    ESCALATION_CLOSE: "escalation.close",

    SUPERVISORY_DECISION_READ: "supervisory_decision.read",
    SUPERVISORY_DECISION_CREATE: "supervisory_decision.create",
    SUPERVISORY_DECISION_APPROVE: "supervisory_decision.approve",
    SUPERVISORY_DECISION_CLOSE: "supervisory_decision.close",

    // Datasets & Analytics
    DATASET_READ: "dataset.read",
    DATASET_CREATE: "dataset.create",
    DATASET_UPDATE: "dataset.update",
    DATASET_UPLOAD: "dataset.upload",
    DATASET_VALIDATE: "dataset.validate",
    DATASET_IMPORT: "dataset.import",
    DATASET_DELETE: "dataset.delete",
    DATASETS_READ: "datasets.read",
    ANALYTICS_READ: "analytics.read",
    ANALYTICS_RUN: "analytics.run",

    // Negative Space Assessment & Signals
    NEGATIVE_SPACE_READ: "negative_space.read",
    NEGATIVE_SPACE_CREATE: "negative_space.create",
    NEGATIVE_SPACE_RUN: "negative_space.run",
    NEGATIVE_SPACE_REVIEW: "negative_space.review",
    NEGATIVE_SPACE_VALIDATE: "negative_space.validate",
    NEGATIVE_SPACE_DISMISS: "negative_space.dismiss",
    NEGATIVE_SPACE_CONVERT_FINDING: "negative_space.convert_finding",

    NEGATIVE_SPACE_SIGNAL_READ: "negative_space_signal.read",
    NEGATIVE_SPACE_SIGNAL_REVIEW: "negative_space_signal.review",
    NEGATIVE_SPACE_SIGNAL_VALIDATE: "negative_space_signal.validate",
    NEGATIVE_SPACE_SIGNAL_DISMISS: "negative_space_signal.dismiss",

    // Executive Dashboards & Reporting
    EXECUTIVE_CISO_READ: "executive.ciso.read",
    EXECUTIVE_MANAGEMENT_READ: "executive.management.read",
    EXECUTIVE_EXPORT: "executive.export",
} as const;

export function hasPermission(user: User | null, permission: string): boolean {
    if (!user || !user.is_active || !user.permissions) return false;
    return user.permissions.includes(permission);
}

export function hasAnyPermission(user: User | null, permissions: string[]): boolean {
    if (!user || !user.is_active || !user.permissions) return false;
    return permissions.some((perm) => user.permissions.includes(perm));
}

export function hasAllPermissions(user: User | null, permissions: string[]): boolean {
    if (!user || !user.is_active || !user.permissions) return false;
    return permissions.every((perm) => user.permissions.includes(perm));
}

export function hasRole(user: User | null, role: string): boolean {
    if (!user || !user.is_active || !user.roles) return false;
    return user.roles.includes(role);
}

export interface ResourceScopeContext {
    organization_id?: string | null;
    sector_id?: string | null;
    assigned_to_id?: string | null;
    created_by_id?: string | null;
}

export function canAccess(
    user: User | null,
    permission: string,
    resourceScope?: ResourceScopeContext
): boolean {
    if (!hasPermission(user, permission)) {
        return false;
    }
    if (!resourceScope || !user || user.scope === "enterprise") {
        return true;
    }

    if (user.scope === "sector") {
        return Boolean(resourceScope.sector_id && user.sector_id && resourceScope.sector_id === user.sector_id);
    }

    if (user.scope === "organization") {
        return Boolean(resourceScope.organization_id && user.organization_id && resourceScope.organization_id === user.organization_id);
    }

    if (user.scope === "assigned") {
        return Boolean(user.id && resourceScope.assigned_to_id === user.id);
    }

    if (user.scope === "own") {
        return Boolean(user.id && resourceScope.created_by_id === user.id);
    }

    return false;
}
