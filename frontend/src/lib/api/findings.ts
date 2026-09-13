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

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
export type FindingPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
export type FindingStatus =
    | "IDENTIFIED"
    | "DRAFT"
    | "SUBMITTED"
    | "REVIEW"
    | "CONFIRMED"
    | "REMEDIATION_REQUIRED"
    | "REMEDIATION"
    | "VALIDATION"
    | "CLOSED"
    | "REJECTED";

export type FindingSourceType =
    | "CSE"
    | "INVESTIGATION"
    | "ASSESSMENT"
    | "AUDIT"
    | "RISK_ANALYSIS"
    | "NEGATIVE_SPACE"
    | "SUPERVISORY_REVIEW";

export type FindingCommentType = "REVIEW_NOTE" | "CHANGE_REQUEST" | "DECISION_NOTE" | "GENERAL_COMMENT";

export interface FindingComment {
    id: string;
    finding_id: string;
    author_id: string;
    author_name?: string;
    author_role?: string;
    comment: string;
    comment_type: FindingCommentType;
    created_at: string;
}

export interface FindingEvidenceItem {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    evidence_type: string;
    file_uri?: string;
    filename?: string;
    file_size?: number;
    checksum?: string;
    created_at: string;
    uploaded_by_name?: string;
}

export interface Finding {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    severity: FindingSeverity;
    priority: FindingPriority;
    status: FindingStatus;
    classification: string;
    source_type: FindingSourceType;
    source_id?: string;

    cse_id?: string;
    cse_business_id?: string;
    cse_title?: string;

    investigation_id?: string;
    investigation_business_id?: string;
    investigation_title?: string;

    control_id?: string;
    control_business_id?: string;
    control_name?: string;

    organization_id?: string;
    organization_name?: string;
    sector_id?: string;
    sector_name?: string;

    created_by_id?: string;
    created_by_name?: string;
    assigned_to_id?: string;
    assigned_to_name?: string;
    assigned_by_id?: string;
    assigned_by_name?: string;
    assigned_at?: string;

    due_date?: string;
    is_overdue: boolean;
    remediation_required: boolean;

    created_at: string;
    updated_at: string;

    evidence: FindingEvidenceItem[];
    comments: FindingComment[];

    has_related_remediation: boolean;
    related_remediation_id?: string;
    has_related_risk: boolean;
    related_risk_id?: string;
}

export interface FindingListResponse {
    items: Finding[];
    total: number;
    page: number;
    page_size: number;
}

export interface FindingStats {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
    under_review: number;
    confirmed: number;
    remediation_required: number;
    overdue: number;
    closed: number;
}

export interface FindingTimelineEvent {
    event_type: string;
    timestamp: string;
    actor_name: string;
    summary: string;
    details?: string;
}

export interface FindingCreatePayload {
    title: string;
    description?: string;
    severity?: FindingSeverity;
    priority?: FindingPriority;
    classification?: string;
    source_type?: FindingSourceType;
    source_id?: string;
    cse_id?: string;
    investigation_id?: string;
    control_id?: string;
    organization_id?: string;
    sector_id?: string;
    assigned_to_id?: string;
    due_date?: string;
}

export interface FindingUpdatePayload {
    title?: string;
    description?: string;
    severity?: FindingSeverity;
    priority?: FindingPriority;
    classification?: string;
    due_date?: string;
    control_id?: string;
}

export interface FindingTransitionPayload {
    target_state: FindingStatus;
    reason?: string;
    review_notes?: string;
    remediation_required?: boolean;
}

export interface FindingAssignPayload {
    assigned_to_id: string;
    due_date?: string;
    notes?: string;
}

export interface FindingCommentPayload {
    comment: string;
    comment_type?: FindingCommentType;
}

export const findingsApi = {
    async getFindings(params?: {
        status?: string;
        severity?: string;
        priority?: string;
        source_type?: string;
        search?: string;
        page?: number;
        page_size?: number;
    }): Promise<FindingListResponse> {
        const q = new URLSearchParams();
        if (params?.status) q.append("status", params.status);
        if (params?.severity) q.append("severity", params.severity);
        if (params?.priority) q.append("priority", params.priority);
        if (params?.source_type) q.append("source_type", params.source_type);
        if (params?.search) q.append("search", params.search);
        if (params?.page) q.append("page", params.page.toString());
        if (params?.page_size) q.append("page_size", params.page_size.toString());

        const queryStr = q.toString() ? `?${q.toString()}` : "";
        return request<FindingListResponse>(`/findings${queryStr}`);
    },

    async getFindingStats(): Promise<FindingStats> {
        return request<FindingStats>("/findings/stats");
    },

    async getFinding(id: string): Promise<Finding> {
        return request<Finding>(`/findings/${id}`);
    },

    async createFinding(payload: FindingCreatePayload): Promise<Finding> {
        return request<Finding>("/findings", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    async updateFinding(id: string, payload: FindingUpdatePayload): Promise<Finding> {
        return request<Finding>(`/findings/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    },

    async transitionFinding(id: string, payload: FindingTransitionPayload): Promise<Finding> {
        return request<Finding>(`/findings/${id}/transition`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    async assignFinding(id: string, payload: FindingAssignPayload): Promise<Finding> {
        return request<Finding>(`/findings/${id}/assign`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    async addComment(id: string, payload: FindingCommentPayload): Promise<FindingComment> {
        return request<FindingComment>(`/findings/${id}/comments`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    async attachEvidence(id: string, evidenceId: string): Promise<Finding> {
        return request<Finding>(`/findings/${id}/evidence?evidence_id=${evidenceId}`, {
            method: "POST",
        });
    },

    async getTimeline(id: string): Promise<FindingTimelineEvent[]> {
        return request<FindingTimelineEvent[]>(`/findings/${id}/timeline`);
    }
};
