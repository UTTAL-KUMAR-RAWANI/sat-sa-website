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

export interface NotificationItem {
    id: string;
    recipient_id: string;
    type: string;
    title: string;
    message: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
    is_read: boolean;
    resource_type?: string | null;
    resource_id?: string | null;
    business_reference?: string | null;
    action_url?: string | null;
    read_at?: string | null;
    created_at: string;
}

export interface NotificationListResponse {
    items: NotificationItem[];
    total: number;
    unread_count: number;
    page: number;
    limit: number;
    pages: number;
}

export interface UnreadCountResponse {
    unread_count: number;
}

export const notificationsApi = {
    async list(params: {
        is_read?: boolean;
        priority?: string;
        type?: string;
        resource_type?: string;
        search?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<NotificationListResponse> {
        const query = new URLSearchParams();
        if (params.is_read !== undefined) query.set("is_read", String(params.is_read));
        if (params.priority && params.priority !== "ALL") query.set("priority", params.priority);
        if (params.type && params.type !== "ALL") query.set("type", params.type);
        if (params.resource_type && params.resource_type !== "ALL") query.set("resource_type", params.resource_type);
        if (params.search) query.set("search", params.search);
        if (params.page) query.set("page", String(params.page));
        if (params.limit) query.set("limit", String(params.limit));

        return request<NotificationListResponse>(`/notifications?${query.toString()}`);
    },

    async getUnreadCount(): Promise<UnreadCountResponse> {
        return request<UnreadCountResponse>("/notifications/unread-count");
    },

    async markAsRead(id: string): Promise<NotificationItem> {
        return request<NotificationItem>(`/notifications/${id}/read`, { method: "POST" });
    },

    async markAsUnread(id: string): Promise<NotificationItem> {
        return request<NotificationItem>(`/notifications/${id}/unread`, { method: "POST" });
    },

    async markAllAsRead(): Promise<{ message: string; updated_count: number }> {
        return request<{ message: string; updated_count: number }>("/notifications/read-all", { method: "POST" });
    },
};
