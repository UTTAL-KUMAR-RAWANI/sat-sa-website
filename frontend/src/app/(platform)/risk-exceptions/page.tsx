"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    risksApi,
    RiskExceptionItem,
    RiskExceptionStatus,
} from "@/lib/api/risks";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    ShieldAlert,
    Search,
    RefreshCw,
    Sliders,
    Layers,
    Clock,
    User as UserIcon,
    AlertCircle,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
    Filter,
    Shield,
    AlertTriangle,
} from "lucide-react";

export default function RiskExceptionsPage() {
    const { user } = useAuth();
    const [exceptions, setExceptions] = useState<RiskExceptionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [search, setSearch] = useState<string>("");

    // Review Modal
    const [selectedException, setSelectedException] = useState<RiskExceptionItem | null>(null);
    const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
    const [reviewerComments, setReviewerComments] = useState<string>("");
    const [expiryDate, setExpiryDate] = useState<string>("");
    const [isReviewing, setIsReviewing] = useState(false);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);

    const canReviewException = hasPermission(user, Permissions.RISK_EXCEPTION_REVIEW) || hasPermission(user, Permissions.RISK_APPROVE);

    const loadExceptions = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await risksApi.getExceptions({
                status: statusFilter || undefined,
            });
            setExceptions(data);
        } catch (err: any) {
            setError(err.message || "Failed to load risk exceptions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadExceptions();
    }, [statusFilter]);

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedException) return;

        setIsReviewing(true);
        try {
            await risksApi.reviewException(selectedException.id, {
                decision: reviewDecision,
                reviewer_comments: reviewerComments.trim() || undefined,
                expiry_date: reviewDecision === "APPROVED" && expiryDate ? new Date(expiryDate).toISOString() : undefined,
            });
            setReviewModalOpen(false);
            setSelectedException(null);
            setReviewerComments("");
            setExpiryDate("");
            loadExceptions();
        } catch (err: any) {
            window.alert(err.message || "Failed to submit exception review decision");
        } finally {
            setIsReviewing(false);
        }
    };

    // Filtered items
    const filteredExceptions = exceptions.filter((ex) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            ex.business_id.toLowerCase().includes(q) ||
            ex.title.toLowerCase().includes(q) ||
            ex.justification.toLowerCase().includes(q) ||
            (ex.requested_by_name && ex.requested_by_name.toLowerCase().includes(q)) ||
            (ex.approved_by_name && ex.approved_by_name.toLowerCase().includes(q))
        );
    });

    const getStatusBadge = (st: RiskExceptionStatus) => {
        switch (st) {
            case "APPROVED":
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
            case "UNDER_REVIEW":
                return "bg-blue-500/15 text-blue-400 border-blue-500/30";
            case "REQUESTED":
                return "bg-amber-500/15 text-amber-400 border-amber-500/30";
            case "REJECTED":
                return "bg-rose-500/15 text-rose-400 border-rose-500/30";
            case "EXPIRED":
                return "bg-purple-500/15 text-purple-400 border-purple-500/30";
            case "CLOSED":
                return "bg-slate-800 text-slate-400 border-slate-700";
            default:
                return "bg-slate-800 text-slate-300 border-slate-700";
        }
    };

    // Quick stats
    const totalCount = exceptions.length;
    const pendingReviewCount = exceptions.filter(
        (ex) => ex.status === "REQUESTED" || ex.status === "UNDER_REVIEW"
    ).length;
    const approvedCount = exceptions.filter((ex) => ex.status === "APPROVED").length;
    const rejectedOrExpiredCount = exceptions.filter(
        (ex) => ex.status === "REJECTED" || ex.status === "EXPIRED"
    ).length;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header & Sub-navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        Risk & GRC Governance
                    </div>
                    <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Risk Exceptions Registry</h1>
                    <p className="text-sm text-slate-400">
                        Formal deviation requests, non-standard risk acceptances, and time-bound exception governance with Separation of Duties.
                    </p>
                </div>

                {/* Sub-nav switcher */}
                <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                    <Link
                        href="/risks"
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Risk Register
                    </Link>
                    <Link
                        href="/risk-treatments"
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Treatments
                    </Link>
                    <Link
                        href="/risk-exceptions"
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 shadow-sm"
                    >
                        Exceptions
                    </Link>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Total Exceptions</span>
                        <Layers className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-100 mt-1">{totalCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Logged exception requests</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-amber-400">
                        <span>Pending Approval</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">{pendingReviewCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Awaiting independent review</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-emerald-400">
                        <span>Approved & Active</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">{approvedCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Currently valid deviations</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-purple-400">
                        <span>Expired / Rejected</span>
                        <XCircle className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400 mt-1">{rejectedOrExpiredCount}</div>
                    <div className="text-xs text-slate-500 mt-1">Inoperative or closed</div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search exceptions, justification, IDs..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Filter className="w-3.5 h-3.5" />
                        <span>Status:</span>
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                        <option value="">All Statuses</option>
                        <option value="REQUESTED">Requested</option>
                        <option value="UNDER_REVIEW">Under Review</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="EXPIRED">Expired</option>
                        <option value="CLOSED">Closed</option>
                    </select>

                    <button
                        onClick={loadExceptions}
                        disabled={loading}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        title="Refresh Exceptions"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-500" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Exceptions Table */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                        <span className="text-xs">Loading exceptions registry...</span>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-rose-400 flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6" />
                        <span className="text-xs">{error}</span>
                    </div>
                ) : filteredExceptions.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                        <Shield className="w-8 h-8 text-slate-600" />
                        <span className="text-sm font-medium text-slate-400">No risk exceptions found</span>
                        <span className="text-xs text-slate-500">
                            Exceptions can be requested from any risk detail page under Exceptions Governance.
                        </span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                                    <th className="py-3 px-4 font-semibold">Exception ID</th>
                                    <th className="py-3 px-4 font-semibold">Title & Justification</th>
                                    <th className="py-3 px-4 font-semibold">Status</th>
                                    <th className="py-3 px-4 font-semibold">Requester</th>
                                    <th className="py-3 px-4 font-semibold">Approver</th>
                                    <th className="py-3 px-4 font-semibold">Expiry Date</th>
                                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredExceptions.map((ex) => {
                                    const isRequester = user && user.id === ex.requested_by_id;
                                    const isPending = ex.status === "REQUESTED" || ex.status === "UNDER_REVIEW";

                                    return (
                                        <tr key={ex.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                                                {ex.business_id}
                                            </td>
                                            <td className="py-3 px-4 max-w-sm">
                                                <div className="font-semibold text-slate-100 line-clamp-1">{ex.title}</div>
                                                <div className="text-slate-400 text-xs line-clamp-2 mt-0.5">{ex.justification}</div>
                                                {ex.reviewer_comments && (
                                                    <div className="text-[11px] text-slate-400 mt-1 italic border-l-2 border-slate-700 pl-2">
                                                        "{ex.reviewer_comments}"
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(ex.status)}`}>
                                                    {ex.status.replace("_", " ")}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                                                <div className="flex items-center gap-1.5">
                                                    <UserIcon className="w-3 h-3 text-slate-500" />
                                                    <span>{ex.requested_by_name || "Unknown"}</span>
                                                </div>
                                                {isRequester && (
                                                    <span className="text-[10px] text-amber-400/80 font-mono">(You)</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                                                {ex.approved_by_name ? (
                                                    <span className="text-slate-200">{ex.approved_by_name}</span>
                                                ) : (
                                                    <span className="text-slate-600">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                                                {ex.expiry_date ? (
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-slate-500" />
                                                        <span>{new Date(ex.expiry_date).toLocaleDateString()}</span>
                                                    </div>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isPending && canReviewException && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedException(ex);
                                                                setReviewDecision("APPROVED");
                                                                setReviewModalOpen(true);
                                                            }}
                                                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded text-xs transition-colors shadow-sm"
                                                        >
                                                            Review & Decide
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={`/risks/${ex.risk_id}`}
                                                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors border border-slate-700 flex items-center gap-1"
                                                    >
                                                        Risk Detail <ArrowUpRight className="w-3 h-3" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Review & Decision Modal */}
            {reviewModalOpen && selectedException && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-100">Review Risk Exception</h3>
                                <p className="text-xs text-slate-400">{selectedException.business_id} — {selectedException.title}</p>
                            </div>
                            <button
                                onClick={() => setReviewModalOpen(false)}
                                className="text-slate-400 hover:text-slate-200 text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Separation of Duties Warning */}
                        {user && user.id === selectedException.requested_by_id ? (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                                <div>
                                    <div className="font-semibold">Separation of Duties (SoD) Conflict</div>
                                    <p className="mt-0.5 text-rose-300/80">
                                        You are the requester of this exception. To maintain independent governance, exceptions must be reviewed and approved by an authorized GRC or Security Officer other than the requester.
                                    </p>
                                </div>
                            </div>
                        ) : null}

                        <form onSubmit={handleReviewSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Governance Decision
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setReviewDecision("APPROVED")}
                                        className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                            reviewDecision === "APPROVED"
                                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30"
                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                        }`}
                                    >
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        APPROVE EXCEPTION
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReviewDecision("REJECTED")}
                                        className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                            reviewDecision === "REJECTED"
                                                ? "bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/30"
                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                        }`}
                                    >
                                        <XCircle className="w-4 h-4 text-rose-400" />
                                        REJECT EXCEPTION
                                    </button>
                                </div>
                            </div>

                            {reviewDecision === "APPROVED" && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Mandatory Expiry Date <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={expiryDate}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Exceptions must be strictly time-bound under regulatory risk management standards.
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Reviewer Justification / Comments
                                </label>
                                <textarea
                                    rows={3}
                                    value={reviewerComments}
                                    onChange={(e) => setReviewerComments(e.target.value)}
                                    placeholder="State rationale for approval or criteria for rejection..."
                                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setReviewModalOpen(false)}
                                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        isReviewing ||
                                        (user && user.id === selectedException.requested_by_id) ||
                                        (reviewDecision === "APPROVED" && !expiryDate)
                                    }
                                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                                        reviewDecision === "APPROVED"
                                            ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                                            : "bg-rose-500 hover:bg-rose-400 text-white"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isReviewing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    Submit Decision
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
