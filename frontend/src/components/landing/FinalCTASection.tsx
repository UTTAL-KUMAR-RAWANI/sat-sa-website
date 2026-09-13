"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import SpatialLayer from "./SpatialLayer";
import BrandLogo from "@/components/common/BrandLogo";

export default function FinalCTASection() {
    return (
        <section className="relative py-24 bg-slate-950 text-slate-100 border-t border-slate-800/80 overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                <SpatialLayer maxTilt={3} depth={10}>
                    <div className="p-10 sm:p-16 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950/95 shadow-2xl backdrop-blur-xl space-y-8">
                        
                        <div className="flex flex-col items-center gap-3">
                            <BrandLogo size="lg" priority />
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>CENTRALIZED SUPERVISORY COMMAND</span>
                            </div>
                        </div>

                        <div className="space-y-4 max-w-2xl mx-auto">
                            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
                                From Security Signal to Supervised Decision.
                            </h2>
                            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                                Connect events, assessments, findings, risks, and remediations through one 
                                continuous supervisory intelligence platform.
                            </p>
                        </div>

                        {/* CTA Buttons: Login (Primary) & Request Access (Secondary) */}
                        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            >
                                <LogIn className="h-4 w-4" />
                                <span>Login</span>
                                <ArrowRight className="h-4 w-4" />
                            </Link>

                            <Link
                                href="/request-access"
                                className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-700/80 hover:border-emerald-500/50 text-slate-100 hover:text-emerald-400 font-semibold text-sm shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <UserPlus className="h-4 w-4 text-emerald-400" />
                                <span>Request Access</span>
                            </Link>
                        </div>

                        <div className="text-xs text-slate-400 font-mono">
                            <span>Authorized users sign in directly. Prospective users submit requests for CSE Administrator review.</span>
                        </div>

                        {/* Platform Readiness Badge */}
                        <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-mono">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                100+ Automated Pytest Suites Passing
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                13 Preconfigured Scoped Roles
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                End-to-End PostgreSQL Traceability
                            </span>
                        </div>

                    </div>
                </SpatialLayer>
            </div>
        </section>
    );
}

