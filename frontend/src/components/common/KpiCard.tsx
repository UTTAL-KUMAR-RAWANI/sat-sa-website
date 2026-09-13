"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from "lucide-react";

interface KpiCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    caption?: string;
    icon?: React.ReactNode;
    trend?: {
        direction: "up" | "down" | "neutral";
        value: string;
        isPositive?: boolean; // If true, green; if false, red
    };
    variant?: "default" | "accent" | "warning" | "danger" | "purple";
    href?: string;
    onClick?: () => void;
    className?: string;
}

const variantStyles = {
    default: "border-slate-800 bg-slate-900/60 hover:border-slate-700/90",
    accent: "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60",
    warning: "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60",
    danger: "border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60",
    purple: "border-purple-500/40 bg-purple-500/5 hover:border-purple-500/60",
};

export default function KpiCard({
    title,
    value,
    subtitle,
    caption,
    icon,
    trend,
    variant = "default",
    href,
    onClick,
    className = "",
}: KpiCardProps) {
    const cardContent = (
        <div
            onClick={onClick}
            className={`group rounded-xl border p-4 sm:p-5 transition-all shadow-sm ${variantStyles[variant]} ${
                href || onClick ? "cursor-pointer hover:shadow-md" : ""
            } ${className}`}
        >
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-200 transition-colors">
                    {title}
                </span>
                {icon && (
                    <div className="rounded-lg bg-slate-800/80 p-2 text-slate-300 border border-slate-700/60 group-hover:text-white transition-colors">
                        {icon}
                    </div>
                )}
            </div>

            <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
                    {value}
                </span>
                {subtitle && (
                    <span className="text-xs text-slate-400 font-medium">{subtitle}</span>
                )}
            </div>

            {(caption || trend) && (
                <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                    {caption && <span className="text-slate-400 text-[11px] truncate">{caption}</span>}
                    {trend && (
                        <div
                            className={`flex items-center gap-0.5 text-[11px] font-semibold shrink-0 ${
                                trend.direction === "neutral"
                                    ? "text-slate-400"
                                    : trend.isPositive
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                            }`}
                        >
                            {trend.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
                            {trend.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
                            {trend.direction === "neutral" && <Minus className="h-3 w-3" />}
                            <span>{trend.value}</span>
                        </div>
                    )}
                </div>
            )}

            {href && (
                <div className="mt-2 flex items-center justify-end text-[11px] font-medium text-slate-400 group-hover:text-emerald-400 transition-colors">
                    <span>Explore details</span>
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                </div>
            )}
        </div>
    );

    if (href) {
        return <Link href={href}>{cardContent}</Link>;
    }

    return cardContent;
}
