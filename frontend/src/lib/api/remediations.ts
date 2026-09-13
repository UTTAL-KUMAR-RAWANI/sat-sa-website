const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        credentials: "include",
    });

    if (!res.ok) {
        let errorDetail = "An unexpected error occurred.";
        try {
            const err = await res.json();
            errorDetail = err.detail || errorDetail;
        } catch {}
        throw new Error(errorDetail);
    }

    return res.json();
}

export type RemediationStatus =
    | "OPEN"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "BLOCKED"
    | "EVIDENCE_SUBMITTED"
    | "VALIDATION"
    | "VERIFIED"
    | "CLOSED";

export type RemediationPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type RemediationSource = "FINDING" | "RISK" | "ASSESSMENT" | "MANUAL";

export type EvidenceType =
    | "LOG"
    | "CONFIGURATION"
    | "SCAN_REPORT"
    | "POLICY"
    | "SCREENSHOT"
    | "CHANGE_RECORD";

export type EvidenceVerificationStatus =
    | "PENDING"
    | "VERIFIED"
    | "REJECTED"
    | "CHANGES_REQUIRED";

export interface RemediationEvidenceItem {
    id: string;
    business_id: string;
    remediation_id?: string;
    title: string;
    description?: string;
    evidence_type: EvidenceType | string;
    file_uri?: string;
    filename?: string;
    file_size?: number;
    checksum?: string;
    verification_status: EvidenceVerificationStatus | string;
    reviewer_comments?: string;
    verified_at?: string;
    verified_by_id?: string;
    verified_by_name?: string;
    uploaded_by_id?: string;
    uploaded_by_name?: string;
    created_at: string;
}

export interface Remediation {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    priority: RemediationPriority;
    status: RemediationStatus;

    source: RemediationSource | string;
    source_id?: string;

    finding_id?: string;
    finding_business_id?: string;
    finding_title?: string;

    risk_id?: string;
    risk_business_id?: string;
    risk_title?: string;

    risk_treatment_id?: string;
    risk_treatment_business_id?: string;

    control_id?: string;
    control_business_id?: string;
    control_name?: string;

    organization_id?: string;
    organization_name?: string;
    sector_id?: string;
    sector_name?: string;

    owner_id?: string;
    owner_name?: string;
    assigned_team?: string;

    assigned_by_id?: string;
    assigned_by_name?: string;
    assigned_at?: string;

    due_date?: string;
    target_date?: string;
    started_at?: string;
    completed_at?: string;

    blocked_reason?: string;
    blocked_by_id?: string;
    blocked_by_name?: string;
    blocked_at?: string;

    verified_at?: string;
    verified_by_id?: string;
    verified_by_name?: string;
    validator_comments?: string;
    validation_decision?: string;

    closed_at?: string;
    closed_by_id?: string;
    closed_by_name?: string;

    required_evidence_types?: string;
    evidence_count: number;
    is_overdue: boolean;

    created_at: string;
    updated_at: string;
}

export interface RemediationDetail extends Remediation {
    corrective_action?: string;
    root_cause?: string;
    implementation_steps?: string;
    expected_outcome?: string;
    completion_criteria?: string;
    dependencies?: string;

    evidence_items: RemediationEvidenceItem[];
    missing_evidence_types: string[];
}

export interface RemediationStats {
    total_remediations: number;
    open: number;
    assigned: number;
    in_progress: number;
    blocked: number;
    evidence_submitted: number;
    validation: number;
    verified: number;
    closed: number;
    overdue: number;
    high_critical_count: number;
    status_distribution: Record<string, number>;
    priority_distribution: Record<string, number>;
}

export interface RemediationTimelineEvent {
    id: string;
    remediation_id: string;
    timestamp: string;
    event_type: "TRANSITION" | "EVIDENCE" | "APPROVAL" | "ASSIGNMENT";
    title: string;
    description: string;
    actor_name: string;
    actor_id?: string;
    details?: Record<string, any>;
}

export interface RemediationQueryParams {
    status?: string;
    priority?: string;
    source?: string;
    owner_id?: string;
    organization_id?: string;
    search?: string;
}

export interface RemediationCreatePayload {
    title: string;
    description?: string;
    priority?: RemediationPriority;
    corrective_action?: string;
    root_cause?: string;
    implementation_steps?: string;
    expected_outcome?: string;
    completion_criteria?: string;
    dependencies?: string;
    required_evidence_types?: string;

    source?: RemediationSource;
    source_id?: string;
    finding_id?: string;
    risk_id?: string;
    risk_treatment_id?: string;
    control_id?: string;

    organization_id?: string;
    sector_id?: string;

    owner_id?: string;
    assigned_team?: string;
    target_date?: string;
    due_date?: string;
}

export interface RemediationAssignPayload {
    owner_id?: string;
    assigned_team?: string;
    target_date?: string;
    notes?: string;
}

export interface RemediationEvidenceCreatePayload {
    title: string;
    description?: string;
    evidence_type: string;
    file_uri?: string;
    file_url?: string;
    filename?: string;
    file_size?: number;
    checksum?: string;
}

export interface RemediationEvidenceReviewPayload {
    verification_status: string;
    reviewer_comments?: string;
}

export const remediationsApi = {
    list: async (params?: RemediationQueryParams): Promise<Remediation[]> => {
        const q = new URLSearchParams();
        if (params?.status && params.status !== "ALL") q.append("status", params.status);
        if (params?.priority && params.priority !== "ALL") q.append("priority", params.priority);
        if (params?.source && params.source !== "ALL") q.append("source", params.source);
        if (params?.owner_id) q.append("owner_id", params.owner_id);
        if (params?.organization_id) q.append("organization_id", params.organization_id);
        if (params?.search) q.append("search", params.search);

        const qs = q.toString() ? `?${q.toString()}` : "";
        return request<Remediation[]>(`/remediations${qs}`);
    },

    getById: async (id: string): Promise<RemediationDetail> => {
        return request<RemediationDetail>(`/remediations/${id}`);
    },

    getStats: async (): Promise<RemediationStats> => {
        return request<RemediationStats>("/remediations/stats");
    },

    create: async (payload: RemediationCreatePayload): Promise<Remediation> => {
        return request<Remediation>("/remediations", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    update: async (id: string, payload: Partial<RemediationCreatePayload>): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    },

    assign: async (id: string, payload: RemediationAssignPayload): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}/assign`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    start: async (id: string): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}/start`, {
            method: "POST",
        });
    },

    block: async (id: string, payload: { blocked_reason: string }): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}/block`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    unblock: async (id: string, payload?: { unblock_notes?: string }): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}/unblock`, {
            method: "POST",
            body: JSON.stringify(payload || {}),
        });
    },

    submitEvidence: async (id: string, payload?: { submission_notes?: string }): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}/submit-evidence`, {
            method: "POST",
            body: JSON.stringify(payload || {}),
        });
    },

    beginValidation: async (id: string): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}/validate`, {
            method: "POST",
        });
    },

    verify: async (
        id: string,
        payload: { decision: "VERIFIED" | "RETURNED_FOR_CORRECTION"; reviewer_comments?: string }
    ): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}/verify`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    close: async (id: string, payload?: { closure_notes?: string }): Promise<Remediation> => {
        return request<Remediation>(`/remediations/${id}/close`, {
            method: "POST",
            body: JSON.stringify(payload || {}),
        });
    },

    getEvidence: async (id: string): Promise<RemediationEvidenceItem[]> => {
        return request<RemediationEvidenceItem[]>(`/remediations/${id}/evidence`);
    },

    addEvidence: async (id: string, payload: RemediationEvidenceCreatePayload): Promise<RemediationEvidenceItem> => {
        return request<RemediationEvidenceItem>(`/remediations/${id}/evidence`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    reviewEvidence: async (
        id: string,
        evidenceId: string,
        payload: RemediationEvidenceReviewPayload
    ): Promise<RemediationEvidenceItem> => {
        return request<RemediationEvidenceItem>(`/remediations/${id}/evidence/${evidenceId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    },

    getTimeline: async (id: string): Promise<RemediationTimelineEvent[]> => {
        return request<RemediationTimelineEvent[]>(`/remediations/${id}/timeline`);
    },
};
