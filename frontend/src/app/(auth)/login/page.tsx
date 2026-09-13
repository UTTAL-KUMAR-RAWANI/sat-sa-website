"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Shield, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

const loginSchema = z.object({
    email: z.string().email("Please provide a valid email address"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const demoUsers = [
    { label: "Admin", email: "admin@sat-sa.local", role: "CSE Administrator" },
    { label: "CISO", email: "ciso@sat-sa.local", role: "CISO Leadership" },
    { label: "SOC Lead", email: "soc@sat-sa.local", role: "SOC Analyst" },
    { label: "Assessor", email: "assessor@sat-sa.local", role: "Authorized Assessor" },
    { label: "Auditor", email: "auditor@sat-sa.local", role: "Auditor Reviewer" },
    { label: "Authority", email: "supervision.auth@sat-sa.local", role: "Supervision Authority" },
    { label: "Sup Analyst", email: "supervision.analyst@sat-sa.local", role: "Supervision Analyst" },
    { label: "Remediation", email: "remediation@sat-sa.local", role: "Remediation Owner" },
    { label: "GRC Officer", email: "grc@sat-sa.local", role: "GRC/Risk Officer" },
];

export default function LoginPage() {
    const { checkAuth } = useAuth();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "admin@sat-sa.local",
            password: "DemoPassword123!",
        },
    });

    const onSubmit = async (data: LoginFormValues) => {
        setError(null);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
            const res = await fetch(`${apiUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });

            if (res.ok) {
                await checkAuth();
                router.push("/dashboard");
            } else {
                const errorData = await res.json();
                setError(errorData.detail || "Authentication failed. Check credentials.");
            }
        } catch {
            setError("Unable to connect to authentication gateway. Ensure backend is running.");
        }
    };

    const handleSelectDemo = (email: string) => {
        setValue("email", email);
        setValue("password", "DemoPassword123!");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden">
            {/* Background subtle glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
                {/* Brand Header */}
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25">
                        <Shield className="h-6 w-6 fill-slate-950" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white">
                            SAT-SA Platform
                        </h1>
                        <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mt-0.5">
                            Supervisory Assessment & Threat Platform
                        </p>
                    </div>
                    <p className="text-xs text-slate-400 pt-1">
                        Authoritative cyber supervision & regulatory oversight
                    </p>
                </div>

                {/* Demo User Switcher */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Quick Evaluation Accounts:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                        {demoUsers.slice(0, 3).map((u) => (
                            <button
                                key={u.email}
                                type="button"
                                onClick={() => handleSelectDemo(u.email)}
                                className="rounded border border-slate-800 bg-slate-900/90 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors truncate"
                                title={`${u.role} (${u.email})`}
                            >
                                {u.label}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {demoUsers.slice(3).map((u) => (
                            <button
                                key={u.email}
                                type="button"
                                onClick={() => handleSelectDemo(u.email)}
                                className="rounded border border-slate-800 bg-slate-900/90 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors truncate"
                                title={`${u.role} (${u.email})`}
                            >
                                {u.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Login Form */}
                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    {error && (
                        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <input
                                type="email"
                                autoComplete="email"
                                placeholder="operator@sat-sa.local"
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                                {...register("email")}
                            />
                        </div>
                        {errors.email && (
                            <p className="text-rose-400 text-[11px] mt-0.5">{errors.email.message}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">Access Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <input
                                type="password"
                                autoComplete="current-password"
                                placeholder="••••••••••••"
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors font-mono"
                                {...register("password")}
                            />
                        </div>
                        {errors.password && (
                            <p className="text-rose-400 text-[11px] mt-0.5">{errors.password.message}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 px-4 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 mt-2"
                    >
                        <span>{isSubmitting ? "Authenticating Session..." : "Secure Sign In"}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </form>

                {/* Footer security notice */}
                <div className="text-center pt-2 border-t border-slate-800/80">
                    <p className="text-[10px] text-slate-500">
                        Authorized Supervisory Personnel Only. All access operations are cryptographically audited.
                    </p>
                </div>
            </div>
        </div>
    );
}
