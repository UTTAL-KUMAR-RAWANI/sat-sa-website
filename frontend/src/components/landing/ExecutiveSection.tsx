"use client";

import React from "react";
import Link from "next/link";
import { 
    BarChart3, 
    ShieldAlert, 
    CheckCircle2, 
    TrendingUp, 
    Clock, 
    Layers, 
    ArrowRight,
    Award
} from "lucide-react";
import SpatialLayer from "./SpatialLayer";

export default function ExecutiveSection() {
    return (
        <section id="executive" className="relative py-24 bg-slate-950 text-slate-100 border-t border-slate-800/80 overflow-hidden">
            {/* Ambient Lighting */}
            <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-emerald-600/5 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400">
                        <BarChart3 className="h-3.5 w-3.5" />
                        <span>EXECUTIVE GOVERNANCE</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                        Real-Time Command for Security Leadership
                    </h2>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                        CISO and Senior Management dashboards aggregate live operational telemetry, 
                        providing instantaneous strategic oversight without waiting for monthly audit cycles.
                    </p>
                </div>

                {/* Dual Executive Command View */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* CISO Command Card */}
                    <SpatialLayer maxTilt={3} depth={8} className="h-full">
                        <div className="p-8 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/95 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between space-y-6">
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                                            <ShieldAlert className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-100">CISO Operations Command</h3>
                                            <span className="text-xs font-mono text-slate-400">Tactical Posture & Remediation Velocity</span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-emerald-400 font-bold">HEALTH: 98.4%</span>
                                </div>

                                {/* KPI Metrics Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                                        <div className="text-[11px] font-mono text-slate-400 uppercase">Active CSEs</div>
                                        <div className="text-2xl font-bold font-mono text-rose-400 mt-1">1 Incident</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">CSE-2026-00001 under review</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                                        <div className="text-[11px] font-mono text-slate-400 uppercase">Remediation Velocity</div>
                                        <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">94.2% SLA</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Average fix cycle: 14 days</div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                                    <div className="flex justify-between text-slate-300">
                                        <span>Perimeter Sensor Telemetry Coverage:</span>
                                        <span className="font-mono text-emerald-400 font-bold">99.8%</span>
                                    </div>
                                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                        <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full w-[99.8%]" />
                                    </div>
                                </div>
                            </div>

                            <Link
                                href="/login"
                                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                            >
                                <span>Access CISO Executive Console</span>
                                <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                            </Link>

                        </div>
                    </SpatialLayer>

                    {/* Senior Management Governance Card */}
                    <SpatialLayer maxTilt={3} depth={8} className="h-full">
                        <div className="p-8 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/95 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between space-y-6">
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-teal-950/80 border border-teal-800/80 flex items-center justify-center text-teal-400">
                                            <Award className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-100">Board & Senior Management</h3>
                                            <span className="text-xs font-mono text-slate-400">Macro Risk Appetite & Compliance Index</span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-teal-400 font-bold">RATING: GRADE A</span>
                                </div>

                                {/* KPI Metrics Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                                        <div className="text-[11px] font-mono text-slate-400 uppercase">Compliance Index</div>
                                        <div className="text-2xl font-bold font-mono text-teal-400 mt-1">96.8%</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">NIST CSF / ISO 27001 verified</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                                        <div className="text-[11px] font-mono text-slate-400 uppercase">Risk Appetite Margin</div>
                                        <div className="text-2xl font-bold font-mono text-slate-100 mt-1">Within Bounds</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Residual score &lt; threshold</div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                                    <div className="flex justify-between text-slate-300">
                                        <span>Supervisory Regulatory Standing:</span>
                                        <span className="font-mono text-teal-400 font-bold">Compliant & Supervised</span>
                                    </div>
                                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                        <div className="bg-gradient-to-r from-teal-500 to-cyan-400 h-2 rounded-full w-[96.8%]" />
                                    </div>
                                </div>
                            </div>

                            <Link
                                href="/login"
                                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                            >
                                <span>Access Senior Management Briefing</span>
                                <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
                            </Link>

                        </div>
                    </SpatialLayer>

                </div>

            </div>
        </section>
    );
}
