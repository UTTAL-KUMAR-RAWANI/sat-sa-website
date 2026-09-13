"use client";

import React, { useEffect, useState } from "react";
import {
    fetchAdminAccessRequests,
    reviewAdminAccessRequest,
    AccessRequestItem,
} from "@/lib/api/admin";
import {
    UserCheck,
    Check,
    X,
    Clock,
    AlertCircle,
    Building2,
    Shield,
} from "lucide-react";

export default function AdminAccessRequestsPage() {
    const [requests, setRequests] = useState<AccessRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Decision modal state
    const [activeRequest, setActiveRequest] = useState<AccessRequestItem | null>(null);
    const [decisionType, setDecisionType] = useState<"APPROVE" | "REJECT">("APPROVE");
    const [comments, setComments] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAdminAccessRequests(statusFilter || undefined);
            setRequests(data);
        } catch (err: any) {
            setError(err.message || "Failed to load access requests");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [statusFilter]);

    const handleOpenReview = (req: AccessRequestItem, decision: "APPROVE" | "REJECT") => {
        setActiveRequest(req);
        setDecisionType(decision);
        setComments("");
    };

    const handleConfirmDecision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeRequest) return;
        setSubmitting(true);
        setError(null);
        try {
            await reviewAdminAccessRequest(activeRequest.id, decisionType, comments);
            setActiveRequest(null);
            setSuccessMessage(
                `Access request for '${activeRequest.requester_name}' was ${decisionType === "APPROVE" ? "approved" : "rejected"}`
            );
            loadData();
        } catch (err: any) {
            setError(err.message || "Failed to process decision");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white">Privilege & Role Access Requests</h2>
                    <p className="text-xs text-slate-400">Formal workflows for security role escalation and organizational alignment</p>
                </div>
                <div className="flex gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
                    {[
                        { label: "All Requests", val: "" },
                        { label: "Pending", val: "PENDING" },
                        { label: "Approved", val: "APPROVED" },
                        { label: "Rejected", val: "REJECTED" },
                    ].map((f) => (
                        <button
                            key={f.val}
                            onClick={() => setStatusFilter(f.val)}
                            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                                statusFilter === f.val
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {successMessage && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)}><X className="h-4 w-4" /></button>
                </div>
            )}
            {error && (
                <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                        <span>{error}</span>
                    </div>
                    <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
                </div>
            )}

            {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                    Loading access requests...
                </div>
            ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-slate-800 bg-slate-900/40">
                    <UserCheck className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-300">No requests found</p>
                    <p className="text-xs text-slate-500">There are no access requests matching the selected filter.</p>
                </div>
            ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                                <th className="p-3.5 font-medium">Requester</th>
                                <th className="p-3.5 font-medium">Target Role & Alignment</th>
                                <th className="p-3.5 font-medium">Justification</th>
                                <th className="p-3.5 font-medium">Submitted</th>
                                <th className="p-3.5 font-medium">Status</th>
                                <th className="p-3.5 font-medium text-right">Administrative Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {requests.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-3.5">
                                        <div className="font-bold text-white">{r.requester_name}</div>
                                        <div className="text-[11px] text-slate-400 font-mono">{r.requester_email}</div>
                                    </td>
                                    <td className="p-3.5">
                                        <div className="flex items-center gap-1.5 font-medium text-emerald-400 mb-0.5">
                                            <Shield className="h-3 w-3" />
                                            <span>{r.requested_role_name || "Unspecified Role"}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                            <Building2 className="h-2.5 w-2.5 text-slate-500" />
                                            <span>{r.requested_organization_name || "Enterprise"}</span>
                                        </div>
                                    </td>
                                    <td className="p-3.5 max-w-xs text-slate-300">
                                        <div className="truncate" title={r.reason || ""}>
                                            {r.reason || "No explicit reason provided."}
                                        </div>
                                    </td>
                                    <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                                        {new Date(r.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-3.5">
                                        {r.status === "PENDING" && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                                                <Clock className="h-2.5 w-2.5" /> Pending
                                            </span>
                                        )}
                                        {r.status === "APPROVED" && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                                                <Check className="h-2.5 w-2.5" /> Approved
                                            </span>
                                        )}
                                        {r.status === "REJECTED" && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                                                <X className="h-2.5 w-2.5" /> Rejected
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3.5 text-right space-x-2">
                                        {r.status === "PENDING" ? (
                                            <>
                                                <button
                                                    onClick={() => handleOpenReview(r, "APPROVE")}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold transition-colors"
                                                >
                                                    <Check className="h-3.5 w-3.5" /> Approve
                                                </button>
                                                <button
                                                    onClick={() => handleOpenReview(r, "REJECT")}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-2.5 py-1 text-xs font-semibold transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" /> Reject
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-[11px] text-slate-500">
                                                By {r.reviewer_name || "Admin"}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Decision Confirmation Modal */}
            {activeRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                            <h3 className="text-base font-bold text-white">
                                {decisionType === "APPROVE" ? "Confirm Approval" : "Confirm Rejection"}
                            </h3>
                            <button onClick={() => setActiveRequest(null)} className="text-slate-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleConfirmDecision} className="space-y-4 text-xs">
                            <p className="text-slate-300">
                                {decisionType === "APPROVE" ? (
                                    <>
                                        Approving this request will immediately grant the role{" "}
                                        <strong className="text-emerald-400">{activeRequest.requested_role_name}</strong> to{" "}
                                        <strong className="text-white">{activeRequest.requester_name}</strong> in PostgreSQL.
                                    </>
                                ) : (
                                    <>
                                        Are you sure you want to reject the privilege escalation request submitted by{" "}
                                        <strong className="text-white">{activeRequest.requester_name}</strong>?
                                    </>
                                )}
                            </p>
                            <div>
                                <label className="block text-slate-400 mb-1">Administrative Note / Justification</label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="Add any formal review comments for audit logging..."
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setActiveRequest(null)}
                                    className="px-3 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`px-4 py-2 rounded-lg text-white font-semibold transition-colors ${
                                        decisionType === "APPROVE"
                                            ? "bg-emerald-600 hover:bg-emerald-500"
                                            : "bg-rose-600 hover:bg-rose-500"
                                    }`}
                                >
                                    {submitting ? "Executing..." : decisionType === "APPROVE" ? "Confirm & Provision" : "Confirm Rejection"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
