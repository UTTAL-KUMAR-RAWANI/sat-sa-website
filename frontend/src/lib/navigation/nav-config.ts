import { User } from "../auth/auth-types";
import { Permissions, hasAnyPermission } from "../rbac/permissions";

export interface NavItem {
    title: string;
    href: string;
    iconName: string;
    requiredPermissions?: string[];
    requiredRoles?: string[];
    badge?: string;
}

export interface NavSection {
    title: string;
    items: NavItem[];
}

export const navigationSections: NavSection[] = [
    {
        title: "Overview",
        items: [
            {
                title: "Dashboard",
                href: "/dashboard",
                iconName: "LayoutDashboard",
            },
            {
                title: "My Work",
                href: "/my-work",
                iconName: "CheckSquare",
                requiredPermissions: [Permissions.MY_WORK_READ],
            },
        ],
    },
    {
        title: "Operations",
        items: [
            {
                title: "Alerts",
                href: "/alerts",
                iconName: "ShieldAlert",
                requiredPermissions: [Permissions.ALERTS_READ],
            },
            {
                title: "CSE Exposure",
                href: "/cse",
                iconName: "Activity",
                requiredPermissions: [Permissions.CSE_READ],
            },
            {
                title: "Investigations",
                href: "/investigations",
                iconName: "Search",
                requiredPermissions: [Permissions.INVESTIGATIONS_READ],
            },
        ],
    },
    {
        title: "Assessment",
        items: [
            {
                title: "Findings",
                href: "/findings",
                iconName: "FileWarning",
                requiredPermissions: [Permissions.FINDING_READ],
            },
            {
                title: "Assessments",
                href: "/assessments",
                iconName: "ClipboardCheck",
                requiredPermissions: [Permissions.ASSESSMENT_READ],
            },
        ],
    },
    {
        title: "Risk & Remediation",
        items: [
            {
                title: "Risk & GRC",
                href: "/risks",
                iconName: "ShieldAlert",
                requiredPermissions: [Permissions.RISK_READ],
            },
            {
                title: "Remediations",
                href: "/remediations",
                iconName: "Wrench",
                requiredPermissions: [Permissions.REMEDIATION_READ],
            },
        ],
    },
    {
        title: "Supervision",
        items: [
            {
                title: "Supervisory Cases",
                href: "/supervision",
                iconName: "Gavel",
                requiredPermissions: [
                    Permissions.SUPERVISION_READ,
                    Permissions.SUPERVISORY_CASE_READ,
                ],
            },
            {
                title: "Escalations",
                href: "/supervision/escalations",
                iconName: "ShieldAlert",
                requiredPermissions: [Permissions.ESCALATION_READ],
            },
            {
                title: "Decisions",
                href: "/supervision/decisions",
                iconName: "CheckCircle2",
                requiredPermissions: [Permissions.SUPERVISION_DECISIONS],
            },
        ],
    },
    {
        title: "Analytics",
        items: [
            {
                title: "Datasets",
                href: "/datasets",
                iconName: "Database",
                requiredPermissions: [Permissions.DATASET_READ, Permissions.DATASETS_READ],
            },
            {
                title: "Negative Space",
                href: "/negative-space",
                iconName: "EyeOff",
                requiredPermissions: [Permissions.NEGATIVE_SPACE_READ],
            },
        ],
    },
    {
        title: "Executive",
        items: [
            {
                title: "CISO Leadership",
                href: "/ciso",
                iconName: "ShieldCheck",
                requiredPermissions: [Permissions.EXECUTIVE_CISO_READ],
            },
            {
                title: "Senior Management",
                href: "/management",
                iconName: "Briefcase",
                requiredPermissions: [Permissions.EXECUTIVE_MANAGEMENT_READ],
            },
        ],
    },
    {
        title: "Administration",
        items: [
            {
                title: "Admin Overview",
                href: "/admin/dashboard",
                iconName: "Settings",
                requiredPermissions: [Permissions.USERS_MANAGE, Permissions.SYSTEM_STATUS_READ],
            },
            {
                title: "Users",
                href: "/admin/users",
                iconName: "Users",
                requiredPermissions: [Permissions.USERS_MANAGE],
            },
            {
                title: "Roles & Permissions",
                href: "/admin/roles",
                iconName: "Lock",
                requiredPermissions: [Permissions.ROLES_MANAGE, Permissions.PERMISSIONS_MANAGE],
            },
            {
                title: "Organizations",
                href: "/admin/organizations",
                iconName: "Building2",
                requiredPermissions: [Permissions.USERS_MANAGE],
            },
            {
                title: "Sectors",
                href: "/admin/sectors",
                iconName: "Layers",
                requiredPermissions: [Permissions.USERS_MANAGE],
            },
            {
                title: "Audit Repository",
                href: "/admin/audit-logs",
                iconName: "FileText",
                requiredPermissions: [Permissions.AUDIT_LOGS_READ],
            },
            {
                title: "System Settings",
                href: "/admin/settings",
                iconName: "Sliders",
                requiredPermissions: [Permissions.SYSTEM_SETTINGS_MANAGE, Permissions.SYSTEM_STATUS_READ],
            },
        ],
    },
];

// Flat navigation items for legacy compatibility
export const navigationItems: NavItem[] = navigationSections.flatMap((s) => s.items);

export function getVisibleNavSections(user: User | null): NavSection[] {
    if (!user) return [];

    return navigationSections
        .map((section) => {
            const permittedItems = section.items.filter((item) => {
                if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
                    return true;
                }
                return hasAnyPermission(user, item.requiredPermissions);
            });

            return {
                title: section.title,
                items: permittedItems,
            };
        })
        .filter((section) => section.items.length > 0);
}

export function getVisibleNavItems(user: User | null): NavItem[] {
    return getVisibleNavSections(user).flatMap((s) => s.items);
}
