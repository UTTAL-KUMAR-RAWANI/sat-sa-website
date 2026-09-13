"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Bell,
    CheckCheck,
    Check,
    Mail,
    ExternalLink,
    ShieldAlert,
    AlertTriangle,
    Info,
    Search,
    ChevronLeft,
    ChevronRight,
    Filter,
    RefreshCw,
} from "lucide-react";
import { notificationsApi, NotificationItem } from "@/lib/api/notifications";

export default function NotificationsPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("");
    const [resourceFilter, setResourceFilter] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const pageSize = 15;

    const loadData = async () => {
        setLoading(true);
        try {
            const countData = await notificationsApi.getUnreadCount();
            setUnreadCount(countData.unread_count);

            const res = await notificationsApi.list({
                is_read: statusFilter === "unread" ? false : statusFilter === "read" ? true : undefined,
                priority: priorityFilter || undefined,
                resource_type: resourceFilter || undefined,
                search: searchQuery.trim() || undefined,
                page: page + 1,
                limit: pageSize,
            });

            let items = res.items;

            // Local search query filter on title/message if provided
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                items = items.filter(
                    (n) =>
                        n.title.toLowerCase().includes(q) ||
                        n.message.toLowerCase().includes(q) ||
                        (n.business_reference && n.business_reference.toLowerCase().includes(q))
                );
            }

            setNotifications(items);
            setTotal(res.total);
        } catch (err) {
            console.error("Failed to load notifications", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [page, statusFilter, priorityFilter, resourceFilter]);

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await notificationsApi.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch (err) {
            console.error("Failed to mark as read", err);
        }
    };

    const handleMarkAsUnread = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await notificationsApi.markAsUnread(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: false, read_at: undefined } : n))
            );
            setUnreadCount((c) => c + 1);
        } catch (err) {
            console.error("Failed to mark as unread", err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationsApi.markAllAsRead();
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
            setUnreadCount(0);
        } catch (err) {
            console.error("Failed to mark all as read", err);
        }
    };

    const navigateToResource = (notif: NotificationItem) => {
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

    const totalPages = Math.ceil(total / pageSize);

    const getPriorityBadge = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case "CRITICAL":
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 border border-rose-500/30">
                        <ShieldAlert className="h-3 w-3" /> CRITICAL
                    </span>
                );
            case "HIGH":
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="h-3 w-3" /> HIGH
                    </span>
                );
            case "LOW":
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-700">
                        LOW
                    </span>
                );
            case "NORMAL":
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400 border border-blue-500/20">
                        NORMAL
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold tracking-tight text-white">Notification Center</h1>
                        {unreadCount > 0 && (
                            <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/30">
                                {unreadCount} Unread
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Operational alerts, task assignments, and supervisory review notifications
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                        title="Refresh notifications"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                            <CheckCheck className="h-4 w-4" />
                            <span>Mark All Read</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                </div>

                {/* Status Tab Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value as any);
                        setPage(0);
                    }}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                    <option value="all">All Notifications</option>
                    <option value="unread">Unread Only</option>
                    <option value="read">Read Only</option>
                </select>

                {/* Priority Filter */}
                <select
                    value={priorityFilter}
                    onChange={(e) => {
                        setPriorityFilter(e.target.value);
                        setPage(0);
                    }}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                    <option value="">All Priorities</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                </select>

                {/* Resource Type Filter */}
                <select
                    value={resourceFilter}
                    onChange={(e) => {
                        setResourceFilter(e.target.value);
                        setPage(0);
                    }}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                    <option value="">All Resource Types</option>
                    <option value="CSE">CSE Exposure</option>
                    <option value="FINDING">Finding</option>
                    <option value="ASSESSMENT">Assessment</option>
                    <option value="RISK">Risk</option>
                    <option value="REMEDIATION">Remediation</option>
                    <option value="SUPERVISORY_CASE">Supervisory Case</option>
                    <option value="DATASET">Dataset</option>
                    <option value="NEGATIVE_SPACE_ASSESSMENT">Negative Space</option>
                </select>
            </div>

            {/* Notification List */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                {loading ? (
                    <div className="flex h-56 items-center justify-center text-xs text-slate-400">
                        Loading notifications...
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <Bell className="h-10 w-10 text-slate-600 mb-3" />
                        <h3 className="text-sm font-semibold text-slate-300">No Notifications Found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                            {statusFilter === "unread"
                                ? "You have no unread notifications. Everything is caught up!"
                                : "No notifications matched the selected filter criteria."}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/80">
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                onClick={() => navigateToResource(notif)}
                                className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 transition-colors cursor-pointer hover:bg-slate-850/60 ${
                                    !notif.is_read ? "bg-slate-900/40 border-l-2 border-l-emerald-500" : "opacity-85"
                                }`}
                            >
                                <div className="space-y-1.5 flex-1 pr-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {getPriorityBadge(notif.priority)}
                                        {notif.business_reference && (
                                            <span className="font-mono text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                {notif.business_reference}
                                            </span>
                                        )}
                                        {notif.resource_type && (
                                            <span className="text-[11px] font-medium text-slate-400">
                                                {notif.resource_type}
                                            </span>
                                        )}
                                        <span className="text-[11px] text-slate-500">
                                            {new Date(notif.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                                        {notif.title}
                                    </h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">{notif.message}</p>
                                </div>

                                <div className="flex items-center gap-2 mt-3 sm:mt-0 shrink-0">
                                    {notif.is_read ? (
                                        <button
                                            onClick={(e) => handleMarkAsUnread(notif.id, e)}
                                            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                            title="Mark as unread"
                                        >
                                            <Mail className="h-4 w-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                                            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                            title="Mark as read"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigateToResource(notif);
                                        }}
                                        className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                    >
                                        <span>View</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3.5 border-t border-slate-800 text-xs text-slate-400 bg-slate-950/40">
                        <span>
                            Page {page + 1} of {totalPages} ({total} items)
                        </span>
                        <div className="flex gap-1.5">
                            <button
                                disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                disabled={page + 1 >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40 hover:bg-slate-800 text-white"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
