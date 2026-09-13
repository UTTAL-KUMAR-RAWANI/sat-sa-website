const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface ApiResponse<T> {
    data: T;
}

export const apiClient = {
    async get<T>(url: string, config?: { params?: Record<string, any> }): Promise<ApiResponse<T>> {
        let endpoint = `${API_BASE}${url}`;
        if (config?.params) {
            const searchParams = new URLSearchParams();
            Object.entries(config.params).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') {
                    searchParams.append(k, String(v));
                }
            });
            const qs = searchParams.toString();
            if (qs) {
                endpoint += `?${qs}`;
            }
        }
        const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const error: any = new Error(err.detail || `Request failed with status ${res.status}`);
            error.response = { data: err, status: res.status };
            throw error;
        }
        const data = await res.json();
        return { data };
    },

    async post<T>(url: string, body?: any): Promise<ApiResponse<T>> {
        const res = await fetch(`${API_BASE}${url}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const error: any = new Error(err.detail || `Request failed with status ${res.status}`);
            error.response = { data: err, status: res.status };
            throw error;
        }
        const data = await res.json();
        return { data };
    },

    async patch<T>(url: string, body?: any): Promise<ApiResponse<T>> {
        const res = await fetch(`${API_BASE}${url}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const error: any = new Error(err.detail || `Request failed with status ${res.status}`);
            error.response = { data: err, status: res.status };
            throw error;
        }
        const data = await res.json();
        return { data };
    },

    async delete<T>(url: string): Promise<ApiResponse<T>> {
        const res = await fetch(`${API_BASE}${url}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const error: any = new Error(err.detail || `Request failed with status ${res.status}`);
            error.response = { data: err, status: res.status };
            throw error;
        }
        const data = await res.json();
        return { data };
    },
};
