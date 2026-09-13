"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { getVisibleNavSections, NavSection } from "@/lib/navigation/nav-config";
import {
    Shield,
    LayoutDashboard,
    CheckSquare,
    ShieldAlert,
    Activity,
    Search,
    ClipboardCheck,
    FileWarning,
    Wrench,
    Gavel,
    CheckCircle2,
    Database,
    EyeOff,
    ShieldCheck,
    Briefcase,
    Settings,
    Users,
    Lock,
    Building2,
    Layers,
    FileText,
    Sliders,
    ChevronLeft,
    ChevronRight,
    X,
} from "lucide-react";

// Icon mapping dictionary
const iconMap: Record<string, React.ReactNode> = {
    LayoutDashboard: <LayoutDashboard className="h-4 w-4 shrink-0" />,
    CheckSquare: <CheckSquare className="h-4 w-4 shrink-0" />,
    ShieldAlert: <ShieldAlert className="h-4 w-4 shrink-0" />,
    Activity: <Activity className="h-4 w-4 shrink-0" />,
    Search: <Search className="h-4 w-4 shrink-0" />,
    ClipboardCheck: <ClipboardCheck className="h-4 w-4 shrink-0" />,
    FileWarning: <FileWarning className="h-4 w-4 shrink-0" />,
    Wrench: <Wrench className="h-4 w-4 shrink-0" />,
    Gavel: <Gavel className="h-4 w-4 shrink-0" />,
    CheckCircle2: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    Database: <Database className="h-4 w-4 shrink-0" />,
    EyeOff: <EyeOff className="h-4 w-4 shrink-0" />,
    ShieldCheck: <ShieldCheck className="h-4 w-4 shrink-0" />,
    Briefcase: <Briefcase className="h-4 w-4 shrink-0" />,
    Settings: <Settings className="h-4 w-4 shrink-0" />,
    Users: <Users className="h-4 w-4 shrink-0" />,
    Lock: <Lock className="h-4 w-4 shrink-0" />,
    Building2: <Building2 className="h-4 w-4 shrink-0" />,
    Layers: <Layers className="h-4 w-4 shrink-0" />,
    FileText: <FileText className="h-4 w-4 shrink-0" />,
    Sliders: <Sliders className="h-4 w-4 shrink-0" />,
};

interface AppSidebarProps {
    isOpenMobile: boolean;
    onCloseMobile: () => void;
}

export default function AppSidebar({ isOpenMobile, onCloseMobile }: AppSidebarProps) {
    const { user } = useAuth();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    const visibleSections: NavSection[] = getVisibleNavSections(user);

    const sidebarContent = (
        <div className="flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden">
            <div>
                {/* Brand Header */}
                <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800/80 bg-slate-950/80">
                    <Link
                        href="/dashboard"
                        onClick={onCloseMobile}
                        className="flex items-center gap-2.5 overflow-hidden"
                    >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20">
                            <Shield className="h-4 w-4 fill-slate-950" />
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col truncate">
                                <span className="text-sm font-bold tracking-tight text-white leading-none">
                                    SAT-SA
                                </span>
                                <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold mt-0.5">
                                    Cyber Supervision
                                </span>
                            </div>
                        )}
                    </Link>

                    {/* Mobile Close Button */}
                    <button
                        onClick={onCloseMobile}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-900 hover:text-white lg:hidden"
                        title="Close navigation"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Nav Section Groups */}
                <div className="p-3 space-y-5">
                    {visibleSections.map((section) => (
                        <div key={section.title} className="space-y-1">
                            {!collapsed && (
                                <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {section.title}
                                </div>
                            )}

                            <nav className="space-y-0.5">
                                {section.items.map((item) => {
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}/`));

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onCloseMobile}
                                            title={collapsed ? item.title : undefined}
                                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                                isActive
                                                    ? "bg-emerald-500/10 text-emerald-400 font-semibold border-l-2 border-emerald-500 shadow-sm"
                                                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                                            } ${collapsed ? "justify-center px-2" : ""}`}
                                        >
                                            {iconMap[item.iconName] || <Activity className="h-4 w-4 shrink-0" />}
                                            {!collapsed && <span className="truncate">{item.title}</span>}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    ))}
                </div>
            </div>

            {/* Desktop Collapse / Expand Trigger */}
            <div className="hidden lg:block p-3 border-t border-slate-800/80 bg-slate-950/60">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <>
                            <ChevronLeft className="h-4 w-4" />
                            <span className="text-[11px] font-medium">Collapse</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sticky Sidebar */}
            <aside
                className={`hidden lg:flex flex-col shrink-0 border-r border-slate-800/80 bg-slate-950 text-slate-100 transition-all duration-200 sticky top-0 h-screen z-30 ${
                    collapsed ? "w-16" : "w-64"
                }`}
            >
                {sidebarContent}
            </aside>

            {/* Mobile Slide-Out Drawer Backdrop */}
            {isOpenMobile && (
                <div
                    onClick={onCloseMobile}
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
                />
            )}

            {/* Mobile Slide-Out Drawer */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-800 bg-slate-950 text-slate-100 shadow-2xl transition-transform duration-200 lg:hidden ${
                    isOpenMobile ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                {sidebarContent}
            </aside>
        </>
    );
}
