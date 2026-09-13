"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    Radio,
    AlertTriangle,
    Layers,
    FileCheck2,
    Scale,
    CheckCircle2,
    FileSpreadsheet,
    Shield,
    Gavel,
    ArrowRight,
    ExternalLink
} from "lucide-react";
import SpatialLayer from "./SpatialLayer";

interface PipelineStage {
    step: number;
    id: string;
    name: string;
    icon: React.ElementType;
    code: string;
    sampleId: string;
    summary: string;
    roleResponsible: string;
    appRoute: string;
    color: string;
    borderColor: string;
}

export default function SecurityPipelineSection() {
    const [selectedStep, setSelectedStep] = useState<number>(1);

    const stages: PipelineStage[] = [
        {
            step: 1,
            id: "events",
            name: "Security Event",
            icon: Activity,
            code: "EVT",
            sampleId: "EVT-2026-00001",
            summary: "Raw telemetry ingested from firewall, SCADA sensors, or cloud egress proxy.",
            roleResponsible: "Telemetry Pipeline",
            appRoute: "/datasets",
            color: "text-sky-400 bg-sky-950/60",
            borderColor: "border-sky-800/80",
        },
        {
            step: 2,
            id: "alerts",
            name: "Alert Triage",
            icon: Radio,
            code: "ALT",
            sampleId: "ALT-2026-00001",
            summary: "SOC analysts triage SIEM signals, apply priority ratings (P1–P4), and verify validity.",
            roleResponsible: "SOC Analyst",
            appRoute: "/alerts",
            color: "text-amber-400 bg-amber-950/60",
            borderColor: "border-amber-800/80",
        },
        {
            step: 3,
            id: "cse",
            name: "Critical Security Event",
            icon: AlertTriangle,
            code: "CSE",
            sampleId: "CSE-2026-00001",
            summary: "High-impact incidents formally escalated to Critical Security Event classification.",
            roleResponsible: "SOC Analyst / CSE Admin",
            appRoute: "/cse",
            color: "text-rose-400 bg-rose-950/60",
            borderColor: "border-rose-800/80",
        },
        {
            step: 4,
            id: "investigation",
            name: "Investigation",
            icon: Layers,
            code: "INV",
            sampleId: "INV-2026-00001",
            summary: "Forensic analysis workspace tracking evidence artifacts and cryptographic hashes.",
            roleResponsible: "Security Operations",
            appRoute: "/investigations",
            color: "text-purple-400 bg-purple-950/60",
            borderColor: "border-purple-800/80",
        },
        {
            step: 5,
            id: "findings",
            name: "Verified Finding",
            icon: FileCheck2,
            code: "FND",
            sampleId: "FND-2026-00001",
            summary: "Confirmed technical or procedural deficiency linked back to root CSE and telemetry.",
            roleResponsible: "Authorized Assessor / SOC",
            appRoute: "/findings",
            color: "text-indigo-400 bg-indigo-950/60",
            borderColor: "border-indigo-800/80",
        },
        {
            step: 6,
            id: "risk",
            name: "Risk Scoring",
            icon: Scale,
            code: "RSK",
            sampleId: "RSK-2026-00001",
            summary: "Calculated inherent and residual risk using 5×5 Impact and Likelihood matrix.",
            roleResponsible: "GRC / Risk Officer",
            appRoute: "/risks",
            color: "text-orange-400 bg-orange-950/60",
            borderColor: "border-orange-800/80",
        },
        {
            step: 7,
            id: "remediation",
            name: "Remediation Plan",
            icon: CheckCircle2,
            code: "REM",
            sampleId: "REM-2026-00001",
            summary: "Targeted corrective action plan assigned with milestones, owner, and due date.",
            roleResponsible: "Remediation Owner",
            appRoute: "/remediations",
            color: "text-emerald-400 bg-emerald-950/60",
            borderColor: "border-emerald-800/80",
        },
        {
            step: 8,
            id: "validation",
            name: "Audit Validation",
            icon: FileSpreadsheet,
            code: "VAL",
            sampleId: "Evidence Verified",
            summary: "Separation of Duties gate: Independent auditor verifies patch evidence before closure.",
            roleResponsible: "Auditor Reviewer",
            appRoute: "/remediations",
            color: "text-blue-400 bg-blue-950/60",
            borderColor: "border-blue-800/80",
        },
        {
            step: 9,
            id: "supervision",
            name: "Supervisory Case",
            icon: Shield,
            code: "SUP",
            sampleId: "SUP-2026-00001",
            summary: "High-risk escalation to sectoral authority for regulatory review and recommendation.",
            roleResponsible: "Supervision Analyst",
            appRoute: "/supervision/cases",
            color: "text-teal-400 bg-teal-950/60",
            borderColor: "border-teal-800/80",
        },
        {
            step: 10,
            id: "decision",
            name: "Authority Decision",
            icon: Gavel,
            code: "DEC",
            sampleId: "DEC-2026-00001",
            summary: "Statutory binding directive, fine consideration, or formal closure by Authority.",
            roleResponsible: "Supervision Authority",
            appRoute: "/supervision/decisions",
            color: "text-amber-300 bg-amber-950/60",
            borderColor: "border-amber-700/80",
        },
    ];

    const currentStage = stages.find((s) => s.step === selectedStep) || stages[0];

    return (
        <section id="pipeline" className="relative py-24 bg-slate-950 text-slate-100 border-t border-slate-800/80 overflow-hidden">
            {/* Ambient Lighting */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-emerald-600/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400">
                        <span>UNBROKEN RELATIONAL PIPELINE</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                        From Ingestion to Regulatory Directive
                    </h2>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                        In SAT-SA, security alerts never terminate as dead tickets. Every stage links via foreign keys
                        to maintain permanent evidentiary provenance.
                    </p>
                </div>

                {/* 10-Stage Visual Track */}
                <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 mb-10">
                    {stages.map((stage) => {
                        const Icon = stage.icon;
                        const isSelected = stage.step === selectedStep;
                        return (
                            <button
                                key={stage.id}
                                onClick={() => setSelectedStep(stage.step)}
                                className={`flex flex-col items-center p-3 rounded-2xl border text-center transition-all focus:outline-none ${isSelected
                                    ? "bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/20 scale-105 z-10"
                                    : "bg-slate-900/50 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700"
                                    }`}
                            >
                                <span className="text-[10px] font-mono text-slate-400 mb-1.5 font-bold">
                                    0{stage.step}
                                </span>
                                <div className={`p-2 rounded-xl mb-2 ${stage.color}`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <span className="text-[11px] font-medium text-slate-200 truncate w-full">
                                    {stage.name}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Spatial Spotlight Card for Active Stage */}
                <SpatialLayer maxTilt={4} depth={10} className="w-full">
                    <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            {/* Stage Details */}
                            <div className="lg:col-span-8 space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                                        STAGE {currentStage.step} OF 10
                                    </span>
                                    <span className="text-xs font-mono text-slate-400">
                                        Prefix: {currentStage.code}-YYYY-XXXXX
                                    </span>
                                </div>

                                <h3 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
                                    <span>{currentStage.name}</span>
                                </h3>

                                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
                                    {currentStage.summary}
                                </p>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                                        <div className="text-[11px] text-slate-400 uppercase font-mono">Sample Identifier</div>
                                        <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">{currentStage.sampleId}</div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                                        <div className="text-[11px] text-slate-400 uppercase font-mono">Governing Role</div>
                                        <div className="text-sm font-bold text-emerald-400 mt-0.5">{currentStage.roleResponsible}</div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
                                        <div className="text-[11px] text-slate-400 uppercase font-mono">Data Traceability</div>
                                        <div className="text-sm font-bold text-slate-200 mt-0.5">PostgreSQL Foreign Key</div>
                                    </div>
                                </div>
                            </div>

                            {/* Action & Console Deep Link */}
                            <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/90 border border-slate-800 text-center space-y-4">
                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center">
                                    {React.createElement(currentStage.icon, { className: "h-8 w-8 text-emerald-400" })}
                                </div>
                                <div>
                                    <div className="text-xs font-mono text-slate-400 uppercase">Live Module Available</div>
                                    <div className="text-base font-bold text-slate-100">{currentStage.name} Console</div>
                                </div>
                                <Link
                                    href="/login"
                                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                                >
                                    <span>Access {currentStage.code} Registry</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </div>

                    </div>
                </SpatialLayer>

            </div>
        </section>
    );
}
