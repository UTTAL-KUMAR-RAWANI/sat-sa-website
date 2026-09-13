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

export interface WorkItem {
    id: string;
    item_type: string;
    business_id: string;
    title: string;
    severity: string;
    status: string;
    role_relationship: string;
    due_date?: string | null;
    is_overdue: boolean;
    needs_review: boolean;
    is_critical: boolean;
    action_url: string;
    organization_name?: string | null;
    created_at: string;
}

export interface MyWorkSummaryResponse {
    total_assigned: number;
    needs_review_count: number;
    overdue_count: number;
    critical_count: number;
    by_category: Record<string, number>;
}

export interface MyWorkResponse {
    items: WorkItem[];
    summary: MyWorkSummaryResponse;
    effective_scope: string;
}

export const myWorkApi = {
    async getMyWork(bucket: "all" | "assigned" | "needs_review" | "overdue" | "critical" = "all"): Promise<MyWorkResponse> {
        return request<MyWorkResponse>(`/my-work?bucket=${bucket}`);
    },

    async getSummary(): Promise<MyWorkSummaryResponse> {
        return request<MyWorkSummaryResponse>("/my-work/summary");
    },
};
