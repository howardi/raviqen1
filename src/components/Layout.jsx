import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom";
import { LayoutDashboard, ShieldAlert, FileSearch, Upload, Settings, LifeBuoy, MessageSquare, Menu, X, Columns3, TrendingUp, Download, Plug, History, Users, Globe, IdCard, ScanSearch, Building2, ClipboardList, Search, Sun, Moon, LogOut, CalendarDays, Calculator, BookOpen, ChevronDown, FileText, ShoppingCart, Hotel } from "lucide-react";
import { buildUserManualPdf, buildUserManualWord } from "@/lib/userManual";
import { cn } from "@/lib/utils";
import { Image } from "@/components/ui/image";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import { canAccessRoute, getRoleLabel, getRoleColor, normalizeUserRole, getRoleHomeRoute, isFullAccessRole } from "@/lib/permissions";
import { needsDepartmentAssignment } from "@/lib/oversight";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";

const navGroups = [
  {
    label: "Raviqen Oversight",
    items: [
      { to: "/oversight", label: "Raviqen Inbox", icon: ClipboardList, end: true },
      { to: "/oversight/investigation", label: "Overall Business Investigation", icon: FileSearch },
    ],
  },
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/alerts", label: "Alerts", icon: ShieldAlert },
    ],
  },
  {
    label: "Investigations",
    items: [
      { to: "/investigations", label: "Investigations", icon: FileSearch },
      { to: "/case-management", label: "Case Management", icon: Columns3 },
    ],
  },
  {
    label: "Data & Analytics",
    items: [
      { to: "/ingestion", label: "Data Ingestion", icon: Upload },
      { to: "/ingestion-audit", label: "Ingestion Audit Log", icon: History },
      { to: "/ingestion-screening", label: "Screening Engine", icon: ScanSearch },
      { to: "/procurement-variance", label: "Procurement Variance", icon: ShoppingCart },
      { to: "/hospitality-fraud-detection", label: "Fraud Detection", icon: Hotel },
      { to: "/analytics", label: "Analytics / Insights", icon: TrendingUp },
    ],
  },
  {
    label: "Autonomous Intelligence",
    items: [
      { to: "/osint-scanner", label: "OSINT Scanner", icon: Globe },
      { to: "/vendor-verification", label: "Vendor Verification", icon: IdCard },
    ],
  },
  {
    label: "Workforce & Operations",
    items: [
      { to: "/daily-reports", label: "Daily Reports", icon: ClipboardList },
    ],
  },
  {
    label: "Utilities & Planning",
    items: [
      { to: "/relief-calendar", label: "Calendar", icon: CalendarDays },
      { to: "/resource-calculator", label: "Resource Calculator", icon: Calculator },
    ],
  },
  {
    label: "Compliance & Reporting",
    items: [
      { to: "/reports-exports", label: "Reports & Exports", icon: Download },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/integrations", label: "Integrations", icon: Plug },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/organizations", label: "Organizations", icon: Building2 },
      { to: "/admin/users", label: "User Management", icon: Users },
      { to: "/team", label: "Team / Users", icon: Users },
      { to: "/audit-log", label: "Audit Log", icon: History },
      { to: "/support", label: "Technical Support", icon: LifeBuoy },
      { to: "/ai-chatbox", label: "AI Chatbox", icon: MessageSquare },
      { action: "user-manual", label: "User Manual", icon: BookOpen },
    ],
  },
];

const RAVIQEN_LOGO_URL = "https://media.base44.com/images/public/6a90b256868de35f9bd5d6b1/da89a92c0_Raviqen.jpeg";

export function RaviquenLogo({ compact = false }) {
  const { profile } = useCompanyProfile();
  const logoUrl = profile?.logo_url || RAVIQEN_LOGO_URL;
  const altText = profile?.company_name || "RAVIQEN — AI Risk & Compliance Intelligence";
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-xl p-3 bg-white shadow-sm",
        compact ? "h-9 w-20" : "w-full h-28"
      )}
    >
      <Image
        src={logoUrl}
        fittingType="fit"
        alt={altText}
        className="block h-full w-full object-contain"
      />
    </div>
  );
}

const ROLE_BADGE_CLASSES = {
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
  violet: "bg-violet-100 text-violet-700",
  teal: "bg-teal-100 text-teal-700",
  cyan: "bg-cyan-100 text-cyan-700",
  slate: "bg-slate-100 text-slate-600",
};

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const role = normalizeUserRole(user);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualMenuOpen, setManualMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("raviqen-theme");
    if (saved) return saved === "dark";
    return false;
  });

  // Close mobile drawer and manual menu on route change
  useEffect(() => {
    setSidebarOpen(false);
    setManualMenuOpen(false);
  }, [location.pathname]);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("raviqen-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("raviqen-theme", "light");
    }
  }, [isDark]);

  const handleLogout = async () => {
    await base44.auth.logout("/");
  };

  // Global search keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Protect routes the user's role can't access — redirect to role-assigned home page
  if (!canAccessRoute(location.pathname, user || role)) {
    return <Navigate to={getRoleHomeRoute(user)} replace />;
  }

  const staffHome = needsDepartmentAssignment(user, role)
    ? { to: "/oversight/awaiting-assignment", label: "Awaiting assignment", icon: ClipboardList }
    : { to: "/oversight/submit", label: "Submit daily report", icon: ClipboardList };
  const visibleNavGroups = isFullAccessRole(role) ? navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.action || canAccessRoute(item.to, user || role)),
    }))
    .filter((group) => group.items.length > 0) : [{ label: "Department reporting", items: [staffHome] }];
  const userInitials = (user?.full_name || user?.email || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const userDisplayName = user?.full_name || (user?.email ? user?.email.split("@")[0].replace(/[._]/g, " ") : "User");
  const roleLabel = getRoleLabel(role);
  const roleBadgeClass = ROLE_BADGE_CLASSES[getRoleColor(role)] || ROLE_BADGE_CLASSES.slate;

  const sidebarContent = (
    <>
      <div className="px-5 py-6 border-b border-slate-100">
        <RaviquenLogo />
      </div>
      {isFullAccessRole(role) && <div className="px-3 pt-3">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 text-sm hover:bg-slate-100 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200">⌘K</kbd>
        </button>
      </div>}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {visibleNavGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                if (item.action === "user-manual") {
                  return (
                    <div key={item.action} className="relative">
                      <button
                        onClick={() => setManualMenuOpen((prev) => !prev)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      >
                        <Icon className="w-[18px] h-[18px]" />
                        {item.label}
                        <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${manualMenuOpen ? "rotate-180" : ""}`} />
                      </button>
                      {manualMenuOpen && (
                        <div className="absolute left-3 right-3 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg z-20 overflow-hidden">
                          <button
                            onClick={() => { buildUserManualPdf(); setManualMenuOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <FileText className="w-4 h-4 text-red-500" />
                            Download PDF
                          </button>
                          <button
                            onClick={() => { buildUserManualWord(); setManualMenuOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
                          >
                            <FileText className="w-4 h-4 text-blue-500" />
                            Download Word
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )
                    }
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-semibold">
            {userInitials}
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-xs font-semibold text-slate-800 capitalize truncate">{userDisplayName}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full inline-block w-fit", roleBadgeClass)}>{roleLabel}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setIsDark((prev) => !prev)}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50/60">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <RaviquenLogo compact />
        <div className="ml-auto">
          {isFullAccessRole(role) && <NotificationBell />}
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-slate-200 flex-col h-screen sticky top-0">
          {sidebarContent}
        </aside>

        {/* Mobile drawer */}
        {sidebarOpen && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
            <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col h-screen">
              <div className="flex justify-end p-2">
                <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-5 h-5 text-slate-700" />
                </button>
              </div>
              {sidebarContent}
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Global Search Command Palette */}
      {isFullAccessRole(role) && <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}