import { apiClient } from './client';

export interface SupervisoryCaseItem {
    id: string;
    business_id: string;
    title: string;
    description?: string | null;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'ASSIGNED' | 'UNDER_REVIEW' | 'RECOMMENDATION_READY' | 'AUTHORITY_REVIEW' | 'DECISION_REQUIRED' | 'ACTION_REQUIRED' | 'MONITORING' | 'CLOSED';
    trigger_type: string;
    organization_id?: string | null;
    sector_id?: string | null;
    created_by_id?: string | null;
    assigned_analyst_id?: string | null;
    supervisory_authority_id?: string | null;
    decided_by_id?: string | null;
    source_cse_id?: string | null;
    source_finding_id?: string | null;
    source_risk_id?: string | null;
    source_remediation_id?: string | null;
    source_assessment_id?: string | null;
    analyst_notes?: string | null;
    recommendation?: string | null;
    recommendation_submitted_at?: string | null;
    final_decision?: string | null;
    decision_reason?: string | null;
    decided_at?: string | null;
    due_date?: string | null;
    closed_at?: string | null;
    created_at: string;
    updated_at: string;
    organization_name?: string | null;
    sector_name?: string | null;
    assigned_analyst_name?: string | null;
    supervisory_authority_name?: string | null;
    decided_by_name?: string | null;
    created_by_name?: string | null;
    source_cse_business_id?: string | null;
    source_finding_business_id?: string | null;
    source_risk_business_id?: string | null;
    source_remediation_business_id?: string | null;
}

export interface EscalationItem {
    id: string;
    business_id: string;
    resource_type: string;
    resource_id: string;
    reason: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_REVIEW' | 'ACTION_REQUIRED' | 'RESOLVED' | 'CLOSED';
    level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
    escalated_by_id: string;
    escalated_to_id?: string | null;
    organization_id?: string | null;
    sector_id?: string | null;
    supervisory_case_id?: string | null;
    due_date?: string | null;
    resolution?: string | null;
    resolved_at?: string | null;
    created_at: string;
    updated_at: string;
    escalated_by_name?: string | null;
    escalated_to_name?: string | null;
    organization_name?: string | null;
    sector_name?: string | null;
    supervisory_case_business_id?: string | null;
}

export interface SupervisoryDecisionItem {
    id: string;
    business_id: string;
    supervisory_case_id: string;
    decision_type: 'CLOSE' | 'CONTINUE_MONITORING' | 'REQUIRE_ACTION' | 'ESCALATE' | 'ACCEPT_RISK' | 'REQUEST_REVIEW';
    status: string;
    decision_maker_id: string;
    rationale: string;
    conditions?: string | null;
    action_required?: string | null;
    effective_date?: string | null;
    review_date?: string | null;
    organization_id?: string | null;
    sector_id?: string | null;
    created_at: string;
    updated_at: string;
    decision_maker_name?: string | null;
    supervisory_case_business_id?: string | null;
    supervisory_case_title?: string | null;
}

export interface SupervisionSummary {
    open_cases: number;
    critical_escalations: number;
    high_risk_findings: number;
    critical_risks: number;
    overdue_remediations: number;
    pending_decisions: number;
    cases_awaiting_authority: number;
    cases_under_monitoring: number;
    priority_distribution: Record<string, number>;
    status_distribution: Record<string, number>;
}

export interface TimelineEvent {
    id: string;
    type: 'TRANSITION' | 'AUDIT';
    from_state?: string | null;
    to_state?: string | null;
    action?: string | null;
    description?: string | null;
    reason?: string | null;
    actor_name?: string | null;
    timestamp?: string | null;
}

export const supervisionApi = {
    getSummary: async (): Promise<SupervisionSummary> => {
        const response = await apiClient.get<SupervisionSummary>('/supervision/summary');
        return response.data;
    },

    getCases: async (params?: Record<string, any>): Promise<SupervisoryCaseItem[]> => {
        const response = await apiClient.get<SupervisoryCaseItem[]>('/supervision/cases', { params });
        return response.data;
    },

    getCase: async (id: string): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.get<SupervisoryCaseItem>(`/supervision/cases/${id}`);
        return response.data;
    },

    createCase: async (payload: any): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.post<SupervisoryCaseItem>('/supervision/cases', payload);
        return response.data;
    },

    updateCase: async (id: string, payload: any): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.patch<SupervisoryCaseItem>(`/supervision/cases/${id}`, payload);
        return response.data;
    },

    assignCase: async (id: string, payload: { assigned_analyst_id?: string; supervisory_authority_id?: string; notes?: string }): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.post<SupervisoryCaseItem>(`/supervision/cases/${id}/assign`, payload);
        return response.data;
    },

    startReview: async (id: string, payload?: { analyst_notes?: string }): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.post<SupervisoryCaseItem>(`/supervision/cases/${id}/start-review`, payload || {});
        return response.data;
    },

    submitRecommendation: async (id: string, payload: { recommendation: string; analyst_notes?: string; target_status?: string }): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.post<SupervisoryCaseItem>(`/supervision/cases/${id}/submit-recommendation`, payload);
        return response.data;
    },

    requestReview: async (id: string, payload: { comments: string }): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.post<SupervisoryCaseItem>(`/supervision/cases/${id}/request-review`, payload);
        return response.data;
    },

    recordDecision: async (id: string, payload: { decision_type: string; rationale: string; conditions?: string; action_required?: string; effective_date?: string; review_date?: string }): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.post<SupervisoryCaseItem>(`/supervision/cases/${id}/record-decision`, payload);
        return response.data;
    },

    closeCase: async (id: string, payload?: { reason?: string }): Promise<SupervisoryCaseItem> => {
        const response = await apiClient.post<SupervisoryCaseItem>(`/supervision/cases/${id}/close`, payload || {});
        return response.data;
    },

    createSupervisoryFinding: async (id: string, payload: any): Promise<any> => {
        const response = await apiClient.post(`/supervision/cases/${id}/finding`, payload);
        return response.data;
    },

    getTimeline: async (id: string): Promise<TimelineEvent[]> => {
        const response = await apiClient.get<TimelineEvent[]>(`/supervision/cases/${id}/timeline`);
        return response.data;
    },

    getEscalations: async (params?: Record<string, any>): Promise<EscalationItem[]> => {
        const response = await apiClient.get<EscalationItem[]>('/supervision/escalations', { params });
        return response.data;
    },

    getEscalation: async (id: string): Promise<EscalationItem> => {
        const response = await apiClient.get<EscalationItem>(`/supervision/escalations/${id}`);
        return response.data;
    },

    createEscalation: async (payload: any): Promise<EscalationItem> => {
        const response = await apiClient.post<EscalationItem>('/supervision/escalations', payload);
        return response.data;
    },

    acknowledgeEscalation: async (id: string): Promise<EscalationItem> => {
        const response = await apiClient.post<EscalationItem>(`/supervision/escalations/${id}/acknowledge`);
        return response.data;
    },

    assignEscalation: async (id: string, payload: { assigned_to_id: string; notes?: string }): Promise<EscalationItem> => {
        const response = await apiClient.post<EscalationItem>(`/supervision/escalations/${id}/assign`, payload);
        return response.data;
    },

    resolveEscalation: async (id: string, payload: { resolution: string }): Promise<EscalationItem> => {
        const response = await apiClient.post<EscalationItem>(`/supervision/escalations/${id}/resolve`, payload);
        return response.data;
    },

    closeEscalation: async (id: string): Promise<EscalationItem> => {
        const response = await apiClient.post<EscalationItem>(`/supervision/escalations/${id}/close`);
        return response.data;
    },

    triggerAutoScan: async (): Promise<any> => {
        const response = await apiClient.post('/supervision/escalations/trigger-scan');
        return response.data;
    },

    getDecisions: async (params?: Record<string, any>): Promise<SupervisoryDecisionItem[]> => {
        const response = await apiClient.get<SupervisoryDecisionItem[]>('/supervision/decisions', { params });
        return response.data;
    },

    getDecision: async (id: string): Promise<SupervisoryDecisionItem> => {
        const response = await apiClient.get<SupervisoryDecisionItem>(`/supervision/decisions/${id}`);
        return response.data;
    },

    approveDecision: async (id: string): Promise<SupervisoryDecisionItem> => {
        const response = await apiClient.post<SupervisoryDecisionItem>(`/supervision/decisions/${id}/approve`);
        return response.data;
    },
};
