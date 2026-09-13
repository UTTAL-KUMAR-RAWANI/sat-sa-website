export interface User {
    id: string;
    email: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    is_active: boolean;
    roles: string[];
    department: string | null;
    permissions: string[];
    scope: string;
    organization_id: string | null;
    sector_id: string | null;
}
