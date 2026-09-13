"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    risksApi,
    RiskSummary,
    RiskStats,
    RiskCategory,
    RiskLevel,
    RiskStatus,
} from "@/lib/api/risks";
import { fetchAdminOrganizations, fetchAdminSectors, OrganizationItem, SectorItem } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth/AuthContext";
import { Permissions, hasPermission } from "@/lib/rbac/permissions";
import {
    ShieldAlert,
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
    Layers,
    FileCheck,
    AlertTriangle,
    Target,
    Activity,
    Sliders,
} from "lucide-react";

function RisksListPageContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [risks, setRisks] = useState<RiskSummary[]>([]);
    const [stats, setStats] = useState<RiskStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");

    // Create Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
    const [sectors, setSectors] = useState<SectorItem[]>([]);
    const [createTitle, setCreateTitle] = useState("");
    const [createDesc, setCreateDesc] = useState("");
    const [createCategory, setCreateCategory] = useState<RiskCategory>("Cybersecurity");
    const [createLikelihood, setCreateLikelihood] = useState<number>(3);
    const [createImpact, setCreateImpact] = useState<number>(3);
    const [createAsset, setCreateAsset] = useState("");
    const [createOrgId, setCreateOrgId] = useState("");
    const [createSectorId, setCreateSectorId] = useState("");
    const [createControlsDesc, setCreateControlsDesc] = useState("");
    const [createTargetDate, setCreateTargetDate] = useState("");
    const [createFindingId, setCreateFindingId] = useState("");
    const [createFindingBusinessId, setCreateFindingBusinessId] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const canCreate = hasPermission(user, Permissions.RISK_CREATE);
    const canViewExceptions = hasPermission(user, Permissions.RISK_EXCEPTION_READ);
    const canViewTreatments = hasPermission(user, Permissions.RISK_TREATMENT_READ);

    const loadRisks = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await risksApi.getAll({
                search: search || undefined,
                status: statusFilter || undefined,
                category: categoryFilter || undefined,
                level: levelFilter || undefined,
                source: sourceFilter || undefined,
            });
            setRisks(data);
        } catch (err: any) {
            setError(err.message || "Failed to load risk register");
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        setStatsLoading(true);
        try {
            const s = await risksApi.getStats();
            setStats(s);
        } catch (err) {
            console.error("Failed to load risk statistics", err);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        loadRisks();
    }, [statusFilter, categoryFilter, levelFilter, sourceFilter]);

    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        const shouldCreate = searchParams.get("create");
        const findingId = searchParams.get("finding_id");
        const findingBId = searchParams.get("finding_business_id");
        const title = searchParams.get("title");
        const orgId = searchParams.get("org_id");
        const sectorId = searchParams.get("sector_id");
        const asset = searchParams.get("asset");

        if (shouldCreate === "true" || findingId) {
            if (title) setCreateTitle(title);
            if (orgId) setCreateOrgId(orgId);
            if (sectorId) setCreateSectorId(sectorId);
            if (asset) setCreateAsset(asset);
            if (findingId) setCreateFindingId(findingId);
            if (findingBId) setCreateFindingBusinessId(findingBId);
            handleOpenCreateModal();
        }
    }, [searchParams]);

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
            console.error("Failed to load orgs", err);
        }
    };

    const handleCreateRisk = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createTitle.trim()) {
            setCreateError("Risk title is required.");
            return;
        }

        setCreating(true);
        setCreateError(null);
        try {
            await risksApi.create({
                title: createTitle.trim(),
                description: createDesc.trim() || undefined,
                category: createCategory,
                likelihood: Number(createLikelihood),
                impact: Number(createImpact),
                asset_or_system: createAsset.trim() || undefined,
                organization_id: createOrgId || undefined,
                sector_id: createSectorId || undefined,
                existing_controls_description: createControlsDesc.trim() || undefined,
                target_date: createTargetDate ? new Date(createTargetDate).toISOString() : undefined,
                finding_id: createFindingId || undefined,
                source: createFindingId ? "Finding" : "Manual",
                source_reference: createFindingBusinessId || undefined,
            });

            setShowCreateModal(false);
            setCreateTitle("");
            setCreateDesc("");
            setCreateAsset("");
            setCreateControlsDesc("");
            setCreateTargetDate("");
            setCreateFindingId("");
            setCreateFindingBusinessId("");
            loadRisks();
            loadStats();
        } catch (err: any) {
            setCreateError(err.message || "Failed to create risk record");
        } finally {
            setCreating(false);
        }
    };

    const getLevelBadgeClass = (level: RiskLevel) => {
        switch (level) {
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

    const getStatusBadgeClass = (status: RiskStatus) => {
        switch (status) {
            case "IDENTIFIED":
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
            case "ASSESSED":
                return "bg-blue-950/60 text-blue-400 border-blue-800";
            case "TREATMENT_REQUIRED":
                return "bg-rose-950/60 text-rose-400 border-rose-800";
            case "TREATMENT_PLANNED":
                return "bg-amber-950/60 text-amber-400 border-amber-800";
            case "MONITORED":
                return "bg-cyan-950/60 text-cyan-400 border-cyan-800";
            case "ACCEPTED":
                return "bg-purple-950/60 text-purple-400 border-purple-800";
            case "CLOSED":
                return "bg-zinc-900 text-zinc-500 border-zinc-800";
            default:
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
        }
    };

    // Calculate preview score for create modal
    const previewScore = createLikelihood * createImpact;
    const previewLevel =
        previewScore >= 17 ? "CRITICAL" : previewScore >= 10 ? "HIGH" : previewScore >= 5 ? "MEDIUM" : "LOW";

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-400 shadow-sm">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                            Enterprise Risk Register & GRC
                        </h1>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Authoritative 5×5 risk assessment, inherent vs residual modeling, treatment strategies, and exception governance
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {canViewTreatments && (
                        <Link
                            href="/risk-treatments"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
                        >
                            <Sliders className="w-4 h-4 text-blue-400" />
                            <span>Treatments</span>
                            {stats && stats.treatment_required > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-rose-600 text-white rounded-full">
                                    {stats.treatment_required}
                                </span>
                            )}
                        </Link>
                    )}

                    {canViewExceptions && (
                        <Link
                            href="/risk-exceptions"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
                        >
                            <FileCheck className="w-4 h-4 text-purple-400" />
                            <span>Exceptions</span>
                            {stats && stats.open_exceptions > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-purple-600 text-white rounded-full">
                                    {stats.open_exceptions}
                                </span>
                            )}
                        </Link>
                    )}

                    {canCreate && (
                        <button
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-md hover:shadow-rose-600/20 transition"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Risk</span>
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-xs font-medium">Total Risks</span>
                        <ShieldAlert className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {statsLoading ? "..." : stats?.total_risks ?? 0}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Active registered exposures</p>
                </div>

                <div className="bg-zinc-900/70 border border-rose-900/40 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-rose-400 mb-1">
                        <span className="text-xs font-medium">Critical & High</span>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-2xl font-bold text-rose-400">
                        {statsLoading ? "..." : (stats?.critical ?? 0) + (stats?.high ?? 0)}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                        {stats?.critical ?? 0} Critical, {stats?.high ?? 0} High
                    </p>
                </div>

                <div className="bg-zinc-900/70 border border-amber-900/40 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-amber-400 mb-1">
                        <span className="text-xs font-medium">Treatment Required</span>
                        <Target className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-400">
                        {statsLoading ? "..." : stats?.treatment_required ?? 0}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Mitigation actions needed</p>
                </div>

                <div className="bg-zinc-900/70 border border-purple-900/40 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-purple-400 mb-1">
                        <span className="text-xs font-medium">Formally Accepted</span>
                        <CheckCircle2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400">
                        {statsLoading ? "..." : stats?.accepted ?? 0}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Authorized with review date</p>
                </div>

                <div className="bg-zinc-900/70 border border-rose-900/40 rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between text-rose-400 mb-1">
                        <span className="text-xs font-medium">SLA Overdue</span>
                        <Clock className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-2xl font-bold text-rose-400">
                        {statsLoading ? "..." : stats?.overdue ?? 0}
                    </div>
                    <p className="text-[11px] text-rose-400/80 mt-1">Past targeted treatment</p>
                </div>
            </div>

            {/* Interactive 5x5 Risk Heatmap Matrix */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-rose-500" />
                            <span>Enterprise 5×5 Inherent Risk Heatmap Matrix</span>
                        </h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            Authoritative $Likelihood \times Impact$ distribution across all scoped entities
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600/60 border border-emerald-500" />
                            <span className="text-zinc-400">Low (1-4)</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-600/60 border border-yellow-500" />
                            <span className="text-zinc-400">Medium (5-9)</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-amber-600/70 border border-amber-500" />
                            <span className="text-zinc-400">High (10-16)</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-rose-600/80 border border-rose-500" />
                            <span className="text-zinc-400">Critical (17-25)</span>
                        </span>
                    </div>
                </div>

                {/* 5x5 Grid Table */}
                <div className="overflow-x-auto pt-2">
                    <div className="min-w-[500px]">
                        <div className="grid grid-cols-6 gap-1.5 text-center text-xs">
                            {/* Header row: Impact 1-5 */}
                            <div className="font-semibold text-zinc-500 text-[11px] p-2 flex items-center justify-center">
                                L \ I
                            </div>
                            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                1 - Insignificant
                            </div>
                            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                2 - Minor
                            </div>
                            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                3 - Moderate
                            </div>
                            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                4 - Major
                            </div>
                            <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px]">
                                5 - Severe
                            </div>

                            {/* Matrix Rows: Likelihood from 5 down to 1 */}
                            {[5, 4, 3, 2, 1].map((l) => {
                                const lLabel =
                                    l === 5 ? "5 - Almost Certain" : l === 4 ? "4 - Likely" : l === 3 ? "3 - Possible" : l === 2 ? "2 - Unlikely" : "1 - Rare";

                                return (
                                    <React.Fragment key={l}>
                                        <div className="p-2 bg-zinc-950 border border-zinc-800 rounded font-semibold text-zinc-400 text-[11px] flex items-center justify-center text-left">
                                            {lLabel}
                                        </div>
                                        {[1, 2, 3, 4, 5].map((i) => {
                                            const score = l * i;
                                            const cellCount = stats?.matrix_distribution[`${l},${i}`] || 0;
                                            const levelClass =
                                                score >= 17
                                                    ? "bg-rose-950/60 border-rose-800/80 text-rose-300"
                                                    : score >= 10
                                                    ? "bg-amber-950/60 border-amber-800/80 text-amber-300"
                                                    : score >= 5
                                                    ? "bg-yellow-950/50 border-yellow-800/70 text-yellow-300"
                                                    : "bg-emerald-950/40 border-emerald-800/60 text-emerald-300";

                                            return (
                                                <div
                                                    key={`${l}-${i}`}
                                                    className={`p-2.5 rounded-lg border flex flex-col items-center justify-center transition ${levelClass} ${
                                                        cellCount > 0 ? "font-bold ring-1 ring-white/10" : "opacity-60"
                                                    }`}
                                                >
                                                    <span className="text-[10px] text-zinc-400 font-mono">
                                                        {score}
                                                    </span>
                                                    <span className="text-sm font-extrabold mt-0.5">
                                                        {cellCount}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
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
                            onKeyDown={(e) => e.key === "Enter" && loadRisks()}
                            placeholder="Search by ID, title, asset, or source..."
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 focus:border-rose-600 focus:outline-none text-zinc-100 placeholder-zinc-500"
                        />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-3.5 h-3.5 text-zinc-500" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-zinc-300 focus:border-rose-600 focus:outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="IDENTIFIED">Identified</option>
                            <option value="ASSESSED">Assessed</option>
                            <option value="TREATMENT_REQUIRED">Treatment Required</option>
                            <option value="TREATMENT_PLANNED">Treatment Planned</option>
                            <option value="MONITORED">Monitored</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="CLOSED">Closed</option>
                        </select>

                        <select
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            className="text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-zinc-300 focus:border-rose-600 focus:outline-none"
                        >
                            <option value="">All Levels</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>

                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-zinc-300 focus:border-rose-600 focus:outline-none"
                        >
                            <option value="">All Categories</option>
                            <option value="Cybersecurity">Cybersecurity</option>
                            <option value="Operational">Operational</option>
                            <option value="Compliance">Compliance</option>
                            <option value="Technology">Technology</option>
                            <option value="Data Security">Data Security</option>
                            <option value="Access Control">Access Control</option>
                            <option value="Infrastructure">Infrastructure</option>
                            <option value="Third Party">Third Party</option>
                            <option value="Business Continuity">Business Continuity</option>
                            <option value="Privacy">Privacy</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setSearch("");
                            setStatusFilter("");
                            setLevelFilter("");
                            setCategoryFilter("");
                            setSourceFilter("");
                            loadRisks();
                        }}
                        className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                    >
                        Reset
                    </button>
                    <button
                        onClick={() => {
                            loadRisks();
                            loadStats();
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-400" : ""}`} />
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

            {/* Risks Table */}
            <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-300">
                        <thead className="bg-zinc-950/80 text-zinc-400 font-medium uppercase text-[10px] tracking-wider border-b border-zinc-800">
                            <tr>
                                <th className="py-3 px-4">Risk Identifier & Title</th>
                                <th className="py-3 px-4">Category & Source</th>
                                <th className="py-3 px-4">Inherent Score</th>
                                <th className="py-3 px-4">Residual Score</th>
                                <th className="py-3 px-4">Treatment Strategy</th>
                                <th className="py-3 px-4">Owner & Entity</th>
                                <th className="py-3 px-4">Status & SLA</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
                                            <span>Loading enterprise risk register...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : risks.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <ShieldAlert className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                                            <span className="font-medium text-zinc-400">No risk records found</span>
                                            <span className="text-[11px] text-zinc-500">
                                                Adjust your filters or register a new risk exposure
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                risks.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="hover:bg-zinc-850/50 transition-colors group"
                                    >
                                        <td className="py-3 px-4">
                                            <div className="font-semibold text-white group-hover:text-rose-400 transition-colors">
                                                <Link href={`/risks/${r.id}`}>
                                                    {r.title}
                                                </Link>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                                                <span className="font-mono text-zinc-400">{r.business_id}</span>
                                                {r.asset_or_system && (
                                                    <span className="text-[10px] text-zinc-400 truncate max-w-[180px]">
                                                        • {r.asset_or_system}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="py-3 px-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="text-[11px] font-medium text-zinc-200">
                                                    {r.category}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 font-mono">
                                                        {r.source}
                                                    </span>
                                                    {r.source_reference && (
                                                        <span>{r.source_reference}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Inherent Score */}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 rounded border uppercase ${getLevelBadgeClass(
                                                        r.inherent_risk_level
                                                    )}`}
                                                >
                                                    {r.inherent_risk_level}
                                                </span>
                                                <span className="font-mono text-xs font-bold text-white">
                                                    {r.inherent_score}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">
                                                    ({r.likelihood}×{r.impact})
                                                </span>
                                            </div>
                                        </td>

                                        {/* Residual Score */}
                                        <td className="py-3 px-4">
                                            {r.residual_score ? (
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`text-[10px] px-2 py-0.5 rounded border uppercase ${getLevelBadgeClass(
                                                            r.residual_risk_level || "LOW"
                                                        )}`}
                                                    >
                                                        {r.residual_risk_level}
                                                    </span>
                                                    <span className="font-mono text-xs font-bold text-white">
                                                        {r.residual_score}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500">
                                                        ({r.residual_likelihood}×{r.residual_impact})
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-600 italic text-[11px]">
                                                    Not assessed
                                                </span>
                                            )}
                                        </td>

                                        {/* Treatment Strategy */}
                                        <td className="py-3 px-4">
                                            {r.treatment_strategy ? (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase tracking-wide">
                                                    {r.treatment_strategy}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-600 italic text-[11px]">
                                                    Pending decision
                                                </span>
                                            )}
                                        </td>

                                        {/* Owner & Org */}
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                                                    <UserIcon className="w-3 h-3 text-zinc-500" />
                                                    <span>{r.owner_name || "Unassigned"}</span>
                                                </div>
                                                {r.organization_name && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                                        <Building2 className="w-3 h-3 text-zinc-600" />
                                                        <span>{r.organization_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Status & SLA */}
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span
                                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${getStatusBadgeClass(
                                                        r.status
                                                    )}`}
                                                >
                                                    {r.status.replace(/_/g, " ")}
                                                </span>

                                                {r.is_overdue ? (
                                                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        <span>OVERDUE SLA</span>
                                                    </span>
                                                ) : r.target_date ? (
                                                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-zinc-600" />
                                                        <span>Target {new Date(r.target_date).toLocaleDateString()}</span>
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3 px-4 text-right">
                                            <Link
                                                href={`/risks/${r.id}`}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                                            >
                                                <span>Inspect</span>
                                                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Risk Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-rose-500" />
                                <span>Register Enterprise Risk</span>
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

                        {createFindingBusinessId && (
                            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>Originating from Security Finding: <strong className="font-mono text-amber-200">{createFindingBusinessId}</strong></span>
                            </div>
                        )}

                        <form onSubmit={handleCreateRisk} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Risk Exposure Title *
                                </label>
                                <input
                                    type="text"
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    placeholder="e.g. Insecure Gateway Key Storage & Outbound Exfiltration Risk"
                                    required
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-rose-600 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Risk Category
                                    </label>
                                    <select
                                        value={createCategory}
                                        onChange={(e) => setCreateCategory(e.target.value as RiskCategory)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-rose-600 focus:outline-none"
                                    >
                                        <option value="Cybersecurity">Cybersecurity</option>
                                        <option value="Operational">Operational</option>
                                        <option value="Compliance">Compliance</option>
                                        <option value="Technology">Technology</option>
                                        <option value="Data Security">Data Security</option>
                                        <option value="Access Control">Access Control</option>
                                        <option value="Infrastructure">Infrastructure</option>
                                        <option value="Third Party">Third Party</option>
                                        <option value="Business Continuity">Business Continuity</option>
                                        <option value="Privacy">Privacy</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Impacted Asset or System
                                    </label>
                                    <input
                                        type="text"
                                        value={createAsset}
                                        onChange={(e) => setCreateAsset(e.target.value)}
                                        placeholder="e.g. Core Banking Payment Gateway"
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 focus:border-rose-600 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Inherent Risk 1-5 Scoring */}
                            <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-300">
                                        Inherent Risk Assessment (1–5)
                                    </span>
                                    <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getLevelBadgeClass(
                                            previewLevel
                                        )}`}
                                    >
                                        Score {previewScore} — {previewLevel}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-zinc-400 mb-1">
                                            Likelihood (1 = Rare, 5 = Almost Certain)
                                        </label>
                                        <select
                                            value={createLikelihood}
                                            onChange={(e) => setCreateLikelihood(Number(e.target.value))}
                                            className="w-full text-xs rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-zinc-200"
                                        >
                                            <option value={1}>1 - Rare</option>
                                            <option value={2}>2 - Unlikely</option>
                                            <option value={3}>3 - Possible</option>
                                            <option value={4}>4 - Likely</option>
                                            <option value={5}>5 - Almost Certain</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] text-zinc-400 mb-1">
                                            Impact (1 = Insignificant, 5 = Severe)
                                        </label>
                                        <select
                                            value={createImpact}
                                            onChange={(e) => setCreateImpact(Number(e.target.value))}
                                            className="w-full text-xs rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-zinc-200"
                                        >
                                            <option value={1}>1 - Insignificant</option>
                                            <option value={2}>2 - Minor</option>
                                            <option value={3}>3 - Moderate</option>
                                            <option value={4}>4 - Major</option>
                                            <option value={5}>5 - Severe</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                                        Organization
                                    </label>
                                    <select
                                        value={createOrgId}
                                        onChange={(e) => setCreateOrgId(e.target.value)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-2 text-zinc-200 focus:border-rose-600 focus:outline-none"
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
                                        Target Completion Date
                                    </label>
                                    <input
                                        type="date"
                                        value={createTargetDate}
                                        onChange={(e) => setCreateTargetDate(e.target.value)}
                                        className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 focus:border-rose-600 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Existing Controls Description
                                </label>
                                <textarea
                                    value={createControlsDesc}
                                    onChange={(e) => setCreateControlsDesc(e.target.value)}
                                    rows={2}
                                    placeholder="Describe current baseline safeguards (firewalls, policies, backup schedules)..."
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-rose-600 focus:outline-none resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-300 mb-1">
                                    Risk Exposure Narrative
                                </label>
                                <textarea
                                    value={createDesc}
                                    onChange={(e) => setCreateDesc(e.target.value)}
                                    rows={3}
                                    placeholder="Outline the threat scenario, vulnerability exploitation mechanism, and operational consequences..."
                                    className="w-full text-xs rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 focus:border-rose-600 focus:outline-none resize-none"
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
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-md disabled:opacity-50 transition"
                                >
                                    {creating ? "Registering..." : "Register Risk"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RisksListPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-zinc-500">Loading Risk Register...</div>}>
            <RisksListPageContent />
        </Suspense>
    );
}
