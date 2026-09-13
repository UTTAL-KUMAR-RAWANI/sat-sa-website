"use client";

import React from "react";
import Link from "next/link";
import { 
    Scale, 
    CheckCircle2, 
    FileCode2, 
    ShieldCheck, 
    ArrowRight, 
    Lock, 
    Clock, 
    AlertTriangle 
} from "lucide-react";
import SpatialLayer from "./SpatialLayer";

export default function RiskRemediationSection() {
    return (
        <section id="risk-remediation" className="relative py-24 bg-slate-950 text-slate-100 border-t border-slate-800/80 overflow-hidden">
            {/* Ambient Background Light */}
            <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-orange-500/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-orange-400">
                        <Scale className="h-3.5 w-3.5" />
                        <span>QUANTITATIVE GOVERNANCE</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                        Measured Exposure. Auditable Resolution.
                    </h2>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                        Findings are quantified through deterministic 5×5 risk formulas and resolved through 
                        cryptographically verified remediations governed by strict Separation of Duties.
                    </p>
                </div>

                {/* Spatial Grid: Risk Matrix on Left, Remediation Pipeline on Right */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left: 5x5 Risk Quantification Card */}
                    <div className="lg:col-span-6">
                        <SpatialLayer maxTilt={4} depth={10} className="h-full">
                            <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-8 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between space-y-6">
                                
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-xl bg-orange-950/80 border border-orange-800/80 text-orange-400">
                                                <Scale className="h-4 w-4" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-100">Deterministic 5×5 Risk Scoring</h3>
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-400 border border-rose-800/60 font-bold">
                                            CRITICAL: SCORE 20
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        Risk scores are computed mathematically rather than subjectively estimated:
                                        <code className="text-emerald-400 font-mono ml-1">Score = Likelihood (1–5) × Impact (1–5)</code>.
                                    </p>
                                </div>

                                {/* Active Risk Dossier Snippet */}
                                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-mono text-slate-400">RSK-2026-00001</span>
                                        <span className="text-orange-400 font-medium">Core Banking Data Exfiltration</span>
                                    </div>
                                    
                                    {/* Parameter Sliders Simulation */}
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                                            <div className="text-[10px] text-slate-400 font-mono">Likelihood Rating</div>
                                            <div className="text-sm font-bold text-slate-100 mt-0.5">4 — Likely (80%)</div>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                                            <div className="text-[10px] text-slate-400 font-mono">Impact Severity</div>
                                            <div className="text-sm font-bold text-rose-400 mt-0.5">5 — Catastrophic</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 font-mono">
                                        <span>Treatment: MITIGATE</span>
                                        <span className="text-emerald-400">Target Residual: &lt; 6</span>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                                    <span>Inherent Risk: 20 (Critical)</span>
                                    <span className="text-emerald-400 font-medium">Expected Residual: 4 (Low)</span>
                                </div>

                            </div>
                        </SpatialLayer>
                    </div>

                    {/* Right: Remediation Validation & Anti-Self-Approval HUD */}
                    <div className="lg:col-span-6">
                        <SpatialLayer maxTilt={4} depth={10} className="h-full">
                            <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-8 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between space-y-6">
                                
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
                                                <ShieldCheck className="h-4 w-4" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-100">Verifiable Remediation & SoD</h3>
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-bold">
                                            AUDITOR VERIFIED
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        Remediations cannot be closed arbitrarily. Fixes require cryptographically 
                                        hashed patch evidence validated by an independent auditor.
                                    </p>
                                </div>

                                {/* Active Remediation Plan Details */}
                                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-mono text-slate-400">REM-2026-00001</span>
                                        <span className="text-emerald-400 font-medium">Egress Zero-Trust Proxy</span>
                                    </div>

                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <FileCode2 className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="font-mono text-[11px] text-slate-200">pcap_egress_drop_proof.bin</span>
                                            </div>
                                            <span className="font-mono text-[10px] text-slate-400">SHA-256 verified</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-[11px] px-1">
                                            <span className="text-slate-400">Assigned Owner:</span>
                                            <span className="font-mono text-slate-200">remediation@sat-sa.local</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] px-1">
                                            <span className="text-slate-400">Auditor Validator:</span>
                                            <span className="font-mono text-emerald-400">auditor@sat-sa.local</span>
                                        </div>
                                    </div>
                                </div>

                                {/* SoD Security Callout */}
                                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-3 text-xs text-amber-300/90">
                                    <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                                    <span>
                                        <strong>Separation of Duties</strong>: Backend rejects self-verification if executed by remediation owner.
                                    </span>
                                </div>

                            </div>
                        </SpatialLayer>
                    </div>

                </div>

            </div>
        </section>
    );
}
