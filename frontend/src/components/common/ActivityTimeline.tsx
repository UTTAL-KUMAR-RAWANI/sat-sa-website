"use client";

import React, { useEffect, useState } from "react";
import { auditApi, ResourceHistoryItem } from "@/lib/api/audit";
import {
    Clock,
    User,
    ArrowRight,
    RefreshCw,
    Activity,
    Shield,
    CheckCircle2,
    AlertCircle,
    Info,
} from "lucide-react";

interface ActivityTimelineProps {
    resourceType: string;
    resourceId: string;
    title?: string;
    className?: string;
}

export default function ActivityTimeline({
    resourceType,
    resourceId,
    title = "Activity & Audit History",
    className = "",
}: ActivityTimelineProps) {
    const [events, setEvents] = useState<ResourceHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        if (!resourceId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await auditApi.getResourceHistory(resourceType, resourceId);
            setEvents(data);
        } catch (err: any) {
            console.error(`Failed to load history for ${resourceType} ${resourceId}:`, err);
            setError(err.message || "Failed to load activity history.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [resourceType, resourceId]);

    const getActionBadge = (action: string) => {
        switch (action.toUpperCase()) {
            case "CREATE":
            case "UPLOAD":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
            case "STATUS_CHANGE":
                return "bg-sky-500/10 text-sky-400 border-sky-500/30";
            case "APPROVE":
            case "VALIDATE":
            case "VERIFY":
                return "bg-teal-500/10 text-teal-400 border-teal-500/30";
            case "ESCALATE":
            case "REJECT":
            case "BLOCK":
                return "bg-rose-500/10 text-rose-400 border-rose-500/30";
            case "ASSIGN":
                return "bg-amber-500/10 text-amber-400 border-amber-500/30";
            default:
                return "bg-slate-800 text-slate-300 border-slate-700";
        }
    };

    return (
        <div className={`p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md ${className}`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <Activity className="h-5 w-5 text-sky-400" />
                    <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider">
                        {title}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                        {events.length} {events.length === 1 ? "event" : "events"}
                    </span>
                </div>

                <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition"
                    title="Refresh activity history"
                >
                    <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-sky-400" />
                    Retrieving immutable audit history...
                </div>
            ) : error ? (
                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/50 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            ) : events.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                    <Clock className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                    No recorded activity history yet for this resource.
                </div>
            ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                    {events.map((evt) => (
                        <div key={evt.id} className="relative group">
                            {/* Dot */}
                            <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-sky-500 shadow-sm shadow-sky-500/50" />

                            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getActionBadge(evt.action)}`}>
                                        {evt.action.replace("_", " ")}
                                    </span>
                                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                                        <User className="h-3 w-3 text-slate-400" />
                                        {evt.actor_name}
                                    </span>
                                    {evt.actor_role && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                            {evt.actor_role}
                                        </span>
                                    )}
                                </div>
                                <time className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                                    {new Date(evt.created_at).toLocaleString()}
                                </time>
                            </div>

                            {/* Status Transition Pill */}
                            {evt.status_transition && (
                                <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs">
                                    <span className="text-slate-400">Status changed:</span>
                                    <span className="font-mono text-slate-300 font-medium">{evt.status_transition.from || "None"}</span>
                                    <ArrowRight className="h-3 w-3 text-sky-400" />
                                    <span className="font-mono text-emerald-400 font-bold">{evt.status_transition.to || "None"}</span>
                                </div>
                            )}

                            {/* Reason / Comment */}
                            {evt.reason && (
                                <p className="mt-2 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed italic">
                                    &ldquo;{evt.reason}&rdquo;
                                </p>
                            )}

                            {/* Field Changes Diffs */}
                            {evt.field_changes && evt.field_changes.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {evt.field_changes.map((fc, idx) => (
                                        <div key={idx} className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                                            <span className="font-semibold text-slate-300">{fc.field}:</span>
                                            <span className="line-through text-rose-400/80">{fc.old || "null"}</span>
                                            <ArrowRight className="h-2.5 w-2.5 text-slate-500" />
                                            <span className="text-emerald-400 font-semibold">{fc.new || "null"}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
