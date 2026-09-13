"use client";

import React from "react";

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
    return (
        <div className={`animate-pulse rounded bg-slate-800/80 ${className}`} />
    );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
            {/* Header row */}
            <div className="flex items-center gap-4 pb-3 border-b border-slate-800">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="flex items-center gap-4 py-2 border-b border-slate-800/60 last:border-0">
                        {Array.from({ length: cols }).map((_, c) => (
                            <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-[120px]" : ""}`} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-32" />
                </div>
            ))}
        </div>
    );
}
