"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    remediationsApi,
    Remediation,
    RemediationStats,
    RemediationPriority,
    RemediationStatus,
    RemediationSource,
} from "@/lib/api/remediations";
import { fetchAdminOrganizations, OrganizationItem } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    Wrench,
    Search,
    Plus,
    Building2,
    User as UserIcon,
    ChevronRight,
    RefreshCw,
    AlertCircle,
    Clock,
    CheckCircle2,
    XCircle,
    Filter,
    ShieldAlert,
    FileCheck,
    AlertTriangle,
    Layers,
    ArrowUpRight,
    Ban,
    FileText,
    Users,
} from "lucide-react";

function RemediationsListPageContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [remediations, setRemediations] = useState<Remediation[]>([]);
    const [stats, setStats] = useState<RemediationStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [sourceFilter, setSourceFilter] = useState("ALL");

    // Create Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
    const [createTitle, setCreateTitle] = useState("");
    const [createDesc, setCreateDesc] = useState("");
    const [createPriority, setCreatePriority] = useState<RemediationPriority>("HIGH");
    const [createSource, setCreateSource] = useState<RemediationSource>("FINDING");
    const [createFindingId, setCreateFindingId] = useState("");
    const [createRiskId, setCreateRiskId] = useState("");
    const [createRiskTreatmentId, setCreateRiskTreatmentId] = useState("");
    const [createControlId, setCreateControlId] = useState("");
    const [createCorrectiveAction, setCreateCorrectiveAction] = useState("");
    const [createRootCause, setCreateRootCause] = useState("");
    const [createImplementationSteps, setCreateImplementationSteps] = useState("");
    const [createExpectedOutcome, setCreateExpectedOutcome] = useState("");
    const [createCompletionCriteria, setCreateCompletionCriteria] = useState("");
    const [createDependencies, setCreateDependencies] = useState("");
    const [createRequiredEvidenceTypes, setCreateRequiredEvidenceTypes] = useState("SCAN_REPORT, CONFIGURATION");
    const [createAssignedTeam, setCreateAssignedTeam] = useState("IT Infrastructure Team");
    const [createTargetDate, setCreateTargetDate] = useState("");
    const [createOrgId, setCreateOrgId] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const canCreate = hasPermission(user, Permissions.REMEDIATION_CREATE);

    const loadRemediations = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await remediationsApi.list({
                search: search || undefined,
                status: statusFilter !== "ALL" ? statusFilter : undefined,
                priority: priorityFilter !== "ALL" ? priorityFilter : undefined,
                source: sourceFilter !== "ALL" ? sourceFilter : undefined,
            });
            setRemediations(data);
        } catch (err: any) {
            setError(err.message || "Failed to load remediation tracking ledger");
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        setStatsLoading(true);
        try {
            const s = await remediationsApi.getStats();
            setStats(s);
        } catch (err) {
            console.error("Failed to load remediation statistics", err);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        loadRemediations();
    }, [statusFilter, priorityFilter, sourceFilter]);

    useEffect(() => {
        loadStats();
    }, []);

    // Check query params for automated pre-fill (e.g. from Findings or Risk treatment action)
    useEffect(() => {
        const shouldCreate = searchParams.get("create");
        const findingId = searchParams.get("finding_id");
        const findingBId = searchParams.get("finding_business_id");
        const riskId = searchParams.get("risk_id");
        const riskBId = searchParams.get("risk_business_id");
        const treatmentId = searchParams.get("risk_treatment_id");
        const title = searchParams.get("title");
        const priority = searchParams.get("priority");

        if (shouldCreate === "true" || findingId || riskId) {
            setShowCreateModal(true);
            if (findingId) {
                setCreateFindingId(findingId);
                setCreateSource("FINDING");
            }
            if (riskId) {
                setCreateRiskId(riskId);
                setCreateSource("RISK");
            }
            if (treatmentId) {
                setCreateRiskTreatmentId(treatmentId);
            }
            if (title) {
                setCreateTitle(
                    findingBId
                        ? `Remediate ${findingBId}: ${title}`
                        : riskBId
                        ? `Treatment Plan for ${riskBId}: ${title}`
                        : title
                );
            }
            if (priority && ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priority)) {
                setCreatePriority(priority as RemediationPriority);
            }
        }
    }, [searchParams]);

    // Load organizations for org dropdown in modal
    useEffect(() => {
        if (showCreateModal && organizations.length === 0) {
            fetchAdminOrganizations().then(setOrganizations).catch(console.error);
        }
    }, [showCreateModal]);

    const handleCreateRemediation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createTitle.trim()) {
            setCreateError("Remediation Title is required.");
            return;
        }

        setCreating(true);
        setCreateError(null);
        try {
            await remediationsApi.create({
                title: createTitle,
                description: createDesc || undefined,
                priority: createPriority,
                source: createSource,
                finding_id: createFindingId || undefined,
                risk_id: createRiskId || undefined,
                risk_treatment_id: createRiskTreatmentId || undefined,
                control_id: createControlId || undefined,
                corrective_action: createCorrectiveAction || undefined,
                root_cause: createRootCause || undefined,
                implementation_steps: createImplementationSteps || undefined,
                expected_outcome: createExpectedOutcome || undefined,
                completion_criteria: createCompletionCriteria || undefined,
                dependencies: createDependencies || undefined,
                required_evidence_types: createRequiredEvidenceTypes || undefined,
                assigned_team: createAssignedTeam || undefined,
                organization_id: createOrgId || undefined,
                target_date: createTargetDate ? new Date(createTargetDate).toISOString() : undefined,
            });

            setShowCreateModal(false);
            resetCreateForm();
            loadRemediations();
            loadStats();
        } catch (err: any) {
            setCreateError(err.message || "Failed to create remediation plan");
        } finally {
            setCreating(false);
        }
    };

    const resetCreateForm = () => {
        setCreateTitle("");
        setCreateDesc("");
        setCreatePriority("HIGH");
        setCreateSource("FINDING");
        setCreateFindingId("");
        setCreateRiskId("");
        setCreateRiskTreatmentId("");
        setCreateControlId("");
        setCreateCorrectiveAction("");
        setCreateRootCause("");
        setCreateImplementationSteps("");
        setCreateExpectedOutcome("");
        setCreateCompletionCriteria("");
        setCreateDependencies("");
        setCreateRequiredEvidenceTypes("SCAN_REPORT, CONFIGURATION");
        setCreateAssignedTeam("IT Infrastructure Team");
        setCreateTargetDate("");
        setCreateOrgId("");
        setCreateError(null);
    };

    const getPriorityBadge = (p: RemediationPriority) => {
        switch (p) {
            case "CRITICAL":
                return "bg-rose-500/10 text-rose-400 border border-rose-500/30";
            case "HIGH":
                return "bg-amber-500/10 text-amber-400 border border-amber-500/30";
            case "MEDIUM":
                return "bg-blue-500/10 text-blue-400 border border-blue-500/30";
            case "LOW":
                return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
            default:
                return "bg-slate-800 text-slate-300 border border-slate-700";
        }
    };

    const getStatusBadge = (s: RemediationStatus) => {
        switch (s) {
            case "OPEN":
                return {
                    class: "bg-slate-800 text-slate-300 border border-slate-700",
                    label: "OPEN",
                    dot: "bg-slate-400",
                };
            case "ASSIGNED":
                return {
                    class: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30",
                    label: "ASSIGNED",
                    dot: "bg-cyan-400",
                };
            case "IN_PROGRESS":
                return {
                    class: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30",
                    label: "IN PROGRESS",
                    dot: "bg-indigo-400 animate-pulse",
                };
            case "BLOCKED":
                return {
                    class: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
                    label: "BLOCKED",
                    dot: "bg-rose-400 animate-ping",
                };
            case "EVIDENCE_SUBMITTED":
                return {
                    class: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
                    label: "EVIDENCE SUBMITTED",
                    dot: "bg-blue-400",
                };
            case "VALIDATION":
                return {
                    class: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
                    label: "UNDER VALIDATION",
                    dot: "bg-purple-400 animate-pulse",
                };
            case "VERIFIED":
                return {
                    class: "bg-teal-500/10 text-teal-400 border border-teal-500/30",
                    label: "VERIFIED",
                    dot: "bg-teal-400",
                };
            case "CLOSED":
                return {
                    class: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
                    label: "CLOSED",
                    dot: "bg-emerald-400",
                };
            default:
                return {
                    class: "bg-slate-800 text-slate-400 border border-slate-700",
                    label: s,
                    dot: "bg-slate-400",
                };
        }
    };

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 p-6 lg:p-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-cyan-400 uppercase mb-1">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Security Remediation & Corrective Action Platform</span>
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        Remediation Lifecycle & Validation
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-3xl">
                        Authoritative tracking of corrective actions derived from supervisory findings and risk treatments. Enforces operational state machines, mandatory blocking rationales, evidence verification checklists, and strict independent Separation of Duties.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => {
                            loadRemediations();
                            loadStats();
                        }}
                        className="p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition text-slate-300"
                        title="Refresh remediations"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
                    </button>

                    {canCreate && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold px-4 py-2.5 rounded-lg shadow-lg shadow-cyan-500/20 transition duration-200 text-sm w-full md:w-auto"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Remediation</span>
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
                        <span>Total Items</span>
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="text-2xl font-bold text-white tracking-tight">
                        {statsLoading ? "-" : stats?.total_remediations ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Full Portfolio</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between text-xs text-indigo-400 font-medium mb-1">
                        <span>In Progress</span>
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-bold text-indigo-300 tracking-tight">
                        {statsLoading ? "-" : stats?.in_progress ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Active Engineering</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between text-xs text-rose-400 font-medium mb-1">
                        <span>Blocked</span>
                        <Ban className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <div className="text-2xl font-bold text-rose-400 tracking-tight">
                        {statsLoading ? "-" : stats?.blocked ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Requires Escalation</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between text-xs text-purple-400 font-medium mb-1">
                        <span>In Validation</span>
                        <FileCheck className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-300 tracking-tight">
                        {statsLoading
                            ? "-"
                            : (stats?.validation ?? 0) + (stats?.evidence_submitted ?? 0)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Pending SoD Review</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-medium mb-1">
                        <span>Verified / Closed</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                        {statsLoading
                            ? "-"
                            : (stats?.verified ?? 0) + (stats?.closed ?? 0)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Resolved Successfully</div>
                </div>

                <div className="bg-slate-900/60 border border-rose-900/40 bg-rose-950/10 rounded-xl p-4 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between text-xs text-rose-400 font-medium mb-1">
                        <span>Overdue SLA</span>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    </div>
                    <div className="text-2xl font-bold text-rose-300 tracking-tight">
                        {statsLoading ? "-" : stats?.overdue ?? 0}
                    </div>
                    <div className="text-[11px] text-rose-400/80 mt-1">Breached Target Date</div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 mb-6 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
                {/* Search Bar */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        loadRemediations();
                    }}
                    className="relative flex-1"
                >
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by ID (e.g. REM-2026-00001), Title, Corrective Action, or Owner..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition"
                    />
                </form>

                {/* Status Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                    {[
                        { id: "ALL", label: "All" },
                        { id: "OPEN", label: "Open" },
                        { id: "ASSIGNED", label: "Assigned" },
                        { id: "IN_PROGRESS", label: "In Progress" },
                        { id: "BLOCKED", label: "Blocked" },
                        { id: "VALIDATION", label: "Validation" },
                        { id: "VERIFIED", label: "Verified" },
                        { id: "CLOSED", label: "Closed" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                                statusFilter === tab.id
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Dropdowns */}
                <div className="flex items-center gap-2">
                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="bg-slate-950/60 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-cyan-500/60"
                    >
                        <option value="ALL">Priority: All</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>

                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="bg-slate-950/60 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-cyan-500/60"
                    >
                        <option value="ALL">Source: All</option>
                        <option value="FINDING">Finding</option>
                        <option value="RISK">Risk Treatment</option>
                        <option value="ASSESSMENT">Assessment</option>
                        <option value="MANUAL">Manual</option>
                    </select>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Remediations Table */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800/80 bg-slate-950/40 text-xs uppercase tracking-wider text-slate-400">
                                <th className="py-3.5 px-4 font-semibold">Remediation ID</th>
                                <th className="py-3.5 px-4 font-semibold">Title & Action Details</th>
                                <th className="py-3.5 px-4 font-semibold">Source Link</th>
                                <th className="py-3.5 px-4 font-semibold">Priority</th>
                                <th className="py-3.5 px-4 font-semibold">Status</th>
                                <th className="py-3.5 px-4 font-semibold">Owner & Team</th>
                                <th className="py-3.5 px-4 font-semibold">Target / SLA</th>
                                <th className="py-3.5 px-4 font-semibold text-center">Evidence</th>
                                <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                                        <span>Loading remediation ledger...</span>
                                    </td>
                                </tr>
                            ) : remediations.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <Wrench className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                                        <span className="font-medium text-slate-300">No remediation records found.</span>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Adjust filter criteria or create a new remediation item to begin execution.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                remediations.map((rem) => {
                                    const statusMeta = getStatusBadge(rem.status);
                                    return (
                                        <tr
                                            key={rem.id}
                                            className="hover:bg-slate-800/30 transition group cursor-pointer"
                                        >
                                            {/* ID */}
                                            <td className="py-4 px-4 font-mono text-xs font-semibold text-cyan-400 whitespace-nowrap">
                                                <Link
                                                    href={`/remediations/${rem.id}`}
                                                    className="hover:underline flex items-center gap-1.5"
                                                >
                                                    <span>{rem.business_id}</span>
                                                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-cyan-400" />
                                                </Link>
                                            </td>

                                            {/* Title & Description */}
                                            <td className="py-4 px-4 max-w-sm">
                                                <Link href={`/remediations/${rem.id}`}>
                                                    <div className="font-medium text-slate-100 hover:text-cyan-300 transition line-clamp-1">
                                                        {rem.title}
                                                    </div>
                                                    {rem.description && (
                                                        <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                                                            {rem.description}
                                                        </div>
                                                    )}
                                                    {rem.status === "BLOCKED" && rem.blocked_reason && (
                                                        <div className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 line-clamp-1">
                                                            <Ban className="w-3 h-3 shrink-0" />
                                                            <span>Reason: {rem.blocked_reason}</span>
                                                        </div>
                                                    )}
                                                </Link>
                                            </td>

                                            {/* Source Badge */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                {rem.finding_id ? (
                                                    <Link
                                                        href={`/findings/${rem.finding_id}`}
                                                        className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded hover:bg-blue-500/20 transition font-mono"
                                                    >
                                                        <span>{rem.finding_business_id || "Finding"}</span>
                                                    </Link>
                                                ) : rem.risk_id ? (
                                                    <Link
                                                        href={`/risks/${rem.risk_id}`}
                                                        className="inline-flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded hover:bg-purple-500/20 transition font-mono"
                                                    >
                                                        <span>{rem.risk_business_id || "Risk"}</span>
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs text-slate-500">{rem.source}</span>
                                                )}
                                            </td>

                                            {/* Priority */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${getPriorityBadge(
                                                        rem.priority
                                                    )}`}
                                                >
                                                    {rem.priority}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.class}`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                                                    <span>{statusMeta.label}</span>
                                                </div>
                                            </td>

                                            {/* Owner & Team */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-200">
                                                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{rem.owner_name || "Unassigned"}</span>
                                                </div>
                                                {rem.assigned_team && (
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <Users className="w-3 h-3 text-slate-500" />
                                                        <span>{rem.assigned_team}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Target / SLA */}
                                            <td className="py-4 px-4 whitespace-nowrap text-xs">
                                                {rem.target_date ? (
                                                    <div className="flex flex-col">
                                                        <span
                                                            className={`${
                                                                rem.is_overdue
                                                                    ? "text-rose-400 font-semibold"
                                                                    : "text-slate-300"
                                                            }`}
                                                        >
                                                            {new Date(rem.target_date).toLocaleDateString(undefined, {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                            })}
                                                        </span>
                                                        {rem.is_overdue && (
                                                            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-600 italic">No Target</span>
                                                )}
                                            </td>

                                            {/* Evidence Count */}
                                            <td className="py-4 px-4 whitespace-nowrap text-center">
                                                <span
                                                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono ${
                                                        rem.evidence_count > 0
                                                            ? "bg-slate-800 text-cyan-300 border border-cyan-500/30"
                                                            : "text-slate-600"
                                                    }`}
                                                >
                                                    <FileText className="w-3 h-3" />
                                                    <span>{rem.evidence_count}</span>
                                                </span>
                                            </td>

                                            {/* Action Link */}
                                            <td className="py-4 px-4 whitespace-nowrap text-right">
                                                <Link
                                                    href={`/remediations/${rem.id}`}
                                                    className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-800/40 transition"
                                                >
                                                    <span>Details</span>
                                                    <ChevronRight className="w-3 h-3" />
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

            {/* Create Remediation Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                    <Wrench className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Create Remediation Plan</h3>
                                    <p className="text-xs text-slate-400">
                                        Establish corrective actions, technical implementation plan, and evidence requirements.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-slate-400 hover:text-slate-200 text-sm font-semibold p-1"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRemediation} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            {createError && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-xs text-rose-400 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{createError}</span>
                                </div>
                            )}

                            {/* Title */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Remediation Title <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Implement Hardware Security Module for TLS Key Relocation"
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Operational Description
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Technical context and business impact summary..."
                                    value={createDesc}
                                    onChange={(e) => setCreateDesc(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                                />
                            </div>

                            {/* Priority, Source, Target Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Priority
                                    </label>
                                    <select
                                        value={createPriority}
                                        onChange={(e) => setCreatePriority(e.target.value as RemediationPriority)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500/60"
                                    >
                                        <option value="CRITICAL">Critical</option>
                                        <option value="HIGH">High</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="LOW">Low</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Source Type
                                    </label>
                                    <select
                                        value={createSource}
                                        onChange={(e) => setCreateSource(e.target.value as RemediationSource)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500/60"
                                    >
                                        <option value="FINDING">Finding</option>
                                        <option value="RISK">Risk Treatment</option>
                                        <option value="ASSESSMENT">Assessment</option>
                                        <option value="MANUAL">Manual Engineering</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Target Date (SLA)
                                    </label>
                                    <input
                                        type="date"
                                        value={createTargetDate}
                                        onChange={(e) => setCreateTargetDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500/60"
                                    />
                                </div>
                            </div>

                            {/* Assigned Team & Organization */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Assigned Implementation Team
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. IT Infrastructure Team, AppSec Mobile Squad"
                                        value={createAssignedTeam}
                                        onChange={(e) => setCreateAssignedTeam(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Target Organization
                                    </label>
                                    <select
                                        value={createOrgId}
                                        onChange={(e) => setCreateOrgId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500/60"
                                    >
                                        <option value="">User Organization (Default)</option>
                                        {organizations.map((org) => (
                                            <option key={org.id} value={org.id}>
                                                {org.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Corrective Action */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Corrective Action Overview
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Specific technical action being executed to rectify the underlying vulnerability or control gap..."
                                    value={createCorrectiveAction}
                                    onChange={(e) => setCreateCorrectiveAction(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                                />
                            </div>

                            {/* Root Cause & Implementation Steps */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Root Cause Analysis
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Why did this condition exist originally?"
                                        value={createRootCause}
                                        onChange={(e) => setCreateRootCause(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Implementation Steps
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Phase 1: ...&#10;Phase 2: ...&#10;Phase 3: ..."
                                        value={createImplementationSteps}
                                        onChange={(e) => setCreateImplementationSteps(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                                    />
                                </div>
                            </div>

                            {/* Required Evidence Types */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Required Evidence Types for Final Validation
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. SCAN_REPORT, CONFIGURATION, SYSTEM_LOG, CHANGE_RECORD"
                                    value={createRequiredEvidenceTypes}
                                    onChange={(e) => setCreateRequiredEvidenceTypes(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500/60"
                                />
                                <span className="text-[11px] text-slate-500 mt-1 block">
                                    Comma-delimited evidence requirements checked during independent validator sign-off.
                                </span>
                            </div>

                            {/* Form Actions */}
                            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-2 rounded-lg text-sm shadow-md shadow-cyan-500/20 transition duration-200 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    <span>{creating ? "Submitting..." : "Establish Remediation"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RemediationsPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
                    <span>Loading remediations platform...</span>
                </div>
            }
        >
            <RemediationsListPageContent />
        </Suspense>
    );
}
