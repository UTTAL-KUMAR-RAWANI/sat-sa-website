"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    assessmentsApi,
    AssessmentSummary,
    AssessmentStats,
    AssessmentType,
    AssessmentPriority,
    AssessmentStatus,
} from "@/lib/api/assessments";
import { fetchAdminOrganizations, fetchAdminSectors, OrganizationItem, SectorItem } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission, hasAnyPermission } from "@/lib/rbac/permissions";
import {
    ClipboardCheck,
    Search,
    Plus,
    Building2,
    User as UserIcon,
    ChevronRight,
    RefreshCw,
    AlertCircle,
    Clock,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Filter,
    Layers,
    FileCheck,
    AlertTriangle,
} from "lucide-react";

export default function AssessmentsListPage() {
    const { user } = useAuth();
    const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
    const [stats, setStats] = useState<AssessmentStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");

    // Create Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
    const [sectors, setSectors] = useState<SectorItem[]>([]);
    const [createTitle, setCreateTitle] = useState("");
    const [createDesc, setCreateDesc] = useState("");
    const [createType, setCreateType] = useState<AssessmentType>("SECURITY_CONTROL_ASSESSMENT");
    const [createPriority, setCreatePriority] = useState<AssessmentPriority>("MEDIUM");
    const [createOrgId, setCreateOrgId] = useState("");
    const [createSectorId, setCreateSectorId] = useState("");
    const [createDueDate, setCreateDueDate] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const canCreate = hasPermission(user, Permissions.ASSESSMENT_CREATE);
    const canReview = hasAnyPermission(user, [
        Permissions.ASSESSMENT_REVIEW,
        Permissions.ASSESSMENT_APPROVE,
    ]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await assessmentsApi.getAll({
                search: search || undefined,
                status: statusFilter || undefined,
                assessment_type: typeFilter || undefined,
            });
            setAssessments(data);
        } catch (err: any) {
            setError(err.message || "Failed to load assessments registry");
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        setStatsLoading(true);
        try {
            const s = await assessmentsApi.getStats();
            setStats(s);
        } catch (err) {
            console.error("Failed to load assessment statistics", err);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [statusFilter, typeFilter]);

    useEffect(() => {
        loadStats();
    }, []);

    // Load orgs & sectors for create modal
    const handleOpenCreateModal = async () => {
        setShowCreateModal(true);
        setCreateError(null);
        try {
            const [orgs, secs] = await Promise.all([
                fetchAdminOrganizations().catch(() => []),
                fetchAdminSectors().catch(() => []),
            ]);
            setOrganizations(orgs);
            setSectors(secs);
            if (orgs.length > 0 && !createOrgId) {
                setCreateOrgId(orgs[0].id);
            }
        } catch (err) {
            console.error("Failed to load organizations/sectors", err);
        }
    };

    const handleCreateAssessment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createTitle.trim()) {
            setCreateError("Assessment title is required.");
            return;
        }

        setCreating(true);
        setCreateError(null);
        try {
            await assessmentsApi.create({
                title: createTitle.trim(),
                description: createDesc.trim() || undefined,
                assessment_type: createType,
                priority: createPriority,
                organization_id: createOrgId || undefined,
                sector_id: createSectorId || undefined,
                due_date: createDueDate ? new Date(createDueDate).toISOString() : undefined,
            });

            setShowCreateModal(false);
            setCreateTitle("");
            setCreateDesc("");
            setCreateDueDate("");
            loadData();
            loadStats();
        } catch (err: any) {
            setCreateError(err.message || "Failed to create assessment");
        } finally {
            setCreating(false);
        }
    };

    const getStatusBadgeClass = (status: AssessmentStatus) => {
        switch (status) {
            case "DRAFT":
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
            case "ASSIGNED":
                return "bg-slate-900/60 text-slate-300 border-slate-700";
            case "IN_PROGRESS":
                return "bg-blue-950/60 text-blue-400 border-blue-800";
            case "EVIDENCE_REQUIRED":
                return "bg-amber-950/60 text-amber-400 border-amber-800";
            case "SUBMITTED":
                return "bg-cyan-950/60 text-cyan-400 border-cyan-800";
            case "UNDER_REVIEW":
                return "bg-purple-950/60 text-purple-400 border-purple-800";
            case "CHANGES_REQUESTED":
                return "bg-rose-950/60 text-rose-400 border-rose-800";
            case "RESUBMITTED":
                return "bg-orange-950/60 text-orange-400 border-orange-800";
            case "APPROVED":
                return "bg-emerald-950/60 text-emerald-400 border-emerald-800";
            case "CLOSED":
                return "bg-zinc-900 text-zinc-500 border-zinc-800";
            default:
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
        }
    };

    const getPriorityBadgeClass = (priority: AssessmentPriority) => {
        switch (priority) {
            case "CRITICAL":
                return "bg-rose-950/80 text-rose-300 border-rose-800 font-semibold";
            case "HIGH":
                return "bg-amber-950/80 text-amber-300 border-amber-800";
            case "MEDIUM":
                return "bg-yellow-950/60 text-yellow-300 border-yellow-800";
            case "LOW":
                return "bg-slate-900/60 text-slate-400 border-slate-700";
            default:
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
        }
    };

    const formatType = (typeStr: string) => {
        return typeStr.replace(/_/g, " ");
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-5">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-800/60 text-blue-400 shadow-sm">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                Security Assessments & Audits
                            </h1>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                End-to-end supervisory control evaluation, evidence verification, and independent auditor sign-off
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {canReview && (
                        <Link
                            href="/assessments/review"
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/70 transition-all shadow-sm"
                        >
                            <FileCheck className="w-4 h-4 text-purple-400" />
                            <span>Auditor Review Queue</span>
                            {stats && (stats.submitted + stats.under_review + stats.resubmitted > 0) && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded-full">
                                    {stats.submitted + stats.under_review + stats.resubmitted}
                                </span>
                            )}
                        </Link>
                    )}

                    {canCreate && (
                        <button
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-blue-600/20 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Assessment</span>
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-xs font-medium">Total Registry</span>
                        <ClipboardCheck className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {statsLoading ? "..." : stats?.total ?? 0}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Across all organizations</p>
                </div>

                <div className="bg-zinc-900/70 border border-blue-900/40 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-blue-400 mb-1">
                        <span className="text-xs font-medium">In Progress</span>
                        <Clock className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-400">
                        {statsLoading ? "..." : (stats?.in_progress ?? 0) + (stats?.assigned ?? 0) + (stats?.evidence_required ?? 0)}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Active assessor evaluations</p>
                </div>

                <div className="bg-zinc-900/70 border border-purple-900/40 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-purple-400 mb-1">
                        <span className="text-xs font-medium">Under Review</span>
                        <FileCheck className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400">
                        {statsLoading ? "..." : (stats?.submitted ?? 0) + (stats?.under_review ?? 0) + (stats?.resubmitted ?? 0)}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Awaiting auditor decision</p>
                </div>

                <div className="bg-zinc-900/70 border border-emerald-900/40 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-emerald-400 mb-1">
                        <span className="text-xs font-medium">Approved / Closed</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                        {statsLoading ? "..." : (stats?.approved ?? 0) + (stats?.closed ?? 0)}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Audit verified & closed</p>
                </div>

                <div className="bg-zinc-900/70 border border-rose-900/40 rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between text-rose-400 mb-1">
                        <span className="text-xs font-medium">SLA Overdue</span>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-2xl font-bold text-rose-400">
                        {statsLoading ? "..." : stats?.overdue ?? 0}
                    </div>
                    <p className="text-[11px] text-rose-400/80 mt-1">Past targeted completion</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
                <div className="flex flex-1 items-center gap-3 w-full">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && loadData()}
                            placeholder="Search by code, title, org, or assessor..."
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 focus:border-blue-600 focus:outline-none text-zinc-100 placeholder-zinc-500"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-zinc-500" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-zinc-300 focus:border-blue-600 focus:outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="DRAFT">Draft</option>
                            <option value="ASSIGNED">Assigned</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="EVIDENCE_REQUIRED">Evidence Required</option>
                            <option value="SUBMITTED">Submitted</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="CHANGES_REQUESTED">Changes Requested</option>
                            <option value="RESUBMITTED">Resubmitted</option>
                            <option value="APPROVED">Approved</option>
                            <option value="CLOSED">Closed</option>
                        </select>

                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-zinc-300 focus:border-blue-600 focus:outline-none"
                        >
                            <option value="">All Types</option>
                            <option value="SECURITY_CONTROL_ASSESSMENT">Security Control Assessment</option>
                            <option value="THEMATIC_AUDIT">Thematic Audit</option>
                            <option value="SUPERVISORY_ASSESSMENT">Supervisory Assessment</option>
                            <option value="INCIDENT_POST_MORTEM">Incident Post Mortem</option>
                            <option value="NEGATIVE_SPACE_ASSESSMENT">Negative Space Assessment</option>
                            <option value="READINESS_ASSESSMENT">Readiness Assessment</option>
                            <option value="SPECIAL_INSPECTION">Special Inspection</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setSearch("");
                            setStatusFilter("");
                            setTypeFilter("");
                            loadData();
                        }}
                        className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                    >
                        Reset
                    </button>
                    <button
                        onClick={() => {
                            loadData();
                            loadStats();
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-900 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Assessments Table */}
            <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                        <thead className="bg-zinc-950/80 text-zinc-400 font-medium uppercase text-[10px] tracking-wider border-b border-zinc-800">
                            <tr>
                                <th className="py-3 px-4">Assessment</th>
                                <th className="py-3 px-4">Type & Priority</th>
                                <th className="py-3 px-4">Scope & Entity</th>
                                <th className="py-3 px-4">Assessor & Reviewer</th>
                                <th className="py-3 px-4">Controls Evaluated</th>
                                <th className="py-3 px-4">Status & SLA</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                                            <span>Loading security assessments...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : assessments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <ClipboardCheck className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                                            <span className="font-medium text-zinc-400">No assessments found</span>
                                            <span className="text-[11px] text-zinc-500">
                                                Adjust your filters or initiate a new assessment
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                assessments.map((asm) => {
                                    const progressPercent =
                                        asm.controls_count > 0
                                            ? Math.round((asm.evaluated_controls_count / asm.controls_count) * 100)
                                            : 0;

                                    return (
                                        <tr
                                            key={asm.id}
                                            className="hover:bg-zinc-850/50 transition-colors group"
                                        >
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                                                    <Link href={`/assessments/${asm.id}`}>
                                                        {asm.title}
                                                    </Link>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                                                    <span className="font-mono text-zinc-400">{asm.business_id}</span>
                                                    {asm.cse_business_id && (
                                                        <span className="text-[10px] bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-400">
                                                            CSE: {asm.cse_business_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className="text-[11px] font-medium text-zinc-300">
                                                        {formatType(asm.assessment_type)}
                                                    </span>
                                                    <span
                                                        className={`text-[10px] px-2 py-0.5 rounded border uppercase ${getPriorityBadgeClass(
                                                            asm.priority
                                                        )}`}
                                                    >
                                                        {asm.priority}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                                                        <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                                        <span>{asm.organization_name || "Enterprise Wide"}</span>
                                                    </div>
                                                    {asm.sector_name && (
                                                        <span className="text-[11px] text-zinc-500 pl-5">
                                                            {asm.sector_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 text-zinc-300">
                                                        <UserIcon className="w-3 h-3 text-zinc-500" />
                                                        <span>{asm.assessor_name || "Unassigned"}</span>
                                                    </div>
                                                    {asm.reviewer_name && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-purple-400">
                                                            <FileCheck className="w-3 h-3 text-purple-500" />
                                                            <span>Reviewer: {asm.reviewer_name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 min-w-[140px]">
                                                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                                                    <span>
                                                        {asm.evaluated_controls_count} / {asm.controls_count}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-zinc-500">
                                                        {progressPercent}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-300 ${
                                                            progressPercent === 100
                                                                ? "bg-emerald-500"
                                                                : progressPercent > 50
                                                                ? "bg-blue-500"
                                                                : "bg-amber-500"
                                                        }`}
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                                {asm.findings_count > 0 && (
                                                    <div className="flex items-center gap-1 text-[10px] text-amber-400 mt-1">
                                                        <ShieldAlert className="w-3 h-3" />
                                                        <span>{asm.findings_count} linked findings</span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span
                                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border tracking-wide uppercase ${getStatusBadgeClass(
                                                            asm.status
                                                        )}`}
                                                    >
                                                        {asm.status.replace(/_/g, " ")}
                                                    </span>

                                                    {asm.is_overdue ? (
                                                        <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            <span>OVERDUE</span>
                                                        </span>
                                                    ) : asm.due_date ? (
                                                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-zinc-600" />
                                                            <span>Due {new Date(asm.due_date).toLocaleDateString()}</span>
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 text-right">
                                                <Link
                                                    href={`/assessments/${asm.id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                                                >
                                                    <span>Inspect</span>
                                                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Assessment Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-blue-500" />
                                <span>Create Security Assessment</span>
                            </h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-zinc-500 hover:text-white text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {createError && (
                            <div className="p-2.5 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                                {createError}
                            </div>
                        )}

                        <form onSubmit={handleCreateAssessment} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Assessment Title *
                                </label>
                                <input
                                    type="text"
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    placeholder="e.g. Core Banking Perimeter Security Assessment"
                                    required
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-blue-600 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Assessment Type
                                    </label>
                                    <select
                                        value={createType}
                                        onChange={(e) => setCreateType(e.target.value as AssessmentType)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="SECURITY_CONTROL_ASSESSMENT">Security Control Assessment</option>
                                        <option value="THEMATIC_AUDIT">Thematic Audit</option>
                                        <option value="SUPERVISORY_ASSESSMENT">Supervisory Assessment</option>
                                        <option value="INCIDENT_POST_MORTEM">Incident Post Mortem</option>
                                        <option value="NEGATIVE_SPACE_ASSESSMENT">Negative Space Assessment</option>
                                        <option value="READINESS_ASSESSMENT">Readiness Assessment</option>
                                        <option value="SPECIAL_INSPECTION">Special Inspection</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Priority
                                    </label>
                                    <select
                                        value={createPriority}
                                        onChange={(e) => setCreatePriority(e.target.value as AssessmentPriority)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Target Organization
                                    </label>
                                    <select
                                        value={createOrgId}
                                        onChange={(e) => setCreateOrgId(e.target.value)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="">Enterprise Wide / Unassigned</option>
                                        {organizations.map((org) => (
                                            <option key={org.id} value={org.id}>
                                                {org.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Sector (Optional)
                                    </label>
                                    <select
                                        value={createSectorId}
                                        onChange={(e) => setCreateSectorId(e.target.value)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="">No Sector Filter</option>
                                        {sectors.map((sec) => (
                                            <option key={sec.id} value={sec.id}>
                                                {sec.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Target Due Date (SLA)
                                </label>
                                <input
                                    type="date"
                                    value={createDueDate}
                                    onChange={(e) => setCreateDueDate(e.target.value)}
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 focus:border-blue-600 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Description & Scope Notes
                                </label>
                                <textarea
                                    value={createDesc}
                                    onChange={(e) => setCreateDesc(e.target.value)}
                                    rows={3}
                                    placeholder="Outline the evaluation scope, standards (e.g. NIST CSF / ISO 27001), and objectives..."
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-blue-600 focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {creating ? "Initiating..." : "Create Assessment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
