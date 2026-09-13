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

export type AssessmentType =
    | "SECURITY_CONTROL_ASSESSMENT"
    | "THEMATIC_AUDIT"
    | "SUPERVISORY_ASSESSMENT"
    | "INCIDENT_POST_MORTEM"
    | "NEGATIVE_SPACE_ASSESSMENT"
    | "READINESS_ASSESSMENT"
    | "SPECIAL_INSPECTION";

export type AssessmentPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AssessmentStatus =
    | "DRAFT"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "EVIDENCE_REQUIRED"
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "CHANGES_REQUESTED"
    | "RESUBMITTED"
    | "APPROVED"
    | "CLOSED";

export interface AssessmentControlItem {
    id: string;
    assessment_id: string;
    control_id: string;
    control_business_id?: string;
    control_name?: string;
    control_category?: string;
    evaluator_id?: string;
    evaluator_name?: string;
    finding_id?: string;
    finding_business_id?: string;
    finding_title?: string;
    status: string; // "NOT_STARTED" | "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE"
    effectiveness: string; // "NOT_ASSESSED" | "EFFECTIVE" | "PARTIALLY_EFFECTIVE" | "INEFFECTIVE"
    evaluation_notes?: string;
    reviewer_comments?: string;
    evidence?: Record<string, any>;
    evidence_required: boolean;
    evidence_submitted: boolean;
    evidence_verified: boolean;
    evaluated_at?: string;
    reviewed_at?: string;
    created_at: string;
    updated_at: string;
}

export interface AssessmentEvidenceItem {
    id: string;
    business_id?: string;
    title: string;
    description?: string;
    evidence_type: string;
    file_uri: string;
    filename: string;
    file_size?: number;
    checksum?: string;
    control_id?: string;
    control_business_id?: string;
    verification_status: "PENDING" | "VERIFIED" | "REJECTED";
    verified_by_id?: string;
    verified_by_name?: string;
    verified_at?: string;
    reviewer_comments?: string;
    uploaded_by_id?: string;
    uploaded_by_name?: string;
    created_at: string;
}

export interface AssessmentFindingItem {
    id: string;
    business_id: string;
    title: string;
    severity: string;
    priority: string;
    status: string;
    source_type?: string;
    control_id?: string;
    control_business_id?: string;
    created_at: string;
}

export interface AssessmentSummary {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    assessment_type: AssessmentType;
    status: AssessmentStatus;
    priority: AssessmentPriority;
    scope: string;
    organization_id?: string;
    organization_name?: string;
    sector_id?: string;
    sector_name?: string;
    cse_id?: string;
    cse_business_id?: string;
    cse_title?: string;
    investigation_id?: string;
    investigation_business_id?: string;
    investigation_title?: string;
    assessor_id?: string;
    assessor_name?: string;
    reviewer_id?: string;
    reviewer_name?: string;
    created_by_id?: string;
    created_by_name?: string;
    start_date?: string;
    due_date?: string;
    submitted_date?: string;
    approved_date?: string;
    closed_date?: string;
    is_overdue: boolean;
    controls_count: number;
    evaluated_controls_count: number;
    evidence_count: number;
    findings_count: number;
    created_at: string;
    updated_at: string;
}

export interface AssessmentDetail extends AssessmentSummary {
    controls: AssessmentControlItem[];
    evidence: AssessmentEvidenceItem[];
    findings: AssessmentFindingItem[];
}

export interface AssessmentStats {
    total: number;
    draft: number;
    assigned: number;
    in_progress: number;
    evidence_required: number;
    submitted: number;
    under_review: number;
    changes_requested: number;
    resubmitted: number;
    approved: number;
    closed: number;
    overdue: number;
}

export interface AssessmentTimelineEvent {
    id: string;
    assessment_id: string;
    event_type: string;
    action: string;
    title: string;
    description: string;
    actor_id?: string;
    actor_name?: string;
    metadata?: Record<string, any>;
    created_at: string;
}

export interface CreateAssessmentPayload {
    title: string;
    description?: string;
    assessment_type: AssessmentType;
    priority?: AssessmentPriority;
    organization_id?: string;
    sector_id?: string;
    assessor_id?: string;
    reviewer_id?: string;
    cse_id?: string;
    investigation_id?: string;
    due_date?: string;
    control_ids?: string[];
}

export interface UpdateAssessmentPayload {
    title?: string;
    description?: string;
    priority?: AssessmentPriority;
    due_date?: string;
    assessor_id?: string;
    reviewer_id?: string;
}

export interface AssignAssessmentPayload {
    assessor_id?: string;
    reviewer_id?: string;
    reason?: string;
}

export interface TransitionPayload {
    target_state?: AssessmentStatus;
    reason?: string;
    comments?: string;
}

export interface EvaluateControlPayload {
    status?: string;
    effectiveness?: string;
    evaluation_notes?: string;
    reviewer_comments?: string;
    evidence?: Record<string, any>;
    evidence_required?: boolean;
    evidence_submitted?: boolean;
    evidence_verified?: boolean;
}

export interface AddControlPayload {
    control_id: string;
    status?: string;
    effectiveness?: string;
    evaluation_notes?: string;
    evidence_required?: boolean;
}

export interface VerifyEvidencePayload {
    status: "VERIFIED" | "REJECTED";
    reviewer_comments?: string;
}

export const assessmentsApi = {
    getAll: async (params?: {
        status?: string;
        assessment_type?: string;
        organization_id?: string;
        search?: string;
        skip?: number;
        limit?: number;
    }): Promise<AssessmentSummary[]> => {
        const query = new URLSearchParams();
        if (params?.status) query.append("status", params.status);
        if (params?.assessment_type) query.append("assessment_type", params.assessment_type);
        if (params?.organization_id) query.append("organization_id", params.organization_id);
        if (params?.search) query.append("search", params.search);
        if (params?.skip !== undefined) query.append("skip", params.skip.toString());
        if (params?.limit !== undefined) query.append("limit", params.limit.toString());
        const qs = query.toString() ? `?${query.toString()}` : "";
        return request<AssessmentSummary[]>(`/assessments${qs}`);
    },

    getStats: async (): Promise<AssessmentStats> => {
        return request<AssessmentStats>("/assessments/stats");
    },

    getReviewQueue: async (): Promise<AssessmentSummary[]> => {
        return request<AssessmentSummary[]>("/assessments/review-queue");
    },

    getById: async (id: string): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}`);
    },

    getTimeline: async (id: string): Promise<AssessmentTimelineEvent[]> => {
        return request<AssessmentTimelineEvent[]>(`/assessments/${id}/timeline`);
    },

    create: async (payload: CreateAssessmentPayload): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>("/assessments", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    update: async (id: string, payload: UpdateAssessmentPayload): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    },

    assign: async (id: string, payload: AssignAssessmentPayload): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}/assign`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    start: async (id: string): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}/start`, {
            method: "POST",
        });
    },

    submit: async (id: string, reason?: string): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}/submit`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        });
    },

    transition: async (
        id: string,
        target_state: AssessmentStatus,
        reason?: string
    ): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}/transition`, {
            method: "POST",
            body: JSON.stringify({ target_state, reason }),
        });
    },

    requestChanges: async (id: string, reason: string): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}/request-changes`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        });
    },

    resubmit: async (id: string, reason?: string): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}/resubmit`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        });
    },

    approve: async (id: string, comments?: string): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}/approve`, {
            method: "POST",
            body: JSON.stringify({ comments, reason: comments }),
        });
    },

    close: async (id: string, reason?: string): Promise<AssessmentDetail> => {
        return request<AssessmentDetail>(`/assessments/${id}/close`, {
            method: "POST",
            body: JSON.stringify({ reason }),
        });
    },

    addControl: async (
        assessmentId: string,
        payload: AddControlPayload
    ): Promise<AssessmentControlItem> => {
        return request<AssessmentControlItem>(`/assessments/${assessmentId}/controls`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    updateControl: async (
        assessmentId: string,
        assessmentControlId: string,
        payload: EvaluateControlPayload
    ): Promise<AssessmentControlItem> => {
        return request<AssessmentControlItem>(
            `/assessments/${assessmentId}/controls/${assessmentControlId}`,
            {
                method: "PATCH",
                body: JSON.stringify(payload),
            }
        );
    },

    verifyEvidence: async (
        evidenceId: string,
        payload: VerifyEvidencePayload
    ): Promise<AssessmentEvidenceItem> => {
        return request<AssessmentEvidenceItem>(`/assessments/evidence/${evidenceId}/verify`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
};
