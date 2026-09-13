"use client";

import React from "react";
import Link from "next/link";
import { Code2, ArrowUpRight, LogIn, UserPlus } from "lucide-react";
import BrandLogo from "@/components/common/BrandLogo";

export default function LandingFooter() {
    return (
        <footer className="bg-slate-950 text-slate-400 border-t border-slate-800/80 pt-16 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">

                    {/* Brand Column */}
                    <div className="lg:col-span-2 space-y-4">
                        <Link href="/" className="flex items-center gap-3">
                            <BrandLogo size="sm" priority />
                            <span className="text-lg font-bold text-slate-100 font-mono tracking-wider">SAT-SA</span>
                        </Link>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                            Supervisory Assessment & Threat Platform. Centralizing cybersecurity operations,
                            control assessments, quantitative risk management, and statutory regulatory directives.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                                <LogIn className="h-3 w-3" />
                                <span>Platform Login</span>
                            </Link>
                            <Link
                                href="/request-access"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                <UserPlus className="h-3 w-3" />
                                <span>Request Access</span>
                            </Link>
                        </div>
                    </div>

                    {/* Operational Modules */}
                    <div className="space-y-3 text-xs">
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-200">
                            SecOps & Threat
                        </div>
                        <ul className="space-y-2">
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Alert Triage Queue</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Critical Security Events</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Forensic Investigations</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Telemetry Ingestion</Link></li>
                        </ul>
                    </div>

                    {/* Governance Modules */}
                    <div className="space-y-3 text-xs">
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-200">
                            GRC & Audit
                        </div>
                        <ul className="space-y-2">
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Master Findings Registry</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">5×5 Risk Quantification</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Remediation Action Plans</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">NIST / ISO Assessments</Link></li>
                        </ul>
                    </div>

                    {/* Supervision Modules */}
                    <div className="space-y-3 text-xs">
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-200">
                            Supervision & Exec
                        </div>
                        <ul className="space-y-2">
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Supervisory Case Dossiers</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Authority Directives & Decisions</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Negative-Space Signals</Link></li>
                            <li><Link href="/login" className="hover:text-emerald-400 transition-colors">CISO Command Briefing</Link></li>
                        </ul>
                    </div>

                </div>

                {/* Bottom Copyright & Status */}
                <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                    <div>
                        © {new Date().getFullYear()} SAT-SA. Supervisory Assessment & Threat Platform.
                    </div>
                    <div className="flex items-center gap-6">
                        <a
                            href="https://github.com/UTTAL-KUMAR-RAWANI/sat-sa-website"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-slate-200 transition-colors flex items-center gap-1.5"
                        >
                            <Code2 className="h-4 w-4" />
                            <span>GitHub Source</span>
                            <ArrowUpRight className="h-3 w-3" />
                        </a>
                        <span className="text-emerald-400 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Platform Ready
                        </span>
                    </div>
                </div>

            </div>
        </footer>
    );
}
