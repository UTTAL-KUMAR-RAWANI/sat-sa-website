"use client";

import React from "react";
import Link from "next/link";
import { 
    Shield, 
    Gavel, 
    Landmark, 
    Zap, 
    Network, 
    FileText, 
    ArrowRight,
    AlertCircle
} from "lucide-react";
import SpatialLayer from "./SpatialLayer";

export default function SupervisorySection() {
    return (
        <section id="supervision" className="relative py-24 bg-slate-950 text-slate-100 border-t border-slate-800/80 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-teal-400">
                        <Shield className="h-3.5 w-3.5" />
                        <span>STATUTORY REGULATORY OVERSIGHT</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                        Elevating Operational Telemetry to Supervisory Authority
                    </h2>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                        SAT-SA bridges regulated entities and national regulatory authorities, ensuring 
                        systemic cyber risks trigger formal supervision rather than remaining buried in internal ticket queues.
                    </p>
                </div>

                {/* Sector-Wide Oversight Visualization */}
                <SpatialLayer maxTilt={3} depth={10}>
                    <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/85 via-slate-900/50 to-slate-950/90 p-8 sm:p-12 shadow-2xl backdrop-blur-xl space-y-10">
                        
                        {/* 3 Regulated Sectors Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="p-2 rounded-xl bg-teal-950 text-teal-400">
                                        <Landmark className="h-5 w-5" />
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                                        SECTOR ACTIVE
                                    </span>
                                </div>
                                <h4 className="text-base font-bold text-slate-100">Financial Services</h4>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Supervision over core banking transaction gateways, SWIFT endpoints, and automated clearing networks.
                                </p>
                                <div className="pt-2 text-[11px] font-mono text-slate-400 border-t border-slate-900 flex justify-between">
                                    <span>Primary Entity:</span>
                                    <span className="text-slate-200">National Central Bank</span>
                                </div>
                            </div>

                            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="p-2 rounded-xl bg-amber-950 text-amber-400">
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                                        SECTOR ACTIVE
                                    </span>
                                </div>
                                <h4 className="text-base font-bold text-slate-100">Energy & Utilities</h4>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Continuous telemetry oversight across regional power transmission grid substations and SCADA gateways.
                                </p>
                                <div className="pt-2 text-[11px] font-mono text-slate-400 border-t border-slate-900 flex justify-between">
                                    <span>Primary Entity:</span>
                                    <span className="text-slate-200">Apex Power Grid</span>
                                </div>
                            </div>

                            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="p-2 rounded-xl bg-sky-950 text-sky-400">
                                        <Network className="h-5 w-5" />
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                        SECTOR READY
                                    </span>
                                </div>
                                <h4 className="text-base font-bold text-slate-100">Telecommunications</h4>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    Cross-carrier routing security, BGP anomaly monitoring, and national fiber backhaul infrastructure protection.
                                </p>
                                <div className="pt-2 text-[11px] font-mono text-slate-400 border-t border-slate-900 flex justify-between">
                                    <span>Monitoring Status:</span>
                                    <span className="text-slate-400">Framework Integrated</span>
                                </div>
                            </div>

                        </div>

                        {/* Recommendation vs Decision Protocol Banner */}
                        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-1 text-center md:text-left">
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <Gavel className="h-4 w-4 text-amber-400" />
                                    <span className="text-sm font-bold text-slate-100">Separation of Authority Protocol</span>
                                </div>
                                <p className="text-xs text-slate-300 max-w-xl">
                                    Supervision Analysts formulate and substantiate investigative recommendations, but only the 
                                    Supervision Authority can render binding regulatory directives and penalties.
                                </p>
                            </div>

                            <Link
                                href="/login"
                                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shrink-0 inline-flex items-center gap-2 transition-all shadow-md shadow-teal-500/20"
                            >
                                <span>Inspect Supervision Dossiers</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                    </div>
                </SpatialLayer>

            </div>
        </section>
    );
}
