const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface ColumnInfo {
    column_name: string;
    inferred_type: string;
    null_count: number;
    sample_values: string[];
}

export interface SchemaDetectionResponse {
    columns: ColumnInfo[];
    sample_row_count: number;
    estimated_total_rows: number;
    suggested_mapping: Record<string, string>;
}

export interface ValidationSummary {
    total_records: number;
    valid_records: number;
    invalid_records: number;
    warning_records: number;
    duplicate_records: number;
    severity_distribution: Record<string, number>;
    earliest_timestamp?: string | null;
    latest_timestamp?: string | null;
    validity_pct: number;
    completeness_pct: number;
    conformity_pct: number;
    uniqueness_pct: number;
}

export interface ValidationErrorItem {
    row: number;
    status: string;
    issues: string[];
    raw: Record<string, any>;
}

export interface ValidationResponse {
    dataset_id: string;
    business_id: string;
    status: string;
    quality_score: number;
    quality_rating: string;
    validation_summary: ValidationSummary;
    error_log: ValidationErrorItem[];
}

export interface DatasetItem {
    id: string;
    business_id: string;
    name: string;
    description?: string | null;
    source_type: string;
    file_name: string;
    file_type: string;
    file_size: number;
    file_hash: string;
    uploaded_by_id: string;
    uploaded_by_name?: string | null;
    organization_id?: string | null;
    organization_name?: string | null;
    sector_id?: string | null;
    sector_name?: string | null;
    related_cse_id?: string | null;
    related_cse_business_id?: string | null;
    status: 'UPLOADED' | 'MAPPING_REQUIRED' | 'MAPPED' | 'VALIDATING' | 'READY_TO_IMPORT' | 'IMPORTING' | 'IMPORTED' | 'FAILED';
    record_count: number;
    valid_record_count: number;
    invalid_record_count: number;
    warning_count: number;
    duplicate_count: number;
    detected_schema?: {
        columns: ColumnInfo[];
        sample_row_count: number;
        estimated_total_rows: number;
        suggested_mapping: Record<string, string>;
    } | null;
    column_mapping?: Record<string, string> | null;
    validation_summary?: ValidationSummary | null;
    quality_score?: number | null;
    quality_rating?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | null;
    error_message?: string | null;
    created_at: string;
    updated_at: string;
}

export interface DatasetImportItem {
    id: string;
    business_id: string;
    dataset_id: string;
    started_by_id: string;
    started_by_name?: string | null;
    started_at: string;
    completed_at?: string | null;
    status: string;
    records_processed: number;
    records_imported: number;
    records_rejected: number;
    error_count: number;
    validation_summary?: ValidationSummary | null;
    import_summary?: Record<string, any> | null;
    error_log?: ValidationErrorItem[] | null;
}

export interface AnalyticsRunItem {
    id: string;
    business_id: string;
    dataset_id: string;
    initiated_by_id: string;
    initiated_by_name?: string | null;
    analysis_type: string;
    status: string;
    started_at: string;
    completed_at?: string | null;
    records_analyzed: number;
    results_summary?: {
        total_events: number;
        severity_distribution: Record<string, number>;
        event_type_distribution: Record<string, number>;
        source_distribution: Record<string, number>;
        status_distribution: Record<string, number>;
        unique_assets: number;
        unique_users: number;
        unique_source_ips: number;
        unique_destination_ips: number;
        top_assets: Array<{ asset: string; count: number }>;
        top_source_ips: Array<{ ip: string; count: number }>;
        top_event_types: Array<{ type: string; count: number }>;
        top_sources: Array<{ source: string; count: number }>;
        time_series: Array<{ period: string; total: number; critical: number; high: number }>;
        earliest_event?: string | null;
        latest_event?: string | null;
    } | null;
    error_message?: string | null;
}

export interface AnalyticsSummary {
    total_datasets: number;
    imported_datasets: number;
    total_events: number;
    total_analytics_runs: number;
}

export interface SecurityEventItem {
    id: string;
    business_id: string;
    external_event_id?: string | null;
    title: string;
    description?: string | null;
    source: string;
    source_system?: string | null;
    event_type: string;
    severity: string;
    occurred_at?: string | null;
    source_ip?: string | null;
    destination_ip?: string | null;
    asset_id?: string | null;
    user_identifier?: string | null;
    action?: string | null;
    status: string;
    created_at: string;
    raw_metadata?: Record<string, any> | null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        credentials: 'include',
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err.detail || `Request failed with status ${res.status}`;
        throw new Error(message);
    }

    if (res.status === 204) {
        return {} as T;
    }

    return res.json();
}

export const datasetsApi = {
    // 1. List datasets
    getDatasets: (params?: { status?: string; file_type?: string; search?: string; skip?: number; limit?: number }) => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.file_type) query.append('file_type', params.file_type);
        if (params?.search) query.append('search', params.search);
        if (params?.skip !== undefined) query.append('skip', String(params.skip));
        if (params?.limit !== undefined) query.append('limit', String(params.limit));
        const qs = query.toString();
        return request<DatasetItem[]>(`/datasets${qs ? `?${qs}` : ''}`);
    },

    // 2. Get dataset by ID
    getDataset: (id: string) => {
        return request<DatasetItem>(`/datasets/${id}`);
    },

    // 3. Upload dataset
    uploadDataset: (formData: FormData) => {
        return request<DatasetItem>('/datasets/upload', {
            method: 'POST',
            body: formData,
        });
    },

    // 4. Update dataset metadata
    updateDataset: (id: string, payload: { name?: string; description?: string; related_cse_id?: string }) => {
        return request<DatasetItem>(`/datasets/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    // 5. Delete dataset
    deleteDataset: (id: string) => {
        return request<void>(`/datasets/${id}`, {
            method: 'DELETE',
        });
    },

    // 6. Detect schema
    detectSchema: (id: string) => {
        return request<SchemaDetectionResponse>(`/datasets/${id}/detect-schema`, {
            method: 'POST',
        });
    },

    // 7. Preview dataset raw data
    previewDataset: (id: string, limit = 50) => {
        return request<{
            columns: string[];
            schema: ColumnInfo[];
            sample_rows: any[];
            total_estimated_rows: number;
            mapping: Record<string, string>;
        }>(`/datasets/${id}/preview?limit=${limit}`);
    },

    // 8. Save column mapping
    saveColumnMapping: (id: string, columnMapping: Record<string, string>) => {
        return request<DatasetItem>(`/datasets/${id}/map-columns`, {
            method: 'POST',
            body: JSON.stringify({ column_mapping: columnMapping }),
        });
    },

    // 9. Validate dataset data & quality score
    validateDataset: (id: string) => {
        return request<ValidationResponse>(`/datasets/${id}/validate`, {
            method: 'POST',
        });
    },

    // 10. Import validated records
    importDataset: (id: string, mode = 'BATCH') => {
        return request<DatasetImportItem>(`/datasets/${id}/import`, {
            method: 'POST',
            body: JSON.stringify({ mode }),
        });
    },

    // 11. Get dataset imports
    getDatasetImports: (id: string) => {
        return request<DatasetImportItem[]>(`/datasets/${id}/imports`);
    },

    // 12. Get security events imported from dataset
    getDatasetEvents: (id: string, params?: { skip?: number; limit?: number }) => {
        const query = new URLSearchParams();
        if (params?.skip !== undefined) query.append('skip', String(params.skip));
        if (params?.limit !== undefined) query.append('limit', String(params.limit));
        const qs = query.toString();
        return request<SecurityEventItem[]>(`/datasets/${id}/events${qs ? `?${qs}` : ''}`);
    },

    // 13. Get cached analytics for dataset
    getDatasetAnalytics: (id: string) => {
        return request<AnalyticsRunItem['results_summary']>(`/datasets/${id}/analytics`);
    },

    // 14. Trigger on-demand analytics run
    runAnalytics: (payload: { dataset_id: string; analysis_type?: string }) => {
        return request<AnalyticsRunItem>('/analytics/run', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    // 15. List analytics runs
    listAnalyticsRuns: (datasetId?: string) => {
        const qs = datasetId ? `?dataset_id=${datasetId}` : '';
        return request<AnalyticsRunItem[]>(`/analytics/runs${qs}`);
    },

    // 16. Get analytics run detail
    getAnalyticsRun: (id: string) => {
        return request<AnalyticsRunItem>(`/analytics/runs/${id}`);
    },

    // 17. Analytics summary statistics
    getAnalyticsSummary: () => {
        return request<AnalyticsSummary>('/analytics/summary');
    },
};
