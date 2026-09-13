"use client";

import React from "react";
import { ShieldAlert, AlertTriangle, AlertCircle, Info } from "lucide-react";

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "EXTREME" | "MODERATE" | "INFORMATIONAL" | "P1" | "P2" | "P3" | "P4";

interface SeverityBadgeProps {
    severity: string | null | undefined;
    className?: string;
    showIcon?: boolean;
}

export default function SeverityBadge({
    severity,
    className = "",
    showIcon = true,
}: SeverityBadgeProps) {
    if (!severity) {
        return (
            <span className="inline-flex items-center text-[10px] text-slate-500 font-mono">
                None
            </span>
        );
    }

    const s = severity.toUpperCase().trim();

    if (s.includes("CRITICAL") || s.includes("EXTREME") || s === "P1") {
        return (
            <span
                className={`inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 border border-rose-500/30 ${className}`}
            >
                {showIcon && <ShieldAlert className="h-3 w-3 text-rose-400 shrink-0" />}
                <span>{severity}</span>
            </span>
        );
    }

    if (s.includes("HIGH") || s === "P2") {
        return (
            <span
                className={`inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30 ${className}`}
            >
                {showIcon && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
                <span>{severity}</span>
            </span>
        );
    }

    if (s.includes("MEDIUM") || s.includes("MODERATE") || s === "P3") {
        return (
            <span
                className={`inline-flex items-center gap-1 rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300 border border-blue-500/25 ${className}`}
            >
                {showIcon && <AlertCircle className="h-3 w-3 text-blue-400 shrink-0" />}
                <span>{severity}</span>
            </span>
        );
    }

    // LOW / INFORMATIONAL / P4 / other
    return (
        <span
            className={`inline-flex items-center gap-1 rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 border border-slate-700/80 ${className}`}
        >
            {showIcon && <Info className="h-2.5 w-2.5 text-slate-400 shrink-0" />}
            <span>{severity}</span>
        </span>
    );
}
