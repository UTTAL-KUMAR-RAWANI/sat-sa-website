"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
    Shield, 
    FileSpreadsheet, 
    Lock, 
    Cpu, 
    Settings, 
    CheckCircle2, 
    AlertOctagon, 
    Users, 
    ArrowRight 
} from "lucide-react";
import SpatialLayer from "./SpatialLayer";

interface DepartmentData {
    id: string;
    name: string;
    icon: React.ElementType;
    badge: string;
    scope: string;
    description: string;
    roles: {
        name: string;
        scope: string;
        keyActions: string;
        sodRule: string;
    }[];
}

export default function RoleIntelligenceSection() {
    const [activeDept, setActiveDept] = useState<string>("supervision");

    const departments: DepartmentData[] = [
        {
            id: "supervision",
            name: "Supervision",
            icon: Shield,
            badge: "Regulatory Oversight",
            scope: "Enterprise & Sectoral Scope",
            description: "Statutory oversight authorities reviewing cross-entity cyber resilience and issuing binding directives.",
            roles: [
                {
                    name: "Supervision Authority",
                    scope: "Enterprise",
                    keyActions: "Executes binding regulatory directives, sanctions, and formal case closures.",
                    sodRule: "Authority-only action: Analysts can recommend; only the Authority decides.",
                },
                {
                    name: "Supervision Analyst",
                    scope: "Sector Scope",
                    keyActions: "Evaluates incident dossiers, requests supplementary proof, and drafts recommendations.",
                    sodRule: "Cannot issue binding directives directly.",
                },
                {
                    name: "Sector Security Authority",
                    scope: "Sector Scope",
                    keyActions: "Coordinates sectoral incident response across critical infrastructure entities.",
                    sodRule: "Restricted to assigned critical infrastructure sector.",
                },
            ],
        },
        {
            id: "assessment",
            name: "Assessment / Audit",
            icon: FileSpreadsheet,
            badge: "Independent Validation",
            scope: "Organization & Assigned Scope",
            description: "Rigorous compliance and technical testing teams evaluating security controls against NIST CSF and ISO 27001.",
            roles: [
                {
                    name: "Authorized Assessor",
                    scope: "Assigned Scope",
                    keyActions: "Conducts audit assessments, inspects control telemetry, and files formal findings.",
                    sodRule: "Cannot approve own assessment submission.",
                },
                {
                    name: "Auditor Reviewer",
                    scope: "Organization Scope",
                    keyActions: "Performs independent review, requests changes, and signs off on final approvals.",
                    sodRule: "Independent second-pair-of-eyes review mandatory.",
                },
            ],
        },
        {
            id: "security",
            name: "Security & GRC",
            icon: Lock,
            badge: "Governance & Posture",
            scope: "Enterprise Scope",
            description: "Strategic risk management, executive oversight, and compliance policy administration.",
            roles: [
                {
                    name: "CISO",
                    scope: "Enterprise Scope",
                    keyActions: "Monitors real-time risk posture, remediation SLA velocity, and executive escalations.",
                    sodRule: "Full executive oversight across all operating entities.",
                },
                {
                    name: "GRC/Risk Officer",
                    scope: "Enterprise Scope",
                    keyActions: "Calculates 5×5 risk matrices, approves treatment plans, and reviews risk exceptions.",
                    sodRule: "Enforces quantitative thresholds before risk acceptance.",
                },
                {
                    name: "Senior Management",
                    scope: "Enterprise Scope",
                    keyActions: "Reviews macro risk appetite, compliance posture, and regulatory disclosures.",
                    sodRule: "Read-only strategic oversight dashboard.",
                },
            ],
        },
        {
            id: "operations",
            name: "Operations",
            icon: Cpu,
            badge: "Tactical Execution",
            scope: "Organization Scope",
            description: "Front-line technical security operations, incident response, and corrective system patching.",
            roles: [
                {
                    name: "SOC Analyst",
                    scope: "Organization Scope",
                    keyActions: "Triages SIEM/EDR alerts and formally escalates confirmed breaches to CSE.",
                    sodRule: "Cannot modify regulatory risk scoring or issue supervision closures.",
                },
                {
                    name: "Remediation Owner",
                    scope: "Assigned Scope",
                    keyActions: "Executes technical fix plans and submits verifiable patch evidence.",
                    sodRule: "Cannot self-validate remediation evidence.",
                },
                {
                    name: "IT Infrastructure Team",
                    scope: "Organization Scope",
                    keyActions: "Deploys perimeter firewall and proxy configurations for zero-trust enforcement.",
                    sodRule: "Subject to operational change windows and validation sign-offs.",
                },
                {
                    name: "Control Owner",
                    scope: "Organization Scope",
                    keyActions: "Maintains operational control baselines and provisions compliance telemetry.",
                    sodRule: "Must provide cryptographically hashed evidence artifacts.",
                },
            ],
        },
        {
            id: "administration",
            name: "Platform Admin",
            icon: Settings,
            badge: "System Governance",
            scope: "Global Scope",
            description: "Centralized identity, role assignments, tenancy definitions, and immutable audit logs.",
            roles: [
                {
                    name: "CSE Administrator",
                    scope: "Global Scope",
                    keyActions: "Provisions users, assigns scoped roles, inspects audit logs, and monitors system health.",
                    sodRule: "Full governance transparency via tamper-evident audit logs.",
                },
            ],
        },
    ];

    const currentDept = departments.find((d) => d.id === activeDept) || departments[0];

    return (
        <section id="roles" className="relative py-24 bg-slate-950 text-slate-100 border-t border-slate-800/80 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400">
                        <Users className="h-3.5 w-3.5" />
                        <span>ROLE-BASED GOVERNANCE MATRIX</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                        13 Authoritative Roles. 5 Departments. Zero Ambiguity.
                    </h2>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                        SAT-SA eliminates permission drift by enforcing strict Separation of Duties (SoD) 
                        and multi-tenant scoping authoritatively on every database query.
                    </p>
                </div>

                {/* Department Navigation Tabs */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
                    {departments.map((dept) => {
                        const Icon = dept.icon;
                        const isActive = dept.id === activeDept;
                        return (
                            <button
                                key={dept.id}
                                onClick={() => setActiveDept(dept.id)}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all focus:outline-none ${
                                    isActive
                                        ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-105"
                                        : "bg-slate-900/80 text-slate-300 hover:bg-slate-850 hover:text-slate-100 border border-slate-800"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{dept.name}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Department Spotlight Grid */}
                <SpatialLayer maxTilt={3} depth={8}>
                    <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/95 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
                        
                        {/* Dept Meta Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 mb-8">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-2xl font-bold text-slate-100">{currentDept.name} Department</h3>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                                        {currentDept.badge}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-xs sm:text-sm max-w-xl">{currentDept.description}</p>
                            </div>
                            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 self-start sm:self-auto">
                                Scope: <span className="text-emerald-400">{currentDept.scope}</span>
                            </div>
                        </div>

                        {/* Roles Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {currentDept.roles.map((role) => (
                                <div
                                    key={role.name}
                                    className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-100">{role.name}</span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                                {role.scope}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            {role.keyActions}
                                        </p>
                                    </div>

                                    {/* Separation of Duties Rule */}
                                    <div className="pt-3 border-t border-slate-900 flex items-start gap-2">
                                        <AlertOctagon className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                                        <span className="text-[11px] text-amber-300/90 font-mono leading-tight">
                                            SoD: {role.sodRule}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bottom Action Footer */}
                        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-xs text-slate-400 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                <span>All 13 roles pre-seeded in test environment with safe demo credentials.</span>
                            </div>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                                <span>Try Demo Account Switcher</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                    </div>
                </SpatialLayer>

            </div>
        </section>
    );
}
