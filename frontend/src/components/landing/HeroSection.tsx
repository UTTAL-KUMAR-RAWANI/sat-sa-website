"use client";

import React, { useState } from "react";
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
    CheckCircle2,
    FileSpreadsheet,
    Gavel
} from "lucide-react";
import SpatialLayer from "./SpatialLayer";
import BrandLogo from "@/components/common/BrandLogo";

export default function HeroSection() {
    const [activeNode, setActiveNode] = useState<string>("supervision");

    const pipelineNodes = [
        { id: "events", label: "EVT: Ingest", icon: Activity, color: "text-sky-400", border: "hover:border-sky-500", pos: "top-4 left-6", depth: "translate-z-30" },
        { id: "alerts", label: "ALT: Triage", icon: Radio, color: "text-amber-400", border: "hover:border-amber-500", pos: "top-4 right-8", depth: "translate-z-20" },
        { id: "cse", label: "CSE: Critical", icon: AlertTriangle, color: "text-rose-400", border: "hover:border-rose-500", pos: "top-28 right-2", depth: "translate-z-30" },
        { id: "investigation", label: "INV: Forensic", icon: Layers, color: "text-purple-400", border: "hover:border-purple-500", pos: "bottom-32 right-2", depth: "translate-z-40" },
        { id: "finding", label: "FND: Verified", icon: FileCheck2, color: "text-indigo-400", border: "hover:border-indigo-500", pos: "bottom-6 right-10", depth: "translate-z-30" },
        { id: "risk", label: "RSK: Matrix", icon: Scale, color: "text-orange-400", border: "hover:border-orange-500", pos: "bottom-4 left-1/2 -translate-x-1/2", depth: "translate-z-20" },
        { id: "remediation", label: "REM: Action", icon: CheckCircle2, color: "text-emerald-400", border: "hover:border-emerald-500", pos: "bottom-8 left-8", depth: "translate-z-30" },
        { id: "assessment", label: "ASM: Audit", icon: FileSpreadsheet, color: "text-blue-400", border: "hover:border-blue-500", pos: "bottom-32 left-2", depth: "translate-z-20" },
        { id: "supervision", label: "SUP: Dossier", icon: Shield, color: "text-teal-400", border: "hover:border-teal-500", pos: "top-28 left-2", depth: "translate-z-40" },
        { id: "decision", label: "DEC: Binding", icon: Gavel, color: "text-cyan-400", border: "hover:border-cyan-500", pos: "top-14 left-1/2 -translate-x-1/2", depth: "translate-z-40" },
    ];

    return (
        <section id="platform" className="relative min-h-[92vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-slate-950 text-slate-100">
            {/* Layer 1: Dark Atmospheric Base & Spatial Grid */}
            <div className="absolute inset-0 bg-spatial-grid opacity-60 pointer-events-none" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

                    {/* Left Column: Mission Statement & Hierarchy */}
                    <div className="lg:col-span-6 space-y-6 text-left">
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
                            SAT-SA unites raw security events, alert triage, critical incident investigations, verified findings, quantitative risk, and corrective remediation under authoritative regulatory oversight.
                        </p>

                        {/* Hero CTAs: Explore Platform (Primary) & See Security Workflow (Secondary) */}
                        <div className="flex flex-wrap items-center gap-4 pt-2">
                            <a
                                href="#platform"
                                aria-label="Explore Platform"
                                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
                            >
                                <span>Explore Platform</span>
                                <ArrowRight className="h-4 w-4" />
                            </a>

                            <a
                                href="#pipeline"
                                aria-label="See Security Workflow"
                                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-emerald-500/50 text-slate-100 hover:text-emerald-400 font-semibold text-sm shadow-lg shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950"
                            >
                                <span>See Security Workflow</span>
                                <ArrowRight className="h-4 w-4 text-emerald-400" />
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
                                <div className="text-xs text-slate-400">Quantitative Risk Matrix</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: 8D Spatial Intelligence Core Scene */}
                    <div className="lg:col-span-6 flex justify-center">
                        <SpatialLayer maxTilt={6} depth={18} className="w-full max-w-lg">
                            <div className="relative aspect-square w-full rounded-3xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/95 p-8 shadow-2xl backdrop-blur-xl preserve-3d">

                                {/* Deep Background: Concentric Telemetry Orbit Rings */}
                                <div className="absolute inset-8 rounded-full border border-slate-800/60 animate-core-rotate pointer-events-none translate-z-neg-20" />
                                <div className="absolute inset-16 rounded-full border border-dashed border-emerald-500/15 animate-core-rotate-reverse pointer-events-none translate-z-neg-20" />
                                <div className="absolute inset-28 rounded-full border border-dotted border-teal-500/10 pointer-events-none translate-z-neg-20" />

                                {/* Center: Core Supervisory Sphere with Official Logo */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center translate-z-40 text-center">
                                    <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-0.5 shadow-2xl shadow-emerald-500/30 flex items-center justify-center animate-pulse-beacon">
                                        <div className="h-full w-full rounded-full bg-slate-950 flex flex-col items-center justify-center p-2">
                                            <BrandLogo
                                                size="lg"
                                                withContainer={false}
                                                priority
                                                imageClassName="drop-shadow"
                                            />
                                            <span className="text-[9px] font-mono font-bold tracking-wider text-emerald-400 mt-1">SAT-SA CORE</span>
                                        </div>
                                    </div>
                                    <div className="mt-2.5 px-3 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300">
                                        SUP-2026-00001
                                    </div>
                                </div>

                                {/* Connected Spatial Orbital Nodes (10 stages) */}
                                {pipelineNodes.map((node) => {
                                    const Icon = node.icon;
                                    return (
                                        <div
                                            key={node.id}
                                            onClick={() => setActiveNode(node.id)}
                                            className={`absolute ${node.pos} ${node.depth} p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg flex items-center gap-1.5 ${node.border} transition-all cursor-pointer group`}
                                        >
                                            <Icon className={`h-3.5 w-3.5 ${node.color} group-hover:scale-110 transition-transform`} />
                                            <span className="text-[11px] font-mono text-slate-200">{node.label}</span>
                                        </div>
                                    );
                                })}

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

