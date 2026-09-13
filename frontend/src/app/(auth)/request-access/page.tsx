"use client";

import React, { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/common/BrandLogo";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Shield,
    UserPlus,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    ArrowLeft,
    Building2,
    Mail,
    User,
    Briefcase,
    FileText,
    Layers,
    Check
} from "lucide-react";

const requestAccessSchema = z.object({
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Please provide a valid institutional email address"),
    organization_name: z.string().min(2, "Organization name is required"),
    department_name: z.string().min(2, "Department is required"),
    job_title: z.string().min(2, "Job title is required"),
    requested_role: z.string().min(1, "Please select a primary requested role"),
    sector_name: z.string().min(1, "Please select your sector classification"),
    reason: z.string().min(10, "Please provide at least 10 characters detailing your operational need"),
    additional_notes: z.string().optional(),
});

type RequestAccessFormValues = z.infer<typeof requestAccessSchema>;

const CANONICAL_ROLES = [
    { name: "SOC Analyst", group: "Operations", desc: "Alert triage, investigation, evidence gathering" },
    { name: "Authorized Assessor", group: "Assessment & Audit", desc: "NIST/ISO assessments, finding drafting" },
    { name: "Auditor Reviewer", group: "Assessment & Audit", desc: "Independent audit validation and sign-off" },
    { name: "GRC / Risk Officer", group: "Risk & Governance", desc: "5×5 risk matrix, treatment tracking" },
    { name: "Remediation Owner", group: "Remediation", desc: "Action plan execution and evidence submission" },
    { name: "Control Owner", group: "Operations", desc: "Control design and operating effectiveness" },
    { name: "IT Infrastructure Team", group: "Operations", desc: "Sensor telemetry and technical fix execution" },
    { name: "Supervision Analyst", group: "Supervision", desc: "Regulatory case drafting and dossier review" },
    { name: "Supervision Authority", group: "Supervision", desc: "Statutory directives and binding decisions" },
    { name: "Sector Security Authority", group: "Supervision", desc: "Cross-sector threat intelligence sharing" },
    { name: "CISO Leadership", group: "Executive", desc: "Command briefing and systemic risk oversight" },
    { name: "Senior Management", group: "Executive", desc: "Board-level risk and compliance visibility" },
    { name: "CSE Administrator", group: "Administration", desc: "Privilege governance and system administration" },
];

const SECTOR_OPTIONS = [
    "Financial Services",
    "Energy & Critical Infrastructure",
    "Healthcare & Life Sciences",
    "Telecommunications & Digital Services",
    "Government & National Defense",
];

export default function RequestAccessPage() {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submittedData, setSubmittedData] = useState<{
        requestId: string;
        fullName: string;
        email: string;
        requestedRole: string;
        organization: string;
    } | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RequestAccessFormValues>({
        resolver: zodResolver(requestAccessSchema),
        defaultValues: {
            full_name: "",
            email: "",
            organization_name: "",
            department_name: "",
            job_title: "",
            requested_role: "SOC Analyst",
            sector_name: "Financial Services",
            reason: "",
            additional_notes: "",
        },
    });

    const onSubmit = async (data: RequestAccessFormValues) => {
        setSubmitting(true);
        setError(null);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
            const res = await fetch(`${apiUrl}/auth/request-access`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                const resData = await res.json();
                setSubmittedData({
                    requestId: resData.request_id || "REQ-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
                    fullName: data.full_name,
                    email: data.email,
                    requestedRole: data.requested_role,
                    organization: data.organization_name,
                });
            } else {
                const errJson = await res.json().catch(() => ({}));
                setError(errJson.detail || "Unable to submit access request. Please verify inputs.");
            }
        } catch {
            setError("Unable to reach the platform registration service. Please verify backend connection.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
            {/* Background Spatial Atmosphere */}
            <div className="absolute inset-0 bg-spatial-grid opacity-60 pointer-events-none" />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-2xl mx-auto w-full relative z-10 space-y-8">

                {/* Brand Header */}
                <div className="text-center space-y-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-3 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 group"
                    >
                        <BrandLogo size="md" priority className="border-0 shadow-none bg-transparent" />
                        <div className="text-left pr-2">
                            <span className="font-bold tracking-wider text-slate-100 text-sm font-mono block">SAT-SA</span>
                            <span className="text-[10px] text-emerald-400 font-mono">Supervisory Assessment & Threat Platform</span>
                        </div>
                    </Link>

                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Institutional Access Request
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-lg mx-auto">
                            Prospective user onboarding and role assignment. All credentials are
                            strictly gated by Separation of Duties and require authoritative CSE Administrator approval.
                        </p>
                    </div>
                </div>

                {/* Submitted Confirmation State */}
                {submittedData ? (
                    <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-8 sm:p-10 shadow-2xl backdrop-blur-xl space-y-6 text-center">
                        <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                            <CheckCircle2 className="h-9 w-9" />
                        </div>

                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-xs font-mono text-emerald-400">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>STATUS: PENDING ADMINISTRATOR REVIEW</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                Access Request Submitted Successfully
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                                Your access request for <strong className="text-emerald-400">{submittedData.fullName}</strong> ({submittedData.email})
                                has been safely recorded in the central platform registry.
                            </p>
                        </div>

                        {/* Request Summary Card */}
                        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-left text-xs space-y-2 font-mono">
                            <div className="flex justify-between py-1 border-b border-slate-800/80">
                                <span className="text-slate-400">Request Reference ID:</span>
                                <span className="text-emerald-400 font-bold">{submittedData.requestId}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-800/80">
                                <span className="text-slate-400">Organization:</span>
                                <span className="text-slate-200">{submittedData.organization}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-800/80">
                                <span className="text-slate-400">Requested Role:</span>
                                <span className="text-cyan-400 font-semibold">{submittedData.requestedRole}</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-slate-400">Governance State:</span>
                                <span className="text-amber-400 font-semibold">Queued for Review (No Automatic Access)</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 text-left space-y-1">
                            <div className="font-semibold text-slate-300">Next Steps:</div>
                            <p>1. The platform CSE Administrator will review your operational credentials.</p>
                            <p>2. Upon approval, your user account will be activated with scoped RBAC permissions.</p>
                            <p>3. If you have immediate operational urgency, contact your institutional platform coordinator.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                            <Link
                                href="/"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                <span>Return to Home</span>
                            </Link>

                            <Link
                                href="/login"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            >
                                <span>Proceed to Login</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                ) : (
                    /* Request Form */
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-10 shadow-2xl backdrop-blur-xl space-y-6">

                        {/* Notice Banner */}
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
                            <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <strong className="text-white block">Official Institutional Form</strong>
                                New personnel requesting access to the SAT-SA environment must provide institutional affiliation.
                                Requests are not automatically granted.
                            </div>
                        </div>

                        {error && (
                            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-start gap-2.5 text-xs text-rose-300">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <div>{error}</div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                            {/* Two-Column Grid: Name & Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="full_name" className="block text-xs font-semibold text-slate-200">
                                        Full Name <span className="text-emerald-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                        <input
                                            id="full_name"
                                            type="text"
                                            placeholder="e.g., Dr. Marcus Vance"
                                            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                            {...register("full_name")}
                                        />
                                    </div>
                                    {errors.full_name && (
                                        <p className="text-rose-400 text-[11px]">{errors.full_name.message}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="email" className="block text-xs font-semibold text-slate-200">
                                        Institutional Work Email <span className="text-emerald-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                        <input
                                            id="email"
                                            type="email"
                                            placeholder="name@organization.gov.sa"
                                            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                            {...register("email")}
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="text-rose-400 text-[11px]">{errors.email.message}</p>
                                    )}
                                </div>
                            </div>

                            {/* Organization & Sector */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="organization_name" className="block text-xs font-semibold text-slate-200">
                                        Organization Name <span className="text-emerald-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                        <input
                                            id="organization_name"
                                            type="text"
                                            placeholder="e.g., National Central Bank"
                                            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                            {...register("organization_name")}
                                        />
                                    </div>
                                    {errors.organization_name && (
                                        <p className="text-rose-400 text-[11px]">{errors.organization_name.message}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="sector_name" className="block text-xs font-semibold text-slate-200">
                                        Sector / Industry <span className="text-emerald-400">*</span>
                                    </label>
                                    <select
                                        id="sector_name"
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                        {...register("sector_name")}
                                    >
                                        {SECTOR_OPTIONS.map((sec) => (
                                            <option key={sec} value={sec}>{sec}</option>
                                        ))}
                                    </select>
                                    {errors.sector_name && (
                                        <p className="text-rose-400 text-[11px]">{errors.sector_name.message}</p>
                                    )}
                                </div>
                            </div>

                            {/* Department & Job Title */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="department_name" className="block text-xs font-semibold text-slate-200">
                                        Department / Division <span className="text-emerald-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <Layers className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                        <input
                                            id="department_name"
                                            type="text"
                                            placeholder="e.g., Cyber Defense Operations"
                                            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                            {...register("department_name")}
                                        />
                                    </div>
                                    {errors.department_name && (
                                        <p className="text-rose-400 text-[11px]">{errors.department_name.message}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="job_title" className="block text-xs font-semibold text-slate-200">
                                        Job Title / Role Designation <span className="text-emerald-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                        <input
                                            id="job_title"
                                            type="text"
                                            placeholder="e.g., Senior Incident Handler"
                                            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                            {...register("job_title")}
                                        />
                                    </div>
                                    {errors.job_title && (
                                        <p className="text-rose-400 text-[11px]">{errors.job_title.message}</p>
                                    )}
                                </div>
                            </div>

                            {/* Requested Canonical Role */}
                            <div className="space-y-1.5">
                                <label htmlFor="requested_role" className="block text-xs font-semibold text-slate-200">
                                    Primary Requested Role (13 Canonical Roles) <span className="text-emerald-400">*</span>
                                </label>
                                <select
                                    id="requested_role"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                    {...register("requested_role")}
                                >
                                    {CANONICAL_ROLES.map((r) => (
                                        <option key={r.name} value={r.name}>
                                            {r.name} [{r.group}] — {r.desc}
                                        </option>
                                    ))}
                                </select>
                                {errors.requested_role && (
                                    <p className="text-rose-400 text-[11px]">{errors.requested_role.message}</p>
                                )}
                            </div>

                            {/* Operational Justification */}
                            <div className="space-y-1.5">
                                <label htmlFor="reason" className="block text-xs font-semibold text-slate-200">
                                    Operational Justification & Need <span className="text-emerald-400">*</span>
                                </label>
                                <textarea
                                    id="reason"
                                    rows={3}
                                    placeholder="Detail specific supervisory tasks, assessment campaigns, or triage duties requiring platform access..."
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                    {...register("reason")}
                                />
                                {errors.reason && (
                                    <p className="text-rose-400 text-[11px]">{errors.reason.message}</p>
                                )}
                            </div>

                            {/* Additional Information / Clearance Notes */}
                            <div className="space-y-1.5">
                                <label htmlFor="additional_notes" className="block text-xs font-semibold text-slate-300">
                                    Additional Clearance / Security Information <span className="text-slate-500 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    id="additional_notes"
                                    rows={2}
                                    placeholder="e.g., Clearance certification number, supervisory case reference, or sponsoring manager details..."
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
                                    {...register("additional_notes")}
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold py-3 px-4 text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            >
                                {submitting ? (
                                    <>
                                        <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                        <span>Submitting Access Request...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        <span>Submit Access Request</span>
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </>
                                )}
                            </button>

                            {/* Bottom Switcher */}
                            <div className="pt-2 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                <span>Already have authorized credentials?</span>
                                <Link
                                    href="/login"
                                    className="font-semibold text-emerald-400 hover:underline inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded p-0.5"
                                >
                                    <span>Sign in to Platform</span>
                                    <ArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </form>
                    </div>
                )}

                {/* Footer Security Notice */}
                <div className="text-center pt-2 text-[11px] text-slate-500 font-mono">
                    SAT-SA Security Governance Protocol • Access Requests subject to statutory auditing
                </div>

            </div>
        </div>
    );
}
