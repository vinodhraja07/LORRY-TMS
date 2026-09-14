import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { LoginPage } from "./components/auth/LoginPage";
import { Sidebar } from "./components/common/Sidebar";
import { DashboardView } from "./components/dashboard/DashboardView";
import { LorryManagementView } from "./components/lorries/LorryManagementView";
import { TripManagementView } from "./components/trips/TripManagementView";
import { IncomeExpensesView } from "./components/finances/IncomeExpensesView";
import { ReportsView } from "./components/reports/ReportsView";
import { TripMemoView } from "./components/memos/TripMemoView";
import { ProfileSettingsModal } from "./components/settings/ProfileSettingsModal";
import { NavTab } from "./types";
import { Menu, User, Settings, FileSpreadsheet } from "lucide-react";

const MainLayout: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [urgentAlertsCount, setUrgentAlertsCount] = useState(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Always land on dashboard on initial login
  React.useEffect(() => {
    if (isAuthenticated) {
      setActiveTab("dashboard");
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-medium">Initializing Lorry TMS Engine...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        urgentAlertsCount={urgentAlertsCount}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#09090b]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="lg:hidden font-bold text-sm text-white tracking-tight truncate">
                Lorry TMS
              </span>
              <div className="hidden sm:flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 shrink-0">
                  System Active
                </span>
                <span className="text-zinc-700">•</span>
                <span className="text-xs font-medium text-zinc-400 truncate">
                  Lorry Transport Management System
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => setActiveTab("memos")}
              className="hidden md:flex items-center gap-1.5 text-xs font-medium bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-300 px-3 py-1.5 rounded-xl border border-indigo-700/40 transition-colors"
              title="Open Trip Sheet & Freight Invoice"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
              <span>Trip Sheet</span>
            </button>

            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-zinc-200 bg-zinc-800/90 hover:bg-zinc-800 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl border border-zinc-700/60 transition-colors cursor-pointer group max-w-[170px] sm:max-w-[240px]"
              title="Edit Transport Details & Account"
            >
              <User className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">
                {user?.company_name || user?.name || "Transport Settings"}
              </span>
              <Settings className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white shrink-0 hidden xs:inline-block" />
            </button>
          </div>
        </header>

        {/* Dynamic Route/Tab Content */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
          {activeTab === "dashboard" && <DashboardView setActiveTab={(tab) => setActiveTab(tab)} />}
          {activeTab === "lorries" && <LorryManagementView />}
          {activeTab === "trips" && <TripManagementView />}
          {activeTab === "finances" && <IncomeExpensesView />}
          {activeTab === "memos" && <TripMemoView />}
          {activeTab === "reports" && <ReportsView />}
        </main>
      </div>

      {/* Global Profile & Transport Details Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ToastProvider>
  );
}
