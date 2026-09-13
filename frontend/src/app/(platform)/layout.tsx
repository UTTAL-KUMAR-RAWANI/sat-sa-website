import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PlatformShell from "@/components/layout/PlatformShell";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <PlatformShell>{children}</PlatformShell>
        </ProtectedRoute>
    );
}
