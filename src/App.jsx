import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate, useParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import OversightHome from "@/pages/OversightHome";
import OversightSubmit from "@/pages/OversightSubmit";
import OversightAwaiting from "@/pages/OversightAwaiting";
import OversightDepartment from "@/pages/OversightDepartment";
import OversightInvestigation from "@/pages/OversightInvestigation";
import Investigations from "@/pages/Investigations";
import InvestigationDetail from "@/pages/InvestigationDetail";
import DataIngestion from "@/pages/DataIngestion";
import IngestionScreening from "@/pages/IngestionScreening";
import ProcurementVariance from "@/pages/ProcurementVariance";
import HospitalityFraudDetection from "@/pages/HospitalityFraudDetection";
import Alerts from "@/pages/Alerts";
import Settings from "@/pages/Settings";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import OAuthConsent from "@/pages/OAuthConsent";
import TechnicalSupport from "@/pages/TechnicalSupport";
import AIChatbox from "@/pages/AIChatbox";
import CaseManagement from "@/pages/CaseManagement";
import RegulatoryReports from "@/pages/RegulatoryReports";
import AnalyticsInsights from "@/pages/AnalyticsInsights";
import ReportsExports from "@/pages/ReportsExports";
import Integrations from "@/pages/Integrations";
import AuditLog from "@/pages/AuditLog";
import IngestionAuditLog from "@/pages/IngestionAuditLog";
import TeamUsers from "@/pages/TeamUsers";
import OSINTScanner from "@/pages/OSINTScanner";
import VendorVerification from "@/pages/VendorVerification";
import DailyReports from "@/pages/DailyReports";
import ChangePassword from "@/pages/ChangePassword";
import ReliefCalendar from "@/pages/ReliefCalendar";
import ResourceCalculator from "@/pages/ResourceCalculator";
import Organizations from "@/pages/Organizations";
import AdminUsers from "@/pages/AdminUsers";
import GetStarted from "@/pages/GetStarted";
import Platform from "@/pages/Platform";
import Pricing from "@/pages/Pricing";
import About from "@/pages/About";
import Checkout from "@/pages/Checkout";
import { CurrencyProvider } from "@/lib/CurrencyContext";
import { CompanyProfileProvider } from "@/lib/CompanyProfileContext";

function RavenDepartmentRedirect() {
  const { department } = useParams();
  return <Navigate to={`/oversight/${department}`} replace />;
}

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/oauth/consent', '/get-started', '/platform', '/pricing', '/about', '/checkout'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();
  const location = useLocation();
  const isPublicPath = PUBLIC_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Auth routes (login, register, consent, etc.) are always accessible — even
  // when unauthenticated — so the MCP OAuth grant flow can sign in and complete.
  if (!isPublicPath && authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Force password reset for accounts created with admin-assigned passwords
  if (user?.requires_reset && location.pathname !== '/change-password' && !isPublicPath) {
    return <Navigate to="/change-password" replace />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
      <Route path="/get-started" element={<GetStarted />} />
      <Route path="/platform" element={<Platform />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/about" element={<About />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/oauth/consent" element={<OAuthConsent />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/oversight" element={<OversightHome />} />
        <Route path="/oversight/submit" element={<OversightSubmit />} />
        <Route path="/oversight/awaiting-assignment" element={<OversightAwaiting />} />
        <Route path="/oversight/investigation" element={<OversightInvestigation />} />
        <Route path="/oversight/:department" element={<OversightDepartment />} />
        <Route path="/raven" element={<Navigate to="/oversight" replace />} />
        <Route path="/raven/submit" element={<Navigate to="/oversight/submit" replace />} />
        <Route path="/raven/investigation" element={<Navigate to="/oversight/investigation" replace />} />
        <Route path="/raven/:department" element={<RavenDepartmentRedirect />} />
        <Route path="/investigations" element={<Investigations />} />
        <Route path="/investigations/:id" element={<InvestigationDetail />} />
        <Route path="/ingestion" element={<DataIngestion />} />
        <Route path="/ingestion-screening" element={<IngestionScreening />} />
        <Route path="/procurement-variance" element={<ProcurementVariance />} />
        <Route path="/hospitality-fraud-detection" element={<HospitalityFraudDetection />} />
        <Route path="/master-risk-engine" element={<Navigate to="/dashboard" replace />} />
        <Route path="/extraction-review" element={<Navigate to="/dashboard" replace />} />
        <Route path="/entity-intelligence" element={<Navigate to="/dashboard" replace />} />
        <Route path="/entity-intelligence/:id" element={<Navigate to="/dashboard" replace />} />
        <Route path="/autonomous-engine" element={<Navigate to="/dashboard" replace />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/support" element={<TechnicalSupport />} />
        <Route path="/ai-chatbox" element={<AIChatbox />} />
        <Route path="/case-management" element={<CaseManagement />} />
        <Route path="/sanctions-screening" element={<Navigate to="/dashboard" replace />} />
        <Route path="/regulatory-reports" element={<RegulatoryReports />} />
        <Route path="/risk-rules" element={<Navigate to="/dashboard" replace />} />
        <Route path="/analytics" element={<AnalyticsInsights />} />
        <Route path="/network-explorer" element={<Navigate to="/dashboard" replace />} />
        <Route path="/reports-exports" element={<ReportsExports />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/ingestion-audit" element={<IngestionAuditLog />} />
        <Route path="/team" element={<TeamUsers />} />
        <Route path="/collusion-detector" element={<Navigate to="/dashboard" replace />} />
        <Route path="/what-if-sandbox" element={<Navigate to="/dashboard" replace />} />
        <Route path="/insider-threat" element={<Navigate to="/dashboard" replace />} />
        <Route path="/crypto-audit" element={<Navigate to="/dashboard" replace />} />
        <Route path="/osint-scanner" element={<OSINTScanner />} />
        <Route path="/vendor-verification" element={<VendorVerification />} />
        <Route path="/fx-stress-test" element={<Navigate to="/dashboard" replace />} />
        <Route path="/regulatory-horizon" element={<Navigate to="/dashboard" replace />} />
        <Route path="/daily-reports" element={<DailyReports />} />
        <Route path="/hr-dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/activity-stream" element={<Navigate to="/dashboard" replace />} />
        <Route path="/relief-calendar" element={<ReliefCalendar />} />
        <Route path="/resource-calculator" element={<ResourceCalculator />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/onboarding" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <CurrencyProvider>
            <CompanyProfileProvider>
              <AuthenticatedApp />
            </CompanyProfileProvider>
          </CurrencyProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App