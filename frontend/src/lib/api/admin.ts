const API_BASE = "http://localhost:8000/api/v1/admin";

export interface DashboardStats {
    total_users: number;
    active_users: number;
    inactive_users: number;
    total_organizations: number;
    total_sectors: number;
    total_departments: number;
    total_roles: number;
    pending_access_requests: number;
    system_status: string;
    database_connected: boolean;
    recent_audit_actions: Array<{
        id: string;
        action: string;
        resource_type: string;
        actor_email: string;
        timestamp: string;
    }>;
}

export interface AdminUser {
    id: string;
    username: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    is_active: boolean;
    created_at: string;
    department_id: string | null;
    department_name: string | null;
    organization_id: string | null;
    organization_name: string | null;
    sector_id: string | null;
    sector_name: string | null;
    roles: string[];
    scope: string;
}

export interface AdminRole {
    id: string;
    name: string;
    description: string | null;
    scope_type: string;
    is_active: boolean;
    permission_count: number;
    assigned_users_count: number;
    permissions: string[];
}

export interface GroupedPermissions {
    category: string;
    permissions: Array<{
        id: string;
        name: string;
        description: string | null;
    }>;
}

export interface DepartmentItem {
    id: string;
    name: string;
    description: string | null;
    user_count: number;
}

export interface OrganizationItem {
    id: string;
    name: string;
    description: string | null;
    sector_count: number;
    user_count: number;
}

export interface SectorItem {
    id: string;
    name: string;
    description: string | null;
    organization_id: string;
    organization_name: string | null;
    user_count: number;
}

export interface AccessRequestItem {
    id: string;
    requester_id: string;
    requester_name: string;
    requester_email: string;
    requested_role_id: string | null;
    requested_role_name: string | null;
    requested_organization_id: string | null;
    requested_organization_name: string | null;
    requested_sector_id: string | null;
    requested_sector_name: string | null;
    status: string;
    reason: string | null;
    reviewer_name: string | null;
    created_at: string;
}

export interface AuditLogItem {
    id: string;
    actor_id: string | null;
    actor_name: string | null;
    actor_email: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    details: Record<string, any> | null;
    created_at: string;
}

export interface SystemSettingItem {
    id: string;
    key: string;
    value: string;
    category: string;
    description: string | null;
    is_secret: boolean;
    updated_at: string;
}

export interface SystemStatusData {
    status: string;
    database_status: string;
    database_latency_ms: number;
    server_time: string;
    active_connections: number;
    app_version: string;
    environment: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    if (!res.ok) {
        let errorDetail = "Request failed";
        try {
            const errData = await res.json();
            errorDetail = errData.detail || errorDetail;
        } catch {
            // ignore
        }
        throw new Error(errorDetail);
    }

    return res.json();
}

// API functions
export const fetchAdminDashboard = () => request<DashboardStats>("/dashboard");

export const fetchAdminUsers = (params?: { query?: string; department_id?: string; is_active?: boolean }) => {
    const queryParts = [];
    if (params?.query) queryParts.push(`query=${encodeURIComponent(params.query)}`);
    if (params?.department_id) queryParts.push(`department_id=${encodeURIComponent(params.department_id)}`);
    if (params?.is_active !== undefined) queryParts.push(`is_active=${params.is_active}`);
    const qs = queryParts.length ? `?${queryParts.join("&")}` : "";
    return request<AdminUser[]>(`/users${qs}`);
};

export const createAdminUser = (data: {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    department_id?: string;
    organization_id?: string;
    sector_id?: string;
    role_ids?: string[];
}) => request<AdminUser>("/users", { method: "POST", body: JSON.stringify(data) });

export const updateAdminUser = (userId: string, data: any) =>
    request<AdminUser>(`/users/${userId}`, { method: "PATCH", body: JSON.stringify(data) });

export const toggleUserActive = (userId: string, isActive: boolean) =>
    request<AdminUser>(`/users/${userId}/status`, { method: "POST", body: JSON.stringify({ is_active: isActive }) });

export const fetchAdminRoles = () => request<AdminRole[]>("/roles");

export const updateRolePermissions = (roleId: string, permissionIds: string[]) =>
    request<AdminRole>(`/roles/${roleId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permission_ids: permissionIds }),
    });

export const fetchAdminPermissions = () => request<GroupedPermissions[]>("/permissions");

export const fetchAdminDepartments = () => request<DepartmentItem[]>("/departments");

export const createAdminDepartment = (data: { name: string; description?: string }) =>
    request<DepartmentItem>("/departments", { method: "POST", body: JSON.stringify(data) });

export const fetchAdminOrganizations = () => request<OrganizationItem[]>("/organizations");

export const createAdminOrganization = (data: { name: string; description?: string }) =>
    request<OrganizationItem>("/organizations", { method: "POST", body: JSON.stringify(data) });

export const fetchAdminSectors = () => request<SectorItem[]>("/sectors");

export const createAdminSector = (data: { name: string; description?: string; organization_id: string }) =>
    request<SectorItem>("/sectors", { method: "POST", body: JSON.stringify(data) });

export const fetchAdminAccessRequests = (status?: string) =>
    request<AccessRequestItem[]>(`/access-requests${status ? `?status=${status}` : ""}`);

export const reviewAdminAccessRequest = (requestId: string, decision: "APPROVE" | "REJECT", comments?: string) =>
    request<AccessRequestItem>(`/access-requests/${requestId}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, comments }),
    });

export const fetchAdminAuditLogs = (params?: { action?: string; resource_type?: string; skip?: number; limit?: number }) => {
    const queryParts = [];
    if (params?.action) queryParts.push(`action=${encodeURIComponent(params.action)}`);
    if (params?.resource_type) queryParts.push(`resource_type=${encodeURIComponent(params.resource_type)}`);
    if (params?.skip !== undefined) queryParts.push(`skip=${params.skip}`);
    if (params?.limit !== undefined) queryParts.push(`limit=${params.limit}`);
    const qs = queryParts.length ? `?${queryParts.join("&")}` : "";
    return request<{ total: number; items: AuditLogItem[] }>(`/audit-logs${qs}`);
};

export const fetchAdminSettings = () => request<SystemSettingItem[]>("/settings");

export const updateAdminSetting = (key: string, value: string) =>
    request<SystemSettingItem>(`/settings/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify({ value }),
    });

export const fetchAdminSystemStatus = () => request<SystemStatusData>("/system-status");
