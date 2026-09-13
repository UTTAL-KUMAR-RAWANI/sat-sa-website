"use client";

import React from "react";
import Link from "next/link";
import { 
    Sparkles, 
    AlertCircle, 
    CheckCircle2, 
    Info, 
    ArrowRight, 
    EyeOff, 
    Search,
    ShieldAlert
} from "lucide-react";
import SpatialLayer from "./SpatialLayer";

export default function NegativeSpaceSection() {
    return (
        <section id="negative-space" className="relative py-24 bg-slate-950 text-slate-100 border-t border-slate-800/80 overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 left-10 w-80 h-80 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>PROPRIETARY ASSESSMENT METHODOLOGY</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                        Negative-Space Assessment: Detecting the Absence
                    </h2>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                        Conventional security platforms alert only on what happened. SAT-SA evaluates both 
                        positive threat signatures and <strong className="text-cyan-400 font-medium">negative space</strong>—the 
                        suspicious omission of expected telemetry and missing audit trails.
                    </p>
                </div>

                {/* Spatial Comparative Scene */}
                <SpatialLayer maxTilt={4} depth={12}>
                    <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/85 via-slate-900/50 to-slate-950/90 p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                            
                            {/* Left: Interactive Comparison Engine */}
                            <div className="lg:col-span-7 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center">
                                        <EyeOff className="h-5 w-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-100">Telemetry Discrepancy Analysis</h3>
                                        <span className="text-xs font-mono text-slate-400">Live Engine: Baseline vs. Ingested Telemetry</span>
                                    </div>
                                </div>

                                {/* Comparison Visual Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Expected Baseline */}
                                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Expected Baseline</span>
                                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                        </div>
                                        <div className="space-y-1.5 text-xs text-slate-300">
                                            <div className="flex justify-between py-1 border-b border-slate-900">
                                                <span className="text-slate-400">Heartbeat Interval:</span>
                                                <span className="font-mono text-slate-200">60s ± 2s</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-900">
                                                <span className="text-slate-400">Telemetry Sensor:</span>
                                                <span className="font-mono text-slate-200">SWIFT-GW-01</span>
                                            </div>
                                            <div className="flex justify-between py-1">
                                                <span className="text-slate-400">Expected Events:</span>
                                                <span className="font-mono text-emerald-400">3,600 / hr</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Observed Stream */}
                                    <div className="p-5 rounded-2xl bg-slate-950 border border-amber-900/60 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-mono font-bold text-amber-400 uppercase">Observed Stream</span>
                                            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                                        </div>
                                        <div className="space-y-1.5 text-xs text-slate-300">
                                            <div className="flex justify-between py-1 border-b border-slate-900">
                                                <span className="text-slate-400">Observed Events:</span>
                                                <span className="font-mono text-rose-400">12 / hr</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-slate-900">
                                                <span className="text-slate-400">Silence Duration:</span>
                                                <span className="font-mono text-amber-300">58m 14s</span>
                                            </div>
                                            <div className="flex justify-between py-1">
                                                <span className="text-slate-400">Discrepancy:</span>
                                                <span className="font-mono text-rose-400">-99.6% (Silent Gap)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Generated Signal Card */}
                                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/60 flex items-start gap-3.5">
                                    <ShieldAlert className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-cyan-300">Negative-Space Signal: SIG-2026-00001</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-900 text-cyan-200">
                                                POTENTIAL DETECTION GAP
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            Unexplained absence of core banking egress heartbeats detected. 
                                            Flagged for human analyst validation before formal finding conversion.
                                        </p>
                                    </div>
                                </div>

                            </div>

                            {/* Right: Technical Safety & Non-Hallucination Disclosures */}
                            <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
                                <div className="flex items-center gap-2 text-slate-200">
                                    <Info className="h-4 w-4 text-emerald-400 shrink-0" />
                                    <h4 className="text-sm font-bold">Rigorous Human-in-the-Loop Validation</h4>
                                </div>

                                <p className="text-xs text-slate-400 leading-relaxed">
                                    SAT-SA strictly maintains scientific integrity. A missing event is 
                                    <strong> never automatically declared an active attack</strong>. Real-world root causes include:
                                </p>

                                <ul className="space-y-2.5 text-xs text-slate-300">
                                    <li className="flex items-start gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                                        <span><strong>Telemetry Sensor Outage</strong>: Agent daemon crashes or endpoint network drops.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                                        <span><strong>Ingestion Pipeline Drop</strong>: Syslog buffering bottlenecks or parsing desynchronization.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                                        <span><strong>Monitoring Coverage Gap</strong>: Network segmentation changes blinding perimeter sensors.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                                        <span><strong>Deliberate Evasion</strong>: Adversary disabling event log forwarding services.</span>
                                    </li>
                                </ul>

                                <div className="pt-3 border-t border-slate-900">
                                    <Link
                                        href="/login"
                                        className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Search className="h-3.5 w-3.5 text-cyan-400" />
                                        <span>Explore Negative-Space Signals</span>
                                    </Link>
                                </div>
                            </div>

                        </div>

                    </div>
                </SpatialLayer>

            </div>
        </section>
    );
}
