"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ExternalLink, ShieldAlert, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { notificationsApi, NotificationItem } from "@/lib/api/notifications";

export default function NotificationBell() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const fetchCountsAndRecent = async () => {
        try {
            const countData = await notificationsApi.getUnreadCount();
            setUnreadCount(countData.unread_count);

            const listData = await notificationsApi.list({ limit: 5 });
            setRecentNotifications(listData.items);
        } catch (err) {
            // Silently swallow in navbar poll to avoid disrupting user experience
            console.error("Failed to load notifications:", err);
        }
    };

    useEffect(() => {
        fetchCountsAndRecent();
        const interval = setInterval(fetchCountsAndRecent, 30000); // 30s polling
        return () => clearInterval(interval);
    }, []);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleMarkAllRead = async () => {
        try {
            setLoading(true);
            await notificationsApi.markAllAsRead();
            setUnreadCount(0);
            setRecentNotifications((prev) =>
                prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
        } catch (err) {
            console.error("Failed to mark all as read", err);
        } finally {
            setLoading(false);
        }
    };

    const handleItemClick = async (notif: NotificationItem) => {
        try {
            if (!notif.is_read) {
                await notificationsApi.markAsRead(notif.id);
                setUnreadCount((c) => Math.max(0, c - 1));
                setRecentNotifications((prev) =>
                    prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
                );
            }
        } catch (err) {
            console.error("Failed to mark notification read", err);
        }

        setIsOpen(false);
        if (notif.action_url) {
            router.push(notif.action_url);
        } else if (notif.resource_type && notif.resource_id) {
            const type = notif.resource_type.toLowerCase();
            if (type.includes("cse")) router.push(`/cse/${notif.resource_id}`);
            else if (type.includes("finding")) router.push(`/findings/${notif.resource_id}`);
            else if (type.includes("remediation")) router.push(`/remediations/${notif.resource_id}`);
            else if (type.includes("supervis")) router.push(`/supervision/cases/${notif.resource_id}`);
            else if (type.includes("risk")) router.push(`/risks/${notif.resource_id}`);
            else if (type.includes("assessment")) router.push(`/assessments/${notif.resource_id}`);
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case "CRITICAL":
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-400 border border-rose-500/30">
                        <ShieldAlert className="h-2.5 w-2.5" /> CRITICAL
                    </span>
                );
            case "HIGH":
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="h-2.5 w-2.5" /> HIGH
                    </span>
                );
            case "LOW":
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border border-slate-700">
                        LOW
                    </span>
                );
            case "NORMAL":
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400 border border-blue-500/20">
                        NORMAL
                    </span>
                );
        }
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => {
                    const next = !isOpen;
                    setIsOpen(next);
                    if (next) fetchCountsAndRecent();
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Notifications"
                aria-label="Notifications"
            >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-rose-500/50 animate-pulse">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-800 bg-slate-950/95 p-0 shadow-2xl backdrop-blur-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/40">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                Notifications
                            </span>
                            {unreadCount > 0 && (
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                disabled={loading}
                                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                <span>Mark all read</span>
                            </button>
                        )}
                    </div>

                    {/* Content List */}
                    <div className="max-h-96 divide-y divide-slate-900/80 overflow-y-auto">
                        {recentNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                                <CheckCircle2 className="h-8 w-8 text-slate-600 mb-2" />
                                <p className="text-xs font-medium text-slate-300">All caught up!</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    No notifications waiting for your review.
                                </p>
                            </div>
                        ) : (
                            recentNotifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleItemClick(notif)}
                                    className={`group cursor-pointer p-3.5 transition-colors hover:bg-slate-900/60 ${
                                        !notif.is_read ? "bg-slate-900/30" : "opacity-75"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            {getPriorityBadge(notif.priority)}
                                            {notif.business_reference && (
                                                <span className="font-mono text-[10px] text-slate-400 font-medium">
                                                    {notif.business_reference}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-500 shrink-0">
                                            {new Date(notif.created_at).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                    <h4 className="mt-1 text-xs font-semibold text-slate-200 group-hover:text-white line-clamp-1">
                                        {notif.title}
                                    </h4>
                                    <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                        {notif.message}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-800/80 bg-slate-900/40 p-2.5 text-center">
                        <Link
                            href="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors py-1 px-3 rounded-lg hover:bg-emerald-500/10 w-full"
                        >
                            <span>Open Notification Center</span>
                            <ExternalLink className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
