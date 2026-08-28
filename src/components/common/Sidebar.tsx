import React from "react";
import { NavTab } from "../../types";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Truck,
  Route,
  ReceiptIndianRupee,
  BarChart3,
  LogOut,
  ShieldCheck,
  Building2,
  Menu,
  X,
  BellRing,
  FileSpreadsheet,
} from "lucide-react";

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  urgentAlertsCount?: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  urgentAlertsCount = 0,
  mobileOpen,
  setMobileOpen,
}) => {
  const { user, logout } = useAuth();

  const navigationItems = [
    {
      id: "dashboard" as NavTab,
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: urgentAlertsCount > 0 ? urgentAlertsCount : null,
      badgeColor: "bg-rose-500 text-white",
    },
    {
      id: "lorries" as NavTab,
      label: "Lorry Management",
      icon: Truck,
      badge: null,
    },
    {
      id: "trips" as NavTab,
      label: "Trip Management",
      icon: Route,
      badge: null,
    },
    {
      id: "finances" as NavTab,
      label: "Income & Expenses",
      icon: ReceiptIndianRupee,
      badge: null,
    },
    {
      id: "memos" as NavTab,
      label: "Trip Sheet",
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      id: "reports" as NavTab,
      label: "Reports & Analytics",
      icon: BarChart3,
      badge: null,
    },
  ];

  const handleNavClick = (tabId: NavTab) => {
    setActiveTab(tabId);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-sidebar"
        className={`fixed top-0 left-0 bottom-0 z-40 w-64 bg-[#09090b] border-r border-white/10 text-zinc-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                Lorry TMS
              </h1>
              <span className="text-[11px] font-medium text-blue-400">
                Transport
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-zinc-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Badge */}
        <div className="px-4 py-3 m-3 rounded-xl bg-zinc-900/80 border border-white/5">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-semibold text-zinc-200 truncate">
              {user?.company_name || "Transport Fleet"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="truncate">Operator: {user?.name || "Admin"}</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <div className="px-3 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Main Menu
          </div>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold shadow-xs ${item.badgeColor || "bg-blue-500 text-white"}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Info & Logout Footer */}
        <div className="p-3 border-t border-white/10 bg-[#09090b]/80">
          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/90 border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold text-xs uppercase border border-zinc-700">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-100 truncate">
                  {user?.name || "Lorry Owner"}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  @{user?.username || "admin"}
                </p>
              </div>
            </div>
            <button
              id="logout-button"
              onClick={logout}
              title="Log out of system"
              className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
