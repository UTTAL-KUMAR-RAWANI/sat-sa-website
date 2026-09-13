const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface SecurityEvent {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    event_type: string;
    source: string;
    source_system?: string;
    severity: string;
    organization_id?: string;
    organization_name?: string;
    sector_id?: string;
    sector_name?: string;
    raw_metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface Alert {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    severity: string;
    priority: string;
    status: string;
    source: string;
    security_event_id?: string;
    cse_id?: string;
    cse_business_id?: string;
    organization_id?: string;
    organization_name?: string;
    sector_id?: string;
    sector_name?: string;
    assigned_to_id?: string;
    assigned_to_name?: string;
    triage_notes?: string;
    triage_decision?: string;
    triaged_by_id?: string;
    triaged_by_name?: string;
    triaged_at?: string;
    created_at: string;
    updated_at: string;
}

export interface CSE {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    severity: string;
    priority: string;
    status: string;
    source: string;
    organization_id?: string;
    organization_name?: string;
    sector_id?: string;
    sector_name?: string;
    created_by_id?: string;
    created_by_name?: string;
    assigned_to_id?: string;
    assigned_to_name?: string;
    originating_alert_id?: string;
    originating_alert_business_id?: string;
    investigation_count: number;
    evidence_count: number;
    escalation_count: number;
    created_at: string;
    updated_at: string;
}

export interface Investigation {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    status: string;
    cse_id: string;
    cse_business_id?: string;
    cse_title?: string;
    lead_analyst_id?: string;
    lead_analyst_name?: string;
    started_at?: string;
    completed_at?: string;
    findings_summary?: string;
    evidence_count: number;
    created_at: string;
    updated_at: string;
}

export interface Evidence {
    id: string;
    business_id: string;
    title: string;
    description?: string;
    evidence_type: string;
    source?: string;
    filename?: string;
    content_type?: string;
    file_size?: number;
    checksum?: string;
    uploaded_by_id?: string;
    uploaded_by_name?: string;
    cse_id?: string;
    investigation_id?: string;
    created_at: string;
}

export interface Escalation {
    id: string;
    business_id: string;
    resource_type: string;
    resource_id: string;
    reason: string;
    severity: string;
    status: string;
    escalated_by_id: string;
    escalated_by_name?: string;
    escalated_to_id?: string;
    escalated_to_name?: string;
    escalated_to_role_id?: string;
    escalated_to_role_name?: string;
    resolution?: string;
    resolved_at?: string;
    created_at: string;
}

export interface TimelineEvent {
    id: string;
    event_type: "TRANSITION" | "ASSIGNMENT" | "ESCALATION" | "EVIDENCE" | "AUDIT";
    title: string;
    description?: string;
    actor_id?: string;
    actor_name?: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
        defaultHeaders["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
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

export const secopsApi = {
    // --- Security Events ---
    listSecurityEvents: (page = 1, limit = 20) =>
        request<PaginatedResponse<SecurityEvent>>(`/security-events?page=${page}&limit=${limit}`),

    // --- Alerts ---
    listAlerts: (params: { search?: string; status?: string; severity?: string; priority?: string; page?: number; limit?: number } = {}) => {
        const q = new URLSearchParams();
        if (params.search) q.append("search", params.search);
        if (params.status) q.append("status", params.status);
        if (params.severity) q.append("severity", params.severity);
        if (params.priority) q.append("priority", params.priority);
        q.append("page", (params.page || 1).toString());
        q.append("limit", (params.limit || 20).toString());
        return request<PaginatedResponse<Alert>>(`/alerts?${q.toString()}`);
    },

    getAlert: (id: string) => request<Alert>(`/alerts/${id}`),

    createAlert: (data: { title: string; description?: string; severity?: string; priority?: string; source?: string }) =>
        request<Alert>("/alerts", { method: "POST", body: JSON.stringify(data) }),

    triageAlert: (id: string, data: { decision: string; notes?: string; severity?: string; priority?: string; create_cse?: boolean }) =>
        request<Alert>(`/alerts/${id}/triage`, { method: "POST", body: JSON.stringify(data) }),

    transitionAlert: (id: string, data: { to_status: string; reason?: string }) =>
        request<Alert>(`/alerts/${id}/transition`, { method: "POST", body: JSON.stringify(data) }),

    // --- CSE ---
    listCSEs: (params: { search?: string; status?: string; severity?: string; priority?: string; page?: number; limit?: number } = {}) => {
        const q = new URLSearchParams();
        if (params.search) q.append("search", params.search);
        if (params.status) q.append("status", params.status);
        if (params.severity) q.append("severity", params.severity);
        if (params.priority) q.append("priority", params.priority);
        q.append("page", (params.page || 1).toString());
        q.append("limit", (params.limit || 20).toString());
        return request<PaginatedResponse<CSE>>(`/cse?${q.toString()}`);
    },

    getCSE: (id: string) => request<CSE>(`/cse/${id}`),

    createCSE: (data: { title: string; description?: string; severity?: string; priority?: string; source?: string }) =>
        request<CSE>("/cse", { method: "POST", body: JSON.stringify(data) }),

    updateCSE: (id: string, data: { title?: string; description?: string; severity?: string; priority?: string }) =>
        request<CSE>(`/cse/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    assignCSE: (id: string, data: { assigned_to_id: string; assignment_type?: string; notes?: string }) =>
        request<CSE>(`/cse/${id}/assign`, { method: "POST", body: JSON.stringify(data) }),

    transitionCSE: (id: string, data: { to_status: string; reason?: string }) =>
        request<CSE>(`/cse/${id}/transition`, { method: "POST", body: JSON.stringify(data) }),

    escalateCSE: (id: string, data: { reason: string; severity?: string; escalated_to_user_id?: string }) =>
        request<Escalation>(`/cse/${id}/escalate`, { method: "POST", body: JSON.stringify(data) }),

    getCSETimeline: (id: string) => request<TimelineEvent[]>(`/cse/${id}/timeline`),

    // --- Investigations ---
    listInvestigations: (params: { search?: string; status?: string; cse_id?: string; page?: number; limit?: number } = {}) => {
        const q = new URLSearchParams();
        if (params.search) q.append("search", params.search);
        if (params.status) q.append("status", params.status);
        if (params.cse_id) q.append("cse_id", params.cse_id);
        q.append("page", (params.page || 1).toString());
        q.append("limit", (params.limit || 20).toString());
        return request<PaginatedResponse<Investigation>>(`/investigations?${q.toString()}`);
    },

    getInvestigation: (id: string) => request<Investigation>(`/investigations/${id}`),

    createInvestigation: (data: { cse_id: string; title: string; description?: string }) =>
        request<Investigation>("/investigations", { method: "POST", body: JSON.stringify(data) }),

    updateInvestigation: (id: string, data: { title?: string; description?: string; findings_summary?: string }) =>
        request<Investigation>(`/investigations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    transitionInvestigation: (id: string, data: { to_status: string; reason?: string }) =>
        request<Investigation>(`/investigations/${id}/transition`, { method: "POST", body: JSON.stringify(data) }),

    getInvestigationTimeline: (id: string) => request<TimelineEvent[]>(`/investigations/${id}/timeline`),

    // --- Evidence ---
    uploadEvidence: (formData: FormData) =>
        request<Evidence>("/evidence/upload", { method: "POST", body: formData }),

    getEvidence: (id: string) => request<Evidence>(`/evidence/${id}`),

    getEvidenceDownloadUrl: (id: string) => `${API_BASE}/evidence/${id}/download`,

    // --- Escalations ---
    listEscalations: (status?: string, page = 1, limit = 20) => {
        const q = new URLSearchParams();
        if (status) q.append("status", status);
        q.append("page", page.toString());
        q.append("limit", limit.toString());
        return request<PaginatedResponse<Escalation>>(`/escalations?${q.toString()}`);
    },

    resolveEscalation: (id: string, data: { status?: string; resolution: string }) =>
        request<Escalation>(`/escalations/${id}/resolve`, { method: "POST", body: JSON.stringify(data) }),
};
