"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, ArrowRight, Menu, X, Terminal, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

export default function LandingNavbar() {
    const { user } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navLinks = [
        { label: "Pipeline", href: "#pipeline" },
        { label: "Roles", href: "#roles" },
        { label: "Negative Space", href: "#negative-space" },
        { label: "Risk & Remediation", href: "#risk-remediation" },
        { label: "Supervision", href: "#supervision" },
        { label: "Executive", href: "#executive" },
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Brand */}
                <Link href="/" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg p-1">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow flex items-center justify-center">
                        <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                            <Shield className="h-5 w-5 text-emerald-400 group-hover:scale-105 transition-transform" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-bold tracking-wider text-slate-100 text-base font-mono">SAT-SA</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                                v2.0
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-400 tracking-tight hidden sm:inline">
                            Supervisory Assessment & Threat Platform
                        </span>
                    </div>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-emerald-400 hover:bg-slate-900/60 rounded-md transition-colors"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* Action Buttons */}
                <div className="hidden sm:flex items-center gap-3">
                    <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Institutional Scope</span>
                    </div>

                    {user ? (
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                            <Terminal className="h-3.5 w-3.5" />
                            <span>Enter Console</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-900 rounded-lg transition-colors"
                            >
                                <Lock className="h-3.5 w-3.5 text-slate-400" />
                                <span>Sign In</span>
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all"
                            >
                                <span>Launch Console</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Hamburger Toggle */}
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 focus:outline-none"
                    aria-label="Toggle Navigation Menu"
                >
                    {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {/* Mobile Dropdown Drawer */}
            {mobileOpen && (
                <div className="lg:hidden bg-slate-950/95 border-b border-slate-800 px-4 pt-3 pb-5 space-y-2 backdrop-blur-xl">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            className="block px-3 py-2 text-sm text-slate-300 hover:text-emerald-400 hover:bg-slate-900 rounded-md"
                        >
                            {link.label}
                        </a>
                    ))}
                    <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
                        <Link
                            href="/login"
                            onClick={() => setMobileOpen(false)}
                            className="w-full text-center py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm shadow-md"
                        >
                            {user ? "Enter Console" : "Launch Console"}
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}
