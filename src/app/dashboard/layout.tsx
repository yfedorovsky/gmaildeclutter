import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 relative">
          {/* Gradient blobs for liquid glass blur effect */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="absolute top-1/3 -left-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
          </div>
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
