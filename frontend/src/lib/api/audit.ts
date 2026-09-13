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

export interface AuditActorInfo {
    id?: string | null;
    username?: string | null;
    email?: string | null;
    name?: string | null;
    role?: string | null;
}

export interface AuditLogItem {
    id: string;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    business_reference?: string | null;
    reason?: string | null;
    old_value?: any;
    new_value?: any;
    metadata_json?: any;
    organization_id?: string | null;
    organization_name?: string | null;
    sector_id?: string | null;
    sector_name?: string | null;
    actor?: AuditActorInfo | null;
    created_at: string;
}

export interface PaginatedAuditLogsResponse {
    items: AuditLogItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface ResourceHistoryItem {
    id: string;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    business_reference?: string | null;
    actor_name: string;
    actor_role?: string | null;
    reason?: string | null;
    status_transition?: {
        from?: string | null;
        to?: string | null;
    } | null;
    field_changes?: Array<{
        field: string;
        old?: string | null;
        new?: string | null;
    }>;
    created_at: string;
}

export const auditApi = {
    async list(params: {
        actor_id?: string;
        action?: string;
        resource_type?: string;
        search?: string;
        date_from?: string;
        date_to?: string;
        organization_id?: string;
        sector_id?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<PaginatedAuditLogsResponse> {
        const query = new URLSearchParams();
        if (params.actor_id) query.set("actor_id", params.actor_id);
        if (params.action && params.action !== "ALL") query.set("action", params.action);
        if (params.resource_type && params.resource_type !== "ALL") query.set("resource_type", params.resource_type);
        if (params.search) query.set("search", params.search);
        if (params.date_from) query.set("date_from", params.date_from);
        if (params.date_to) query.set("date_to", params.date_to);
        if (params.organization_id) query.set("organization_id", params.organization_id);
        if (params.sector_id) query.set("sector_id", params.sector_id);
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));

        return request<PaginatedAuditLogsResponse>(`/audit-logs?${query.toString()}`);
    },

    async getResourceHistory(resourceType: string, resourceId: string): Promise<ResourceHistoryItem[]> {
        return request<ResourceHistoryItem[]>(`/audit-logs/resource/${resourceType}/${resourceId}`);
    },

    async exportCSV(params: {
        actor_id?: string;
        action?: string;
        resource_type?: string;
        search?: string;
        date_from?: string;
        date_to?: string;
    } = {}): Promise<Blob> {
        const query = new URLSearchParams();
        if (params.actor_id) query.set("actor_id", params.actor_id);
        if (params.action && params.action !== "ALL") query.set("action", params.action);
        if (params.resource_type && params.resource_type !== "ALL") query.set("resource_type", params.resource_type);
        if (params.search) query.set("search", params.search);
        if (params.date_from) query.set("date_from", params.date_from);
        if (params.date_to) query.set("date_to", params.date_to);

        const res = await fetch(`${API_BASE}/audit-logs/export?${query.toString()}`, {
            credentials: "include",
        });

        if (!res.ok) {
            let errorDetail = "Failed to export audit logs.";
            try {
                const err = await res.json();
                errorDetail = err.detail || errorDetail;
            } catch {}
            throw new Error(errorDetail);
        }

        return res.blob();
    },
};
