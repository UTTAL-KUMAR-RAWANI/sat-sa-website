"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { getVisibleNavItems } from "@/lib/navigation/nav-config";
import {
    Shield,
    LogOut,
    LayoutDashboard,
    ShieldAlert,
    Search,
    ClipboardCheck,
    FileWarning,
    Activity,
    Lock,
    Settings,
    FileText,
    Wrench,
    Gavel,
    Database,
    EyeOff,
    ShieldCheck,
    Briefcase,
    CheckSquare,
} from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

// Icon mapping helper
const iconMap: Record<string, React.ReactNode> = {
    LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
    ShieldCheck: <ShieldCheck className="h-4 w-4" />,
    Briefcase: <Briefcase className="h-4 w-4" />,
    ShieldAlert: <ShieldAlert className="h-4 w-4" />,
    Search: <Search className="h-4 w-4" />,
    ClipboardCheck: <ClipboardCheck className="h-4 w-4" />,
    FileWarning: <FileWarning className="h-4 w-4" />,
    Activity: <Activity className="h-4 w-4" />,
    Lock: <Lock className="h-4 w-4" />,
    Settings: <Settings className="h-4 w-4" />,
    FileText: <FileText className="h-4 w-4" />,
    Wrench: <Wrench className="h-4 w-4" />,
    Gavel: <Gavel className="h-4 w-4" />,
    Database: <Database className="h-4 w-4" />,
    EyeOff: <EyeOff className="h-4 w-4" />,
    CheckSquare: <CheckSquare className="h-4 w-4" />,
};

export default function AppNavbar() {
    const { user, setUser } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const navItems = getVisibleNavItems(user);

    const handleLogout = async () => {
        try {
            await fetch("http://localhost:8000/api/v1/auth/logout", {
                method: "POST",
                credentials: "include",
            });
            setUser(null);
            router.push("/login");
        } catch (err) {
            console.error("Logout failed", err);
            router.push("/login");
        }
    };

    const primaryRole = user?.roles?.[0] || "User";
    const department = user?.department || "Platform";
    const scope = user?.scope || "org";

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Brand Logo */}
                <div className="flex items-center gap-8">
                    <Link href="/dashboard" className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20">
                            <Shield className="h-5 w-5 fill-slate-950" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-bold tracking-tight text-white">
                                SAT-SA
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                                Cyber Supervision
                            </span>
                        </div>
                    </Link>

                    {/* Navigation Items */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                                        isActive
                                            ? "bg-slate-800 text-white font-semibold shadow-sm"
                                            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                                    }`}
                                >
                                    {item.iconName && iconMap[item.iconName]}
                                    <span>{item.title}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* User Context & Action */}
                <div className="flex items-center gap-4">
                    {user && (
                        <div className="hidden sm:flex flex-col items-end">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white">
                                    {user.first_name ? `${user.first_name} ${user.last_name || ""}` : user.username}
                                </span>
                                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                                    {primaryRole}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span>{department}</span>
                                <span>•</span>
                                <span className="capitalize text-slate-500">{scope} Scope</span>
                            </div>
                        </div>
                    )}

                    <NotificationBell />

                    <button
                        onClick={handleLogout}
                        title="Sign Out"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}
