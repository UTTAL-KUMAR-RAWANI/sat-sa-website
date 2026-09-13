"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
    Shield, 
    ArrowRight, 
    Radio, 
    Activity, 
    Layers, 
    Scale, 
    FileCheck2, 
    AlertTriangle, 
    Sparkles, 
    ChevronRight,
    CheckCircle2
} from "lucide-react";
import SpatialLayer from "./SpatialLayer";

export default function HeroSection() {
    const [activeCoreNode, setActiveCoreNode] = useState<string>("supervision");

    const coreNodes = [
        { id: "events", label: "Events", icon: Activity, depth: "translate-z-10", color: "text-sky-400" },
        { id: "alerts", label: "Alerts", icon: Radio, depth: "translate-z-20", color: "text-amber-400" },
        { id: "cse", label: "CSE", icon: AlertTriangle, depth: "translate-z-30", color: "text-rose-400" },
        { id: "investigation", label: "Investigation", icon: Layers, depth: "translate-z-40", color: "text-purple-400" },
        { id: "finding", label: "Findings", icon: FileCheck2, depth: "translate-z-30", color: "text-indigo-400" },
        { id: "risk", label: "Risk Matrix", icon: Scale, depth: "translate-z-20", color: "text-orange-400" },
        { id: "remediation", label: "Remediation", icon: CheckCircle2, depth: "translate-z-30", color: "text-emerald-400" },
        { id: "supervision", label: "Supervision", icon: Shield, depth: "translate-z-50", color: "text-teal-400" },
    ];

    return (
        <section className="relative min-h-[92vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-slate-950 text-slate-100">
            {/* Layer 1: Dark Atmospheric Base & Spatial Grid */}
            <div className="absolute inset-0 bg-spatial-grid opacity-60 pointer-events-none" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    
                    {/* Left Column: Mission Statement & Typography */}
                    <div className="lg:col-span-6 space-y-6 text-left">
                        {/* Institution Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono text-emerald-400 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>REGULATORY & OPERATIONAL COMMAND</span>
                        </div>

                        {/* Dramatic Headline */}
                        <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-slate-100 leading-[1.12]">
                            Security Intelligence.{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                                Supervised
                            </span>{" "}
                            from Detection to Decision.
                        </h1>

                        {/* Rigorous Description */}
                        <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
                            SAT-SA establishes an authoritative relational pipeline uniting raw telemetry, 
                            forensic investigations, quantitative risk scoring, and corrective remediations 
                            under national regulatory oversight.
                        </p>

                        {/* Primary CTAs */}
                        <div className="flex flex-wrap items-center gap-4 pt-2">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <span>Explore Live Platform</span>
                                <ArrowRight className="h-4 w-4" />
                            </Link>

                            <a
                                href="#pipeline"
                                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-emerald-400 font-medium text-sm transition-all"
                            >
                                <span>Security Pipeline</span>
                                <ChevronRight className="h-4 w-4" />
                            </a>
                        </div>

                        {/* Micro Trust Indicators */}
                        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
                            <div>
                                <div className="text-xl font-bold font-mono text-slate-100">13 Roles</div>
                                <div className="text-xs text-slate-400">Enforced RBAC & SoD</div>
                            </div>
                            <div>
                                <div className="text-xl font-bold font-mono text-emerald-400">100%</div>
                                <div className="text-xs text-slate-400">Database Traceable</div>
                            </div>
                            <div>
                                <div className="text-xl font-bold font-mono text-teal-400">5×5</div>
                                <div className="text-xs text-slate-400">Quantitative Risk Scoring</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: 3D Spatial Intelligence Core Scene */}
                    <div className="lg:col-span-6 flex justify-center">
                        <SpatialLayer maxTilt={6} depth={18} className="w-full max-w-lg">
                            <div className="relative aspect-square w-full rounded-3xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/95 p-8 shadow-2xl backdrop-blur-xl preserve-3d">
                                
                                {/* Deep Background: Concentric Telemetry Orbit Rings */}
                                <div className="absolute inset-8 rounded-full border border-slate-800/60 animate-core-rotate pointer-events-none translate-z-neg-20" />
                                <div className="absolute inset-16 rounded-full border border-dashed border-emerald-500/15 animate-core-rotate-reverse pointer-events-none translate-z-neg-20" />
                                
                                {/* Center: Core Supervisory Sphere */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center translate-z-40 text-center">
                                    <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-0.5 shadow-2xl shadow-emerald-500/30 flex items-center justify-center animate-pulse-beacon">
                                        <div className="h-full w-full rounded-full bg-slate-950 flex flex-col items-center justify-center p-3">
                                            <Shield className="h-8 w-8 text-emerald-400" />
                                            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-200 mt-1">CORE</span>
                                        </div>
                                    </div>
                                    <div className="mt-3 px-3 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300">
                                        SUP-2026-00001
                                    </div>
                                </div>

                                {/* Spatial Orbital Nodes */}
                                <div className="absolute top-6 left-8 translate-z-30 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg flex items-center gap-2 hover:border-emerald-500 transition-colors cursor-pointer">
                                    <Activity className="h-4 w-4 text-sky-400" />
                                    <span className="text-xs font-mono text-slate-200">EVT: Ingestion</span>
                                </div>

                                <div className="absolute top-8 right-6 translate-z-20 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg flex items-center gap-2 hover:border-amber-500 transition-colors cursor-pointer">
                                    <Radio className="h-4 w-4 text-amber-400" />
                                    <span className="text-xs font-mono text-slate-200">ALT: Triage</span>
                                </div>

                                <div className="absolute bottom-28 left-4 translate-z-20 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg flex items-center gap-2 hover:border-indigo-500 transition-colors cursor-pointer">
                                    <FileCheck2 className="h-4 w-4 text-indigo-400" />
                                    <span className="text-xs font-mono text-slate-200">FND: Verified</span>
                                </div>

                                <div className="absolute bottom-8 left-1/3 -translate-x-1/2 translate-z-30 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg flex items-center gap-2 hover:border-emerald-500 transition-colors cursor-pointer">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    <span className="text-xs font-mono text-slate-200">REM: Validated</span>
                                </div>

                                <div className="absolute bottom-16 right-4 translate-z-40 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg flex items-center gap-2 hover:border-teal-500 transition-colors cursor-pointer">
                                    <Scale className="h-4 w-4 text-teal-400" />
                                    <span className="text-xs font-mono text-slate-200">DEC: Binding</span>
                                </div>

                                {/* Floating HUD Pill 1: Telemetry Stream */}
                                <div className="absolute -top-4 -right-4 translate-z-60 p-3 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md hidden sm:flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                                    <div>
                                        <div className="text-[10px] font-mono text-slate-400 uppercase">Live Pipeline</div>
                                        <div className="text-xs font-bold text-slate-200">NCB Core Gateway: Supervised</div>
                                    </div>
                                </div>

                                {/* Floating HUD Pill 2: Negative Space Indicator */}
                                <div className="absolute -bottom-4 -left-4 translate-z-60 p-3 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md hidden sm:flex items-center gap-3">
                                    <Sparkles className="h-4 w-4 text-teal-400" />
                                    <div>
                                        <div className="text-[10px] font-mono text-slate-400 uppercase">Coverage Engine</div>
                                        <div className="text-xs font-bold text-slate-200">Zero Silent Detection Gaps</div>
                                    </div>
                                </div>
                            </div>
                        </SpatialLayer>
                    </div>

                </div>
            </div>
        </section>
    );
}
