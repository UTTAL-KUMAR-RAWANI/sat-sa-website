const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface AssessmentConfig {
    volume_threshold_pct?: number;
    silence_threshold_pct?: number;
    auth_drop_threshold_pct?: number;
    min_baseline_events?: number;
    dimensions?: string[];
}

export interface NegativeSpaceAssessment {
    id: string;
    business_id: string;
    name: string;
    description?: string | null;
    assessment_type: string;
    status: string;
    dataset_id?: string | null;
    analytics_run_id?: string | null;
    organization_id?: string | null;
    sector_id?: string | null;
    initiated_by_id: string;
    baseline_window_start?: string | null;
    baseline_window_end?: string | null;
    comparison_window_start?: string | null;
    comparison_window_end?: string | null;
    configuration?: Record<string, any> | null;
    expected_activity_definition?: Record<string, any> | null;
    observed_activity_definition?: Record<string, any> | null;
    assessment_summary?: {
        status?: string;
        expected_events_count?: number;
        observed_events_count?: number;
        overall_gap_percentage?: number;
        total_signals_detected?: number;
        potential_missed_threat_count?: number;
        rule_hits?: Record<string, number>;
        has_data_quality_concern?: boolean;
        data_quality_notes?: string | null;
        evaluated_at?: string;
        message?: string;
    } | null;
    gap_count: number;
    signal_count: number;
    potential_missed_threat_count: number;
    completed_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface NegativeSpaceSignal {
    id: string;
    business_id: string;
    assessment_id: string;
    category: string;
    gap_description: string;
    gap_percentage: number;
    severity: string;
    confidence: string;
    expected_activity?: Record<string, any> | null;
    observed_activity?: Record<string, any> | null;
    time_window_start?: string | null;
    time_window_end?: string | null;
    affected_asset?: string | null;
    affected_user?: string | null;
    source?: string | null;
    supporting_event_refs?: Record<string, any> | null;
    related_alert_id?: string | null;
    related_cse_id?: string | null;
    converted_finding_id?: string | null;
    data_quality_concern: boolean;
    data_quality_notes?: string | null;
    status: string; // DETECTED, REVIEWING, VALIDATED, DISMISSED, CONVERTED_TO_FINDING
    reviewed_by_id?: string | null;
    review_comments?: string | null;
    dismissal_reason?: string | null;
    reviewed_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface NegativeSpaceAssessmentDetail extends NegativeSpaceAssessment {
    signals: NegativeSpaceSignal[];
}

export interface NegativeSpaceAssessmentListResponse {
    items: NegativeSpaceAssessment[];
    total: number;
    skip: number;
    limit: number;
}

export interface NegativeSpaceSignalListResponse {
    items: NegativeSpaceSignal[];
    total: number;
    skip: number;
    limit: number;
}

export interface NegativeSpaceKPIs {
    total_assessments: number;
    total_signals: number;
    active_signals: number;
    validated_signals: number;
    dismissed_signals: number;
    converted_to_findings: number;
    high_critical_signals: number;
    data_quality_concerns: number;
    by_category: Record<string, number>;
    by_severity: Record<string, number>;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        let errMessage = `Error ${res.status}: ${res.statusText}`;
        try {
            const errData = await res.json();
            if (errData.detail) {
                errMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
            }
        } catch {
            // fallback
        }
        throw new Error(errMessage);
    }

    return res.json();
}

export const negativeSpaceApi = {
    // 1. Get aggregated KPIs
    getKPIs: () => {
        return request<NegativeSpaceKPIs>('/negative-space/kpis');
    },

    // 2. List assessments
    listAssessments: (params?: {
        status?: string;
        assessment_type?: string;
        dataset_id?: string;
        search?: string;
        skip?: number;
        limit?: number;
    }) => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.assessment_type) query.append('assessment_type', params.assessment_type);
        if (params?.dataset_id) query.append('dataset_id', params.dataset_id);
        if (params?.search) query.append('search', params.search);
        if (params?.skip !== undefined) query.append('skip', String(params.skip));
        if (params?.limit !== undefined) query.append('limit', String(params.limit));
        const qs = query.toString();
        return request<NegativeSpaceAssessmentListResponse>(`/negative-space/assessments${qs ? `?${qs}` : ''}`);
    },

    // 3. Create assessment
    createAssessment: (payload: {
        name: string;
        description?: string;
        assessment_type?: string;
        dataset_id?: string;
        organization_id?: string;
        sector_id?: string;
        baseline_window_start?: string;
        baseline_window_end?: string;
        comparison_window_start?: string;
        comparison_window_end?: string;
        configuration?: AssessmentConfig;
        expected_activity_definition?: Record<string, any>;
    }) => {
        return request<NegativeSpaceAssessment>('/negative-space/assessments', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    // 4. Get assessment detail
    getAssessment: (id: string) => {
        return request<NegativeSpaceAssessmentDetail>(`/negative-space/assessments/${id}`);
    },

    // 5. Update assessment
    updateAssessment: (id: string, payload: Partial<NegativeSpaceAssessment>) => {
        return request<NegativeSpaceAssessment>(`/negative-space/assessments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    // 6. Run assessment execution
    runAssessment: (id: string, payload?: { configuration?: AssessmentConfig; recalculate_baseline?: boolean }) => {
        return request<NegativeSpaceAssessment>(`/negative-space/assessments/${id}/run`, {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        });
    },

    // 7. List signals
    listSignals: (params?: {
        assessment_id?: string;
        category?: string;
        severity?: string;
        status?: string;
        data_quality_concern?: boolean;
        search?: string;
        skip?: number;
        limit?: number;
    }) => {
        const query = new URLSearchParams();
        if (params?.assessment_id) query.append('assessment_id', params.assessment_id);
        if (params?.category) query.append('category', params.category);
        if (params?.severity) query.append('severity', params.severity);
        if (params?.status) query.append('status', params.status);
        if (params?.data_quality_concern !== undefined) query.append('data_quality_concern', String(params.data_quality_concern));
        if (params?.search) query.append('search', params.search);
        if (params?.skip !== undefined) query.append('skip', String(params.skip));
        if (params?.limit !== undefined) query.append('limit', String(params.limit));
        const qs = query.toString();
        return request<NegativeSpaceSignalListResponse>(`/negative-space/signals${qs ? `?${qs}` : ''}`);
    },

    // 8. Get signal detail
    getSignal: (id: string) => {
        return request<NegativeSpaceSignal>(`/negative-space/signals/${id}`);
    },

    // 9. Review signal
    reviewSignal: (id: string, payload: { review_comments: string }) => {
        return request<NegativeSpaceSignal>(`/negative-space/signals/${id}/review`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    // 10. Validate signal
    validateSignal: (id: string, payload: { notes?: string; severity?: string }) => {
        return request<NegativeSpaceSignal>(`/negative-space/signals/${id}/validate`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    // 11. Dismiss signal (mandatory justification)
    dismissSignal: (id: string, payload: { dismissal_reason: string }) => {
        return request<NegativeSpaceSignal>(`/negative-space/signals/${id}/dismiss`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    // 12. Convert signal to formal Finding
    convertSignalToFinding: (id: string, payload: {
        title?: string;
        description?: string;
        severity?: string;
        priority?: string;
        remediation_required?: boolean;
        due_date?: string;
        assigned_to_id?: string;
    }) => {
        return request<{
            message: string;
            signal: NegativeSpaceSignal;
            finding_id: string;
            finding_business_id: string;
        }>(`/negative-space/signals/${id}/convert-finding`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
};
