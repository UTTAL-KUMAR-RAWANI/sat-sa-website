import React from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import SecurityPipelineSection from "@/components/landing/SecurityPipelineSection";
import RoleIntelligenceSection from "@/components/landing/RoleIntelligenceSection";
import NegativeSpaceSection from "@/components/landing/NegativeSpaceSection";
import RiskRemediationSection from "@/components/landing/RiskRemediationSection";
import SupervisorySection from "@/components/landing/SupervisorySection";
import ExecutiveSection from "@/components/landing/ExecutiveSection";
import FinalCTASection from "@/components/landing/FinalCTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata = {
    title: "SAT-SA | Supervisory Assessment & Threat Platform",
    description: "Centralized supervisory security assessment and threat-management platform connecting events, alerts, investigations, findings, risk, remediation, and regulatory supervision.",
};

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
            {/* Global Institutional Navbar */}
            <LandingNavbar />

            {/* Main Landing Sections */}
            <main className="flex-1 flex flex-col">
                <HeroSection />
                <SecurityPipelineSection />
                <RoleIntelligenceSection />
                <NegativeSpaceSection />
                <RiskRemediationSection />
                <SupervisorySection />
                <ExecutiveSection />
                <FinalCTASection />
            </main>

            {/* Institutional Footer */}
            <LandingFooter />
        </div>
    );
}
