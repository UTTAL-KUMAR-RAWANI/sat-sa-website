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

export type RiskCategory =
    | "Cybersecurity"
    | "Operational"
    | "Compliance"
    | "Technology"
    | "Data Security"
    | "Access Control"
    | "Infrastructure"
    | "Third Party"
    | "Business Continuity"
    | "Privacy";

export type RiskStatus =
    | "IDENTIFIED"
    | "ASSESSED"
    | "TREATMENT_REQUIRED"
    | "TREATMENT_PLANNED"
    | "MONITORED"
    | "ACCEPTED"
    | "CLOSED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskTreatmentStrategy = "MITIGATE" | "ACCEPT" | "TRANSFER" | "AVOID";
export type RiskTreatmentStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type RiskExceptionStatus =
    | "REQUESTED"
    | "UNDER_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "EXPIRED"
    | "CLOSED";

export interface RiskTreatmentItem {
    id: string;
    business_id: string;
    risk_id: string;
    title: string;
    description: string;
    strategy: RiskTreatmentStrategy;
    status: RiskTreatmentStatus;
    mitigation_actions?: string;
    transfer_details?: string;
    avoidance_details?: string;
    justification?: string;
    target_date?: string;
    owner_id?: string;
    owner_name?: string;
    created_by_id?: string;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
}

export interface RiskExceptionItem {
    id: string;
    business_id: string;
    risk_id: string;
    title: string;
    justification: string;
    requested_by_id: string;
    requested_by_name?: string;
    owner_id?: string;
    owner_name?: string;
    approved_by_id?: string;
    approved_by_name?: string;
    start_date?: string;
    expiry_date?: string;
    status: RiskExceptionStatus;
    reviewed_at?: string;
    reviewer_comments?: string;
    created_at: string;
    updated_at: string;
}

export interface RiskSummary {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    category: RiskCategory;
    source: string;
    source_reference?: string;
    source_id?: string;
    status: RiskStatus;

    finding_id?: string;
    finding_business_id?: string;
    finding_title?: string;

    assessment_id?: string;
    assessment_business_id?: string;
    assessment_title?: string;

    control_id?: string;
    control_business_id?: string;
    control_name?: string;

    cse_id?: string;
    cse_business_id?: string;
    cse_title?: string;

    organization_id?: string;
    organization_name?: string;
    sector_id?: string;
    sector_name?: string;
    asset_or_system?: string;

    owner_id?: string;
    owner_name?: string;
    identified_by_id?: string;
    identified_by_name?: string;
    accepted_by_id?: string;
    accepted_by_name?: string;

    likelihood: number;
    impact: number;
    inherent_score: number;
    inherent_risk_level: RiskLevel;

    existing_controls_description?: string;

    residual_likelihood?: number;
    residual_impact?: number;
    residual_score?: number;
    residual_risk_level?: RiskLevel;

    treatment_strategy?: RiskTreatmentStrategy;
    treatment_owner_id?: string;
    treatment_owner_name?: string;
    treatment_target_date?: string;
    treatment_description?: string;

    acceptance_justification?: string;
    accepted_at?: string;
    review_date?: string;
    target_date?: string;
    is_overdue: boolean;

    treatments_count: number;
    exceptions_count: number;

    created_at: string;
    updated_at: string;
}

export interface RiskDetail extends RiskSummary {
    treatments: RiskTreatmentItem[];
    exceptions: RiskExceptionItem[];
}

export interface RiskStats {
    total_risks: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    treatment_required: number;
    accepted: number;
    overdue: number;
    open_exceptions: number;
    matrix_distribution: Record<string, number>;
}

export interface RiskTimelineEvent {
    id: string;
    risk_id: string;
    event_type: string;
    title: string;
    description: string;
    actor_id?: string;
    actor_name?: string;
    created_at: string;
}

export interface CreateRiskPayload {
    title: string;
    description?: string;
    category?: string;
    source?: string;
    source_reference?: string;
    source_id?: string;
    finding_id?: string;
    assessment_id?: string;
    control_id?: string;
    cse_id?: string;
    organization_id?: string;
    sector_id?: string;
    asset_or_system?: string;
    likelihood: number;
    impact: number;
    existing_controls_description?: string;
    owner_id?: string;
    target_date?: string;
}

export interface InherentAssessmentPayload {
    likelihood: number;
    impact: number;
}

export interface ResidualAssessmentPayload {
    residual_likelihood: number;
    residual_impact: number;
    existing_controls_description?: string;
}

export interface TreatmentDecisionPayload {
    strategy: RiskTreatmentStrategy;
    treatment_description?: string;
    mitigation_actions?: string;
    transfer_details?: string;
    avoidance_details?: string;
    target_date?: string;
    treatment_owner_id?: string;
}

export interface RiskAcceptancePayload {
    acceptance_justification: string;
    review_date?: string;
}

export interface CreateTreatmentPayload {
    title: string;
    description: string;
    strategy: RiskTreatmentStrategy;
    mitigation_actions?: string;
    transfer_details?: string;
    avoidance_details?: string;
    justification?: string;
    target_date?: string;
    owner_id?: string;
}

export interface CreateExceptionPayload {
    title: string;
    justification: string;
    owner_id?: string;
    start_date?: string;
    expiry_date?: string;
}

export const risksApi = {
    getAll: async (params?: {
        status?: string;
        category?: string;
        level?: string;
        source?: string;
        organization_id?: string;
        search?: string;
        skip?: number;
        limit?: number;
    }): Promise<RiskSummary[]> => {
        const query = new URLSearchParams();
        if (params?.status) query.append("status", params.status);
        if (params?.category) query.append("category", params.category);
        if (params?.level) query.append("level", params.level);
        if (params?.source) query.append("source", params.source);
        if (params?.organization_id) query.append("organization_id", params.organization_id);
        if (params?.search) query.append("search", params.search);
        if (params?.skip !== undefined) query.append("skip", params.skip.toString());
        if (params?.limit !== undefined) query.append("limit", params.limit.toString());
        const qs = query.toString() ? `?${query.toString()}` : "";
        return request<RiskSummary[]>(`/risks${qs}`);
    },

    getStats: async (): Promise<RiskStats> => {
        return request<RiskStats>("/risks/stats");
    },

    getById: async (id: string): Promise<RiskDetail> => {
        return request<RiskDetail>(`/risks/${id}`);
    },

    create: async (payload: CreateRiskPayload): Promise<RiskSummary> => {
        return request<RiskSummary>("/risks", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    update: async (id: string, payload: Partial<CreateRiskPayload>): Promise<RiskSummary> => {
        return request<RiskSummary>(`/risks/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    },

    assessInherent: async (id: string, payload: InherentAssessmentPayload): Promise<RiskSummary> => {
        return request<RiskSummary>(`/risks/${id}/assess-inherent`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    assessResidual: async (id: string, payload: ResidualAssessmentPayload): Promise<RiskSummary> => {
        return request<RiskSummary>(`/risks/${id}/assess-residual`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    decideTreatment: async (id: string, payload: TreatmentDecisionPayload): Promise<RiskSummary> => {
        return request<RiskSummary>(`/risks/${id}/treatment`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    accept: async (id: string, payload: RiskAcceptancePayload): Promise<RiskSummary> => {
        return request<RiskSummary>(`/risks/${id}/accept`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    transition: async (id: string, target_state: string, reason?: string): Promise<RiskSummary> => {
        return request<RiskSummary>(`/risks/${id}/transition`, {
            method: "POST",
            body: JSON.stringify({ target_state, reason }),
        });
    },

    getTimeline: async (id: string): Promise<RiskTimelineEvent[]> => {
        return request<RiskTimelineEvent[]>(`/risks/${id}/timeline`);
    },

    // Treatments
    getTreatments: async (
        params?: string | { risk_id?: string; strategy?: string; status?: string }
    ): Promise<RiskTreatmentItem[]> => {
        const query = new URLSearchParams();
        if (typeof params === "string") {
            query.append("risk_id", params);
        } else if (params) {
            if (params.risk_id) query.append("risk_id", params.risk_id);
            if (params.strategy) query.append("strategy", params.strategy);
            if (params.status) query.append("status", params.status);
        }
        const qs = query.toString() ? `?${query.toString()}` : "";
        return request<RiskTreatmentItem[]>(`/risk-treatments${qs}`);
    },

    updateTreatment: async (
        treatmentId: string,
        payload: { status?: string; mitigation_actions?: string; target_date?: string; owner_id?: string }
    ): Promise<RiskTreatmentItem> => {
        return request<RiskTreatmentItem>(`/risk-treatments/${treatmentId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    },

    createTreatment: async (riskId: string, payload: CreateTreatmentPayload): Promise<RiskTreatmentItem> => {
        return request<RiskTreatmentItem>(`/risk-treatments/risk/${riskId}`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    // Exceptions
    getExceptions: async (
        params?: string | { risk_id?: string; status?: string },
        legacyStatus?: string
    ): Promise<RiskExceptionItem[]> => {
        const query = new URLSearchParams();
        if (typeof params === "string") {
            query.append("risk_id", params);
            if (legacyStatus) query.append("status", legacyStatus);
        } else if (params) {
            if (params.risk_id) query.append("risk_id", params.risk_id);
            if (params.status) query.append("status", params.status);
        }
        const qs = query.toString() ? `?${query.toString()}` : "";
        return request<RiskExceptionItem[]>(`/risk-exceptions${qs}`);
    },

    createException: async (riskId: string, payload: CreateExceptionPayload): Promise<RiskExceptionItem> => {
        return request<RiskExceptionItem>(`/risk-exceptions/risk/${riskId}`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    decideException: async (
        exceptionId: string,
        payload: { decision: "APPROVED" | "REJECTED"; reviewer_comments?: string; expiry_date?: string }
    ): Promise<RiskExceptionItem> => {
        return request<RiskExceptionItem>(`/risk-exceptions/${exceptionId}/decision`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    reviewException: async (
        exceptionId: string,
        payload: { decision: "APPROVED" | "REJECTED"; reviewer_comments?: string; expiry_date?: string }
    ): Promise<RiskExceptionItem> => {
        return request<RiskExceptionItem>(`/risk-exceptions/${exceptionId}/decision`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
};
