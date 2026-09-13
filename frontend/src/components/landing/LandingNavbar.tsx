"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X, UserPlus, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import BrandLogo from "@/components/common/BrandLogo";

export default function LandingNavbar() {
    const { user } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navLinks = [
        { label: "Platform", href: "#platform" },
        { label: "Security Workflow", href: "#pipeline" },
        { label: "Roles", href: "#roles" },
        { label: "Assessment", href: "#negative-space" },
        { label: "Risk", href: "#risk-remediation" },
        { label: "Supervision", href: "#supervision" },
        { label: "Executive", href: "#executive" },
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Brand with Official SAT-SA Logo */}
                <Link
                    href="/"
                    className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg p-1"
                    aria-label="SAT-SA Home"
                >
                    <BrandLogo size="md" priority className="group-hover:border-emerald-500/50 group-hover:scale-105" />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-bold tracking-wider text-slate-100 text-base font-mono">SAT-SA</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">

                            </span>
                        </div>
                        <span className="text-[11px] text-slate-400 tracking-tight hidden sm:inline">
                            Supervisory Assessment & Threat Platform
                        </span>
                    </div>
                </Link>

                {/* Center Navigation: Real Sections */}
                <nav className="hidden lg:flex items-center gap-1" aria-label="Landing Page Navigation">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-emerald-400 hover:bg-slate-900/60 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* Action Buttons: Login & Request Access */}
                <div className="hidden sm:flex items-center gap-2.5">
                    {user ? (
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                            <span>Open Platform</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            >
                                <LogIn className="h-3.5 w-3.5" />
                                <span>Login</span>
                            </Link>

                            <Link
                                href="/request-access"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-emerald-400 bg-slate-900/80 hover:bg-slate-850 border border-slate-700/80 hover:border-emerald-500/40 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <UserPlus className="h-3.5 w-3.5 text-slate-400" />
                                <span>Request Access</span>
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Hamburger Toggle */}
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    aria-label="Toggle Navigation Menu"
                    aria-expanded={mobileOpen}
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
                        {user ? (
                            <Link
                                href="/dashboard"
                                onClick={() => setMobileOpen(false)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-sm shadow-md"
                            >
                                <span>Open Platform</span>
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm shadow-md"
                                >
                                    <LogIn className="h-4 w-4" />
                                    <span>Login</span>
                                </Link>
                                <Link
                                    href="/request-access"
                                    onClick={() => setMobileOpen(false)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-emerald-400 font-semibold text-sm"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    <span>Request Access</span>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

