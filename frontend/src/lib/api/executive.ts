const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        credentials: "include",
    });

    if (!res.ok) {
        let errorDetail = "An unexpected error occurred.";
        try {
            const err = await res.json();
            errorDetail = err.detail || errorDetail;
        } catch {}
        throw new Error(errorDetail);
    }

    return res.json();
}

export interface PostureScoreBreakdown {
    overall_score: number | null;
    is_available: boolean;
    risk_subscore: number | null;
    findings_subscore: number | null;
    remediation_subscore: number | null;
    assessments_subscore: number | null;
    negative_space_subscore: number | null;
    explanation: string;
    missing_reasons: string[];
}

export interface AttentionRequiredItem {
    id: string;
    item_type: string;
    business_id: string;
    title: string;
    severity: string;
    status: string;
    due_date: string | null;
    owner: string | null;
    action_url: string;
    reason: string;
}

export interface CISOSummaryResponse {
    posture: PostureScoreBreakdown;
    attention_required: AttentionRequiredItem[];
    active_threats_count: number;
    open_findings_count: number;
    critical_findings_count: number;
    open_risks_count: number;
    critical_risks_count: number;
    remediation_completion_pct: number;
    overdue_remediations_count: number;
    active_assessments_count: number;
    supervisory_open_cases_count: number;
    negative_space_coverage_gaps: number;
    negative_space_high_signals: number;
    effective_scope: string;
    generated_at: string;
}

export interface ManagementSummaryResponse {
    posture: PostureScoreBreakdown;
    business_risk_rating: string;
    critical_risks_count: number;
    high_risks_count: number;
    total_active_risks: number;
    major_issues: AttentionRequiredItem[];
    remediation_completion_pct: number;
    overdue_remediations_count: number;
    critical_escalations_count: number;
    effective_scope: string;
    generated_at: string;
}

export interface ExecutiveRiskOverview {
    by_level: Record<string, number>;
    by_category: Record<string, number>;
    requiring_treatment: number;
    accepted_risks: number;
    open_exceptions: number;
    overdue_reviews: number;
}

export interface ExecutiveFindingsOverview {
    by_severity: Record<string, number>;
    aging_over_30d: number;
    aging_over_60d: number;
    aging_over_90d: number;
    requiring_remediation: number;
    negative_space_findings: number;
}

export interface ExecutiveRemediationOverview {
    by_status: Record<string, number>;
    completion_rate_pct: number;
    overdue_count: number;
    blocked_count: number;
    awaiting_validation: number;
}

export interface ExecutiveAssessmentOverview {
    assessments_completed: number;
    assessments_in_progress: number;
    control_effectiveness: Record<string, number>;
    compliance_score_pct: number | null;
}

export interface ExecutiveNegativeSpaceOverview {
    assessments_run: number;
    coverage_gaps_count: number;
    high_critical_signals: number;
    telemetry_silence_count: number;
    unmonitored_assets_count: number;
}

export interface ExecutiveSupervisionOverview {
    open_cases: number;
    critical_escalations: number;
    pending_decisions: number;
    cases_awaiting_review: number;
    cases_under_monitoring: number;
    recent_decisions: Array<{
        id: string;
        business_id: string;
        title: string;
        decision_type: string;
        status: string;
        created_at: string | null;
    }>;
}

export interface TrendDataPoint {
    timestamp: string;
    posture_score: number | null;
    open_findings: number;
    critical_risks: number;
    open_remediations: number;
}

export interface ExecutiveTrendsResponse {
    has_data: boolean;
    interval_days: number;
    message: string | null;
    points: TrendDataPoint[];
}

export interface OrganizationComparisonItem {
    id: string;
    name: string;
    sector_name: string | null;
    posture_score: number | null;
    open_findings: number;
    critical_risks: number;
    overdue_remediations: number;
}

export interface SectorComparisonItem {
    id: string;
    name: string;
    org_count: number;
    avg_posture_score: number | null;
    total_findings: number;
    total_critical_risks: number;
}

export interface ExecutiveComparisonResponse {
    effective_scope: string;
    organizations: OrganizationComparisonItem[];
    sectors: SectorComparisonItem[];
}

export const ExecutiveApi = {
    // CISO Endpoints
    async getCISOSummary(): Promise<CISOSummaryResponse> {
        return request<CISOSummaryResponse>("/executive/ciso/summary");
    },

    async getCISORisks(): Promise<ExecutiveRiskOverview> {
        return request<ExecutiveRiskOverview>("/executive/ciso/risks");
    },

    async getCISOFindings(): Promise<ExecutiveFindingsOverview> {
        return request<ExecutiveFindingsOverview>("/executive/ciso/findings");
    },

    async getCISORemediation(): Promise<ExecutiveRemediationOverview> {
        return request<ExecutiveRemediationOverview>("/executive/ciso/remediation");
    },

    async getCISOAssessments(): Promise<ExecutiveAssessmentOverview> {
        return request<ExecutiveAssessmentOverview>("/executive/ciso/assessments");
    },

    async getCISONegativeSpace(): Promise<ExecutiveNegativeSpaceOverview> {
        return request<ExecutiveNegativeSpaceOverview>("/executive/ciso/negative-space");
    },

    async getCISOSupervision(): Promise<ExecutiveSupervisionOverview> {
        return request<ExecutiveSupervisionOverview>("/executive/ciso/supervision");
    },

    async getCISOTrends(days: number = 30): Promise<ExecutiveTrendsResponse> {
        return request<ExecutiveTrendsResponse>(`/executive/ciso/trends?days=${days}`);
    },

    // Management Endpoints
    async getManagementSummary(): Promise<ManagementSummaryResponse> {
        return request<ManagementSummaryResponse>("/executive/management/summary");
    },

    async getManagementRisks(): Promise<ExecutiveRiskOverview> {
        return request<ExecutiveRiskOverview>("/executive/management/risks");
    },

    async getManagementRemediation(): Promise<ExecutiveRemediationOverview> {
        return request<ExecutiveRemediationOverview>("/executive/management/remediation");
    },

    async getManagementIssues(): Promise<AttentionRequiredItem[]> {
        return request<AttentionRequiredItem[]>("/executive/management/issues");
    },

    async getManagementTrends(days: number = 30): Promise<ExecutiveTrendsResponse> {
        return request<ExecutiveTrendsResponse>(`/executive/management/trends?days=${days}`);
    },

    // Cross-org Comparison
    async getComparison(): Promise<ExecutiveComparisonResponse> {
        return request<ExecutiveComparisonResponse>("/executive/comparison");
    },

    // Export CSV with audit logging
    async downloadSummaryCSV(): Promise<Blob> {
        const res = await fetch(`${API_BASE}/executive/export`, {
            credentials: "include",
        });
        if (!res.ok) {
            let errorDetail = "Failed to export executive CSV.";
            try {
                const err = await res.json();
                errorDetail = err.detail || errorDetail;
            } catch {}
            throw new Error(errorDetail);
        }
        return res.blob();
    },
};
