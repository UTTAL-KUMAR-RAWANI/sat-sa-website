"use client";

import React, { useState } from "react";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

export default function PlatformShell({ children }: { children: React.ReactNode }) {
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased">
            {/* Enterprise Navigation Sidebar */}
            <AppSidebar
                isOpenMobile={mobileSidebarOpen}
                onCloseMobile={() => setMobileSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden">
                <AppHeader onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
                <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
