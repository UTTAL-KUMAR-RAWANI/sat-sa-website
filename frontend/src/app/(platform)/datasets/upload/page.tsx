"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import {
    datasetsApi,
    DatasetItem,
    SchemaDetectionResponse,
    ValidationResponse,
    DatasetImportItem,
} from "@/lib/api/datasets";
import {
    Database,
    Upload,
    FileText,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    ArrowRight,
    ArrowLeft,
    Layers,
    Shield,
    Table,
    BarChart3,
    RefreshCw,
} from "lucide-react";

const CANONICAL_FIELDS = [
    { key: "external_event_id", label: "Event ID / External Ref", required: false, desc: "Source event identifier" },
    { key: "occurred_at", label: "Occurred At / Timestamp", required: true, desc: "Date and time of occurrence" },
    { key: "event_type", label: "Event Type", required: true, desc: "Category (e.g. AUTHENTICATION, FIREWALL, EDR)" },
    { key: "severity", label: "Severity", required: true, desc: "CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL" },
    { key: "source_ip", label: "Source IP", required: false, desc: "IPv4 or IPv6 originator" },
    { key: "destination_ip", label: "Destination IP", required: false, desc: "IPv4 or IPv6 target" },
    { key: "asset_id", label: "Asset ID / Hostname", required: false, desc: "Affected asset identifier" },
    { key: "user_identifier", label: "User / Account", required: false, desc: "User identity or account name" },
    { key: "action", label: "Action Taken", required: false, desc: "e.g. BLOCKED, ALLOWED, QUARANTINED" },
    { key: "status", label: "Event Status", required: false, desc: "e.g. SUCCESS, FAILURE, ALERTED" },
    { key: "description", label: "Description / Message", required: false, desc: "Raw payload or log narrative" },
];

export default function DatasetUploadWizardPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Wizard Step: 1 = Upload, 2 = Schema, 3 = Mapping, 4 = Validation, 5 = Import, 6 = Completed
    const [currentStep, setCurrentStep] = useState(1);

    // Step 1: Upload state
    const [file, setFile] = useState<File | null>(null);
    const [datasetName, setDatasetName] = useState("");
    const [description, setDescription] = useState("");
    const [sourceType, setSourceType] = useState("SIEM");
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Step 2 & 3: Dataset, Schema & Mapping state
    const [dataset, setDataset] = useState<DatasetItem | null>(null);
    const [schema, setSchema] = useState<SchemaDetectionResponse | null>(null);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [mappingSaving, setMappingSaving] = useState(false);

    // Step 4: Validation state
    const [validation, setValidation] = useState<ValidationResponse | null>(null);
    const [validating, setValidating] = useState(false);

    // Step 5: Import state
    const [importResult, setImportResult] = useState<DatasetImportItem | null>(null);
    const [importing, setImporting] = useState(false);

    // --- Step 1: Handle File Upload ---
    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setUploadError("Please select a CSV or JSON file to upload.");
            return;
        }
        if (!datasetName.trim()) {
            setUploadError("Please enter a dataset name.");
            return;
        }

        setUploading(true);
        setUploadError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", datasetName.trim());
            if (description.trim()) formData.append("description", description.trim());
            formData.append("source_type", sourceType);

            const createdDataset = await datasetsApi.uploadDataset(formData);
            setDataset(createdDataset);

            // Fetch detected schema
            const detected = await datasetsApi.detectSchema(createdDataset.id);
            setSchema(detected);

            // Initialize column mapping from suggested mapping or existing mapping
            const initialMapping = { ...(detected.suggested_mapping || {}) };
            setColumnMapping(initialMapping);

            setCurrentStep(2);
        } catch (err: any) {
            console.error("Upload error:", err);
            setUploadError(err.message || "Failed to upload dataset file.");
        } finally {
            setUploading(false);
        }
    };

    // --- Step 3: Save Column Mapping ---
    const handleSaveMapping = async () => {
        if (!dataset) return;
        setMappingSaving(true);
        try {
            const updated = await datasetsApi.saveColumnMapping(dataset.id, columnMapping);
            setDataset(updated);
            setCurrentStep(4);
            // Automatically trigger validation
            runValidation(dataset.id);
        } catch (err: any) {
            alert(`Failed to save mapping: ${err.message}`);
        } finally {
            setMappingSaving(false);
        }
    };

    // --- Step 4: Run Validation ---
    const runValidation = async (targetId?: string) => {
        const id = targetId || dataset?.id;
        if (!id) return;
        setValidating(true);
        try {
            const val = await datasetsApi.validateDataset(id);
            setValidation(val);
        } catch (err: any) {
            alert(`Validation failed: ${err.message}`);
        } finally {
            setValidating(false);
        }
    };

    // --- Step 5: Run Import ---
    const handleRunImport = async () => {
        if (!dataset) return;
        setImporting(true);
        try {
            const imp = await datasetsApi.importDataset(dataset.id, "BATCH");
            setImportResult(imp);
            setCurrentStep(6);
        } catch (err: any) {
            alert(`Import failed: ${err.message}`);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
                        <Link href="/datasets" className="hover:underline flex items-center gap-1">
                            <ArrowLeft className="w-3.5 h-3.5" /> Datasets
                        </Link>
                        <span>/</span>
                        <span>Ingestion Wizard</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                        Dataset Ingestion Pipeline
                        {dataset && (
                            <span className="text-xs font-mono py-0.5 px-2 bg-slate-800 border border-slate-700 rounded-full text-cyan-400">
                                {dataset.business_id}
                            </span>
                        )}
                    </h1>
                </div>
            </div>

            {/* Stepper Wizard Bar */}
            <div className="grid grid-cols-6 gap-2 bg-slate-900/40 p-2 rounded-xl border border-slate-800">
                {[
                    { num: 1, label: "Upload File" },
                    { num: 2, label: "Detect Schema" },
                    { num: 3, label: "Map Columns" },
                    { num: 4, label: "Validate Data" },
                    { num: 5, label: "Ingest Events" },
                    { num: 6, label: "Complete" },
                ].map((s) => {
                    const isActive = currentStep === s.num;
                    const isPassed = currentStep > s.num;
                    return (
                        <div
                            key={s.num}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-mono transition ${
                                isActive
                                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 font-bold"
                                    : isPassed
                                    ? "bg-slate-900/60 border-slate-800 text-emerald-400 font-medium"
                                    : "border-transparent text-slate-500"
                            }`}
                        >
                            <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                    isActive
                                        ? "bg-cyan-500 text-slate-950"
                                        : isPassed
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                        : "bg-slate-800 text-slate-500"
                                }`}
                            >
                                {isPassed ? "✓" : s.num}
                            </span>
                            <span className="hidden md:inline">{s.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Step 1: Upload File */}
            {currentStep === 1 && (
                <div className="max-w-2xl mx-auto bg-slate-900/30 border border-slate-800 rounded-xl p-6 lg:p-8 space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Upload className="w-5 h-5 text-cyan-400" />
                            Step 1: Upload Dataset File
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Upload a raw security event log in CSV or JSON format (maximum size: 50MB).
                        </p>
                    </div>

                    {uploadError && (
                        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                            <span>{uploadError}</span>
                        </div>
                    )}

                    <form onSubmit={handleFileUpload} className="space-y-4">
                        {/* File Drop Area */}
                        <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl p-6 text-center bg-slate-950/50 transition">
                            <input
                                type="file"
                                id="fileInput"
                                accept=".csv,.json"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        const selected = e.target.files[0];
                                        setFile(selected);
                                        if (!datasetName) {
                                            setDatasetName(selected.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
                                        }
                                    }
                                }}
                                className="hidden"
                            />
                            <label htmlFor="fileInput" className="cursor-pointer block">
                                <FileText className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                                {file ? (
                                    <div>
                                        <p className="text-sm font-semibold text-cyan-400">{file.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {(file.size / (1024 * 1024)).toFixed(2)} MB • Click to replace
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm font-medium text-slate-300">
                                            Click to select or drag and drop file
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">Supported: .CSV, .JSON (Max 50MB)</p>
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* Dataset Name */}
                        <div>
                            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                                Dataset Name <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={datasetName}
                                onChange={(e) => setDatasetName(e.target.value)}
                                placeholder="e.g., Perimeter Firewall Inbound Drop Logs"
                                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                            />
                        </div>

                        {/* Source Type */}
                        <div>
                            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                                Telemetry Source
                            </label>
                            <select
                                value={sourceType}
                                onChange={(e) => setSourceType(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition font-mono"
                            >
                                <option value="SIEM">SIEM (Splunk / QRadar / Sentinel)</option>
                                <option value="FIREWALL">Perimeter / Next-Gen Firewall</option>
                                <option value="EDR">EDR / Endpoint Telemetry</option>
                                <option value="IDENTITY">Identity Provider (AD / Okta / Ping)</option>
                                <option value="WAF">Web Application Firewall</option>
                                <option value="CUSTOM">Custom Application Audit Log</option>
                            </select>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                                Description (Optional)
                            </label>
                            <textarea
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Telemetry provenance, collection window, ingestion notes..."
                                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={uploading || !file}
                            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {uploading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Uploading & Computing SHA-256...
                                </>
                            ) : (
                                <>
                                    Upload & Proceed to Schema Detection
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}

            {/* Step 2: Schema Detection Preview */}
            {currentStep === 2 && schema && (
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Layers className="w-5 h-5 text-cyan-400" />
                                Step 2: Schema Detection Results
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">
                                Inferred {schema.columns.length} columns from {schema.estimated_total_rows} estimated records.
                            </p>
                        </div>
                        <button
                            onClick={() => setCurrentStep(3)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition"
                        >
                            Proceed to Column Mapping
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900/70 text-xs font-mono uppercase text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="py-2.5 px-4">Column Name</th>
                                    <th className="py-2.5 px-4">Inferred Data Type</th>
                                    <th className="py-2.5 px-4">Null Count</th>
                                    <th className="py-2.5 px-4">Sample Values Preview</th>
                                    <th className="py-2.5 px-4">Auto-Mapped Field</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                                {schema.columns.map((col) => {
                                    const mapped = columnMapping[col.column_name];
                                    return (
                                        <tr key={col.column_name} className="hover:bg-slate-900/40">
                                            <td className="py-2.5 px-4 font-bold text-slate-200">{col.column_name}</td>
                                            <td className="py-2.5 px-4">
                                                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                                                    {col.inferred_type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-400">{col.null_count}</td>
                                            <td className="py-2.5 px-4 text-slate-400 max-w-xs truncate">
                                                {col.sample_values?.join(", ") || "-"}
                                            </td>
                                            <td className="py-2.5 px-4">
                                                {mapped ? (
                                                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        {mapped}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 italic">Unmapped</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Step 3: Interactive Column Mapping */}
            {currentStep === 3 && schema && (
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Table className="w-5 h-5 text-cyan-400" />
                                Step 3: Authoritative Column Mapping
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">
                                Align incoming log columns to canonical SecurityEvent fields for deterministic normalization.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCurrentStep(2)}
                                className="px-3 py-1.5 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs transition"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSaveMapping}
                                disabled={mappingSaving}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                                {mappingSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save & Run Validation"}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {CANONICAL_FIELDS.map((field) => {
                            const currentMappedCol = Object.keys(columnMapping).find(
                                (col) => columnMapping[col] === field.key
                            );

                            return (
                                <div
                                    key={field.key}
                                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-slate-200 text-sm">{field.label}</span>
                                            {field.required ? (
                                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                    Required
                                                </span>
                                            ) : (
                                                <span className="text-[10px] uppercase font-mono text-slate-500">Optional</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">{field.desc}</p>
                                    </div>

                                    <div className="mt-3">
                                        <select
                                            value={currentMappedCol || ""}
                                            onChange={(e) => {
                                                const selectedCol = e.target.value;
                                                const next = { ...columnMapping };
                                                // Remove existing mapping for this canonical field
                                                Object.keys(next).forEach((k) => {
                                                    if (next[k] === field.key) delete next[k];
                                                });
                                                if (selectedCol) {
                                                    next[selectedCol] = field.key;
                                                }
                                                setColumnMapping(next);
                                            }}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                                        >
                                            <option value="">-- Unmapped --</option>
                                            {schema.columns.map((col) => (
                                                <option key={col.column_name} value={col.column_name}>
                                                    {col.column_name} ({col.inferred_type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step 4: Data Validation & Quality Score */}
            {currentStep === 4 && (
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Shield className="w-5 h-5 text-cyan-400" />
                                Step 4: Deterministic 4-Pillar Data Quality Validation
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">
                                Evaluates row validity, completeness, schema conformity, and uniqueness.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => runValidation()}
                                disabled={validating}
                                className="px-3 py-1.5 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs transition flex items-center gap-1.5"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${validating ? "animate-spin" : ""}`} />
                                Re-run Validation
                            </button>
                            <button
                                onClick={() => setCurrentStep(5)}
                                disabled={validating || !validation || validation.validation_summary?.valid_records === 0}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                                Proceed to Event Ingestion
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {validating ? (
                        <div className="py-16 text-center text-slate-400 space-y-3">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
                            <p className="text-base font-medium text-slate-200">Executing Data Quality Assessment...</p>
                            <p className="text-xs text-slate-500">
                                Checking IP formats, timestamps, schema mappings, and duplicate rows...
                            </p>
                        </div>
                    ) : validation ? (
                        <div className="space-y-6">
                            {/* Quality Score Hero Card */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/60 p-6 rounded-xl border border-slate-800">
                                <div className="space-y-1">
                                    <span className="text-xs font-mono uppercase text-slate-400">Quality Score</span>
                                    <div className="text-4xl font-extrabold font-mono text-cyan-400">
                                        {validation.quality_score.toFixed(1)}%
                                    </div>
                                    <span
                                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono uppercase border ${
                                            validation.quality_score >= 85
                                                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                                                : validation.quality_score >= 70
                                                ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                                                : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                        }`}
                                    >
                                        Rating: {validation.quality_rating}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-mono uppercase text-slate-400">Row Health</div>
                                    <div className="text-sm text-slate-300 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Total Evaluated:</span>
                                            <span className="font-mono font-bold text-white">
                                                {validation.validation_summary.total_records}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-emerald-400">
                                            <span>Valid Records:</span>
                                            <span className="font-mono font-bold">
                                                {validation.validation_summary.valid_records}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-rose-400">
                                            <span>Invalid Records:</span>
                                            <span className="font-mono font-bold">
                                                {validation.validation_summary.invalid_records}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-amber-400">
                                            <span>Warnings:</span>
                                            <span className="font-mono font-bold">
                                                {validation.validation_summary.warning_records}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <div className="text-xs font-mono uppercase text-slate-400">4-Pillar Score Formula Breakdown</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                            <span className="text-slate-400 block">Validity (35% wt)</span>
                                            <span className="text-sm font-bold text-emerald-400">
                                                {validation.validation_summary.validity_pct}%
                                            </span>
                                        </div>
                                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                            <span className="text-slate-400 block">Completeness (30% wt)</span>
                                            <span className="text-sm font-bold text-cyan-400">
                                                {validation.validation_summary.completeness_pct}%
                                            </span>
                                        </div>
                                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                            <span className="text-slate-400 block">Conformity (20% wt)</span>
                                            <span className="text-sm font-bold text-blue-400">
                                                {validation.validation_summary.conformity_pct}%
                                            </span>
                                        </div>
                                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                            <span className="text-slate-400 block">Uniqueness (15% wt)</span>
                                            <span className="text-sm font-bold text-indigo-400">
                                                {validation.validation_summary.uniqueness_pct}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error / Warning Table Preview */}
                            {validation.error_log && validation.error_log.length > 0 && (
                                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                                    <div className="p-3 bg-slate-900/60 border-b border-slate-800 text-xs font-mono uppercase text-slate-400 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                        Validation Findings & Row Warnings ({validation.error_log.length})
                                    </div>
                                    <table className="w-full text-left text-xs font-mono text-slate-300">
                                        <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                                            <tr>
                                                <th className="py-2 px-4">Row #</th>
                                                <th className="py-2 px-4">Status</th>
                                                <th className="py-2 px-4">Detected Issues</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {validation.error_log.slice(0, 10).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-900/40">
                                                    <td className="py-2 px-4 font-bold text-slate-400">{item.row}</td>
                                                    <td className="py-2 px-4">
                                                        <span
                                                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                                item.status === "INVALID"
                                                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                            }`}
                                                        >
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-4 text-slate-300">
                                                        {item.issues?.join(" • ")}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {/* Step 5: Ingest Events Confirmation */}
            {currentStep === 5 && dataset && (
                <div className="max-w-xl mx-auto bg-slate-900/30 border border-slate-800 rounded-xl p-6 lg:p-8 space-y-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                        <Database className="w-6 h-6" />
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-white">Execute Security Event Ingestion</h2>
                        <p className="text-sm text-slate-400 mt-2">
                            Valid records will be ingested into the canonical <code className="text-cyan-400">SecurityEvent</code> table,
                            linked to <span className="font-mono text-slate-200">{dataset.business_id}</span>, and initial analytics distributions calculated.
                        </p>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-left space-y-1.5 text-slate-300">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Target Dataset:</span>
                            <span className="text-cyan-400 font-bold">{dataset.business_id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Dataset Name:</span>
                            <span className="text-white">{dataset.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Records to Ingest:</span>
                            <span className="text-emerald-400 font-bold">{dataset.valid_record_count || dataset.record_count}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => setCurrentStep(4)}
                            className="px-4 py-2.5 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-sm transition"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleRunImport}
                            disabled={importing}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                        >
                            {importing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Ingesting & Calculating Analytics...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirm & Run Ingestion
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 6: Completion */}
            {currentStep === 6 && dataset && (
                <div className="max-w-xl mx-auto bg-slate-900/30 border border-emerald-500/20 rounded-xl p-8 space-y-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-white">Ingestion Successfully Completed</h2>
                        <p className="text-sm text-slate-400 mt-2">
                            Dataset <span className="font-mono text-cyan-400 font-bold">{dataset.business_id}</span> has been ingested into
                            the security telemetry store with import ref <span className="font-mono text-slate-200">{importResult?.business_id}</span>.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                        <div>
                            <span className="text-slate-500 block">Processed</span>
                            <span className="text-lg font-bold text-white">
                                {importResult?.records_processed ?? 0}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Ingested</span>
                            <span className="text-lg font-bold text-emerald-400">
                                {importResult?.records_imported ?? 0}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Rejected</span>
                            <span className="text-lg font-bold text-rose-400">
                                {importResult?.records_rejected ?? 0}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                        <Link
                            href={`/datasets/${dataset.id}`}
                            className="w-full sm:w-auto px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            Open Dataset Dossier
                        </Link>
                        <Link
                            href="/datasets"
                            className="w-full sm:w-auto px-5 py-2.5 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-sm font-medium transition"
                        >
                            Back to Datasets Registry
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
