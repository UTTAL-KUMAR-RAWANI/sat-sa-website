"use client";

import React from "react";

export type StatusCategory =
    | "neutral"
    | "info"
    | "progress"
    | "review"
    | "warning"
    | "success"
    | "danger"
    | "critical";

interface StatusBadgeProps {
    status: string;
    variant?: StatusCategory;
    className?: string;
    showDot?: boolean;
}

const statusColorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    // Draft / Open / Low / New
    DRAFT: { bg: "bg-slate-800/80", text: "text-slate-300", border: "border-slate-700", dot: "bg-slate-400" },
    OPEN: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-400" },
    NEW: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20", dot: "bg-sky-400" },

    // In Progress / Active / Triaged
    TRIAGED: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", dot: "bg-cyan-400" },
    IN_PROGRESS: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", dot: "bg-cyan-400" },
    INVESTIGATING: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", dot: "bg-indigo-400" },
    ASSIGNED: { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/20", dot: "bg-blue-400" },
    ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },

    // Review / Waiting / Pending
    SUBMITTED: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-400" },
    UNDER_REVIEW: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-400" },
    RECOMMENDATION_SUBMITTED: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30", dot: "bg-amber-400" },
    NEEDS_REVIEW: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30", dot: "bg-amber-400" },
    PENDING: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-400" },
    EVIDENCE: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", dot: "bg-purple-400" },
    VALIDATION: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20", dot: "bg-teal-400" },

    // Success / Completed / Verified / Approved
    APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },
    VERIFIED: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-400" },
    RESOLVED: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },
    CLOSED: { bg: "bg-slate-800", text: "text-slate-400", border: "border-slate-700", dot: "bg-slate-500" },
    DECIDED: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },
    COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },

    // Danger / Escalated / Rejected / Blocked / Critical
    ESCALATED: { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30", dot: "bg-rose-400" },
    REJECTED: { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30", dot: "bg-rose-400" },
    RETURNED: { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/30", dot: "bg-rose-400" },
    DENIED: { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30", dot: "bg-rose-400" },
    BLOCKED: { bg: "bg-rose-500/20", text: "text-rose-300", border: "border-rose-500/40", dot: "bg-rose-400" },
    CRITICAL: { bg: "bg-rose-600/20", text: "text-rose-300", border: "border-rose-500/40", dot: "bg-rose-400" },
};

export default function StatusBadge({
    status,
    variant,
    className = "",
    showDot = true,
}: StatusBadgeProps) {
    const normalizedKey = status ? status.trim().toUpperCase().replace(/[\s-]/g, "_") : "UNKNOWN";
    const colors = statusColorMap[normalizedKey] || {
        bg: "bg-slate-800/80",
        text: "text-slate-300",
        border: "border-slate-700",
        dot: "bg-slate-400",
    };

    // Human-readable format
    const label = status
        ? status
              .toLowerCase()
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")
        : "Unknown";

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${colors.bg} ${colors.text} ${colors.border} ${className}`}
        >
            {showDot && <span className={`h-1.5 w-1.5 rounded-full ${colors.dot} shrink-0`} />}
            <span className="truncate">{label}</span>
        </span>
    );
}
