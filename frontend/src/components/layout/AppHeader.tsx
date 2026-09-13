"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import {
    Menu,
    ChevronRight,
    User as UserIcon,
    Settings,
    LogOut,
    Shield,
    Activity,
    ExternalLink,
} from "lucide-react";

interface AppHeaderProps {
    onToggleMobileSidebar: () => void;
}

export default function AppHeader({ onToggleMobileSidebar }: AppHeaderProps) {
    const { user, setUser } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close user menu on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
        }
        if (userMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [userMenuOpen]);

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

    // Breadcrumbs generator from pathname
    const generateBreadcrumbs = () => {
        const segments = pathname.split("/").filter(Boolean);
        if (segments.length === 0) return [{ label: "Home", href: "/dashboard" }];

        const breadcrumbs = [{ label: "Home", href: "/dashboard" }];
        let currentPath = "";

        segments.forEach((seg, idx) => {
            currentPath += `/${seg}`;
            // Clean display title
            const label = seg
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());

            breadcrumbs.push({
                label: label.length > 25 ? `${label.substring(0, 22)}...` : label,
                href: idx === segments.length - 1 ? "" : currentPath,
            });
        });

        return breadcrumbs;
    };

    const breadcrumbs = generateBreadcrumbs();
    const primaryRole = user?.roles?.[0] || "User";
    const department = user?.department || "Platform";
    const scope = user?.scope || "org";

    return (
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-4 sm:px-6 backdrop-blur-md">
            {/* Left: Mobile Toggle & Breadcrumbs */}
            <div className="flex items-center gap-3 overflow-hidden">
                <button
                    onClick={onToggleMobileSidebar}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden shrink-0"
                    title="Open navigation menu"
                >
                    <Menu className="h-4 w-4" />
                </button>

                {/* Breadcrumbs navigation */}
                <nav className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 truncate">
                    {breadcrumbs.map((b, idx) => (
                        <React.Fragment key={idx}>
                            {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />}
                            {b.href ? (
                                <Link
                                    href={b.href}
                                    className="hover:text-slate-200 transition-colors truncate"
                                >
                                    {b.label}
                                </Link>
                            ) : (
                                <span className="font-semibold text-white truncate">{b.label}</span>
                            )}
                        </React.Fragment>
                    ))}
                </nav>
            </div>

            {/* Right: Telemetry Status, Notification Bell, User Profile */}
            <div className="flex items-center gap-3">
                {/* Active telemetry status pill */}
                <div className="hidden md:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Telemetry Active</span>
                </div>

                {/* Central Notifications Popover */}
                <NotificationBell />

                {/* User Context & Action Dropdown */}
                {user && (
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/90 py-1.5 px-2.5 hover:border-slate-700 transition-colors text-left"
                            title="User settings and profile"
                        >
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700">
                                {user.first_name ? user.first_name[0] : user.username[0].toUpperCase()}
                            </div>
                            <div className="hidden md:flex flex-col">
                                <span className="text-xs font-semibold text-white leading-tight">
                                    {user.first_name ? `${user.first_name} ${user.last_name || ""}` : user.username}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono leading-tight">
                                    {primaryRole}
                                </span>
                            </div>
                        </button>

                        {/* Dropdown Menu */}
                        {userMenuOpen && (
                            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in duration-150 space-y-1">
                                <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                                    <div className="text-xs font-bold text-white">
                                        {user.first_name ? `${user.first_name} ${user.last_name || ""}` : user.username}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono truncate">{user.email}</div>
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                                            {primaryRole}
                                        </span>
                                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 border border-slate-700 capitalize">
                                            {scope} Scope
                                        </span>
                                    </div>
                                </div>

                                <Link
                                    href="/profile"
                                    onClick={() => setUserMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
                                >
                                    <UserIcon className="h-4 w-4 text-slate-400" />
                                    <span>My Profile & Permissions</span>
                                </Link>

                                <Link
                                    href="/settings"
                                    onClick={() => setUserMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
                                >
                                    <Settings className="h-4 w-4 text-slate-400" />
                                    <span>Settings & Preferences</span>
                                </Link>

                                <div className="border-t border-slate-800/80 pt-1 mt-1">
                                    <button
                                        onClick={handleLogout}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}
