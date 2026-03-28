import { lazy, Suspense, useState } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "./components/layout/Navbar";
import OnboardingTour from "./components/OnboardingTour";
import Footer from "./components/layout/Footer";
import WalletGuard from "./components/WalletGuard";
import ErrorBoundary from "./components/ErrorBoundary";
import NotificationCenter from "./components/NotificationCenter";
import BugReportModal from "./components/BugReportModal";
import { TooltipProvider } from "./components/ui";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useGlobalErrorCatcher } from "./hooks/useGlobalErrorCatcher";
import { useTreasuryAlerts } from "./hooks/useTreasuryAlerts";
import { useNetworkAlerts } from "./hooks/useNetworkAlerts";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";

const Home = lazy(() => import("./pages/Home"));
const Debugger = lazy(() => import("./pages/Debugger"));
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const GovernanceOverview = lazy(() => import("./pages/GovernanceOverview"));
const Settings = lazy(() => import("./pages/Settings"));
const CreateStream = lazy(() => import("./pages/CreateStream"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const PayrollDashboard = lazy(() => import("./pages/PayrollDashboard"));
const TreasuryManager = lazy(() => import("./pages/TreasuryManager"));
const WithdrawPage = lazy(() => import("./pages/WithdrawPage"));
const Reports = lazy(() => import("./pages/Reports"));
const TestReceipt = lazy(() => import("./pages/TestReceipt"));
const NotFound = lazy(() => import("./pages/NotFound"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const Analytics = lazy(() => import("./pages/Analytics"));
const WorkforceRegistry = lazy(() => import("./pages/WorkforceRegistry"));
const AddressBook = lazy(() => import("./pages/AddressBook.tsx"));
const DashboardCustomization = lazy(
  () => import("./pages/DashboardCustomization"),
);
const StreamTemplates = lazy(() => import("./pages/StreamTemplates"));
const StreamComparison = lazy(() => import("./pages/StreamComparison"));
const UIPrimitivesPreview = lazy(
  () => import("./pages/UIPrimitivesPreview.tsx"),
);

function AppLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center px-4 py-16">
      <div className="rounded-2xl border border-white/15 bg-(--surface)/80 px-6 py-5 text-center shadow-[0_18px_40px_-20px_var(--shadow-color)] backdrop-blur-md">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
        <p className="bg-linear-to-r from-indigo-400 to-pink-400 bg-clip-text text-sm font-semibold text-transparent">
          {t("common.loading") || "Loading Quipay Experience"}
        </p>
      </div>
    </div>
  );
}

function AppLayout() {
  const { t } = useTranslation();
  const { isHelpModalOpen, toggleHelpModal } = useKeyboardShortcuts();
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);

  // ── Proactive monitoring hooks ──────────────────────────────────────────
  useGlobalErrorCatcher(); // Zero silent failures: catch all unhandled errors
  useTreasuryAlerts(); // Treasury balance threshold alerts
  useNetworkAlerts(); // Network degradation/recovery alerts

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          {t("common.skip_to_content")}
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <OnboardingTour />
          <ErrorBoundary region="page-content">
            <Suspense fallback={<AppLoadingFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
        <KeyboardShortcutsModal
          isOpen={isHelpModalOpen}
          onClose={toggleHelpModal}
        />
        <BugReportModal
          open={isBugReportOpen}
          onClose={() => setIsBugReportOpen(false)}
        />

        {/* Floating action buttons */}
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 900,
          }}
        >
          <NotificationCenter />
          <button
            onClick={() => setIsBugReportOpen(true)}
            title={t("bug_report.title", "Report a Bug")}
            aria-label={t("bug_report.title", "Report a Bug")}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 12px var(--shadow-color, rgba(0,0,0,0.15))",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              color: "var(--text)",
              transition: "transform 0.2s",
            }}
          >
            🐛
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}

function App() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={<div className="p-8 text-center">{t("common.loading")}</div>}
    >
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <WalletGuard>
                <EmployerDashboard />
              </WalletGuard>
            }
          />
          <Route
            path="/payroll"
            element={
              <WalletGuard>
                <PayrollDashboard />
              </WalletGuard>
            }
          />
          <Route
            path="/withdraw"
            element={
              <WalletGuard>
                <WithdrawPage />
              </WalletGuard>
            }
          />
          <Route
            path="/treasury-management"
            element={
              <WalletGuard>
                <TreasuryManager />
              </WalletGuard>
            }
          />
          <Route
            path="/create-stream"
            element={
              <WalletGuard>
                <CreateStream />
              </WalletGuard>
            }
          />
          <Route
            path="/governance"
            element={
              <WalletGuard>
                <GovernanceOverview />
              </WalletGuard>
            }
          />
          <Route
            path="/reports"
            element={
              <WalletGuard>
                <Reports />
              </WalletGuard>
            }
          />
          <Route
            path="/analytics"
            element={
              <WalletGuard>
                <Analytics />
              </WalletGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <WalletGuard>
                <Settings />
              </WalletGuard>
            }
          />
          <Route
            path="/dashboard-customization"
            element={
              <WalletGuard>
                <DashboardCustomization />
              </WalletGuard>
            }
          />
          <Route
            path="/templates"
            element={
              <WalletGuard>
                <StreamTemplates />
              </WalletGuard>
            }
          />
          <Route
            path="/stream-comparison"
            element={
              <WalletGuard>
                <StreamComparison />
              </WalletGuard>
            }
          />

          <Route
            path="/worker"
            element={
              <WalletGuard>
                <WorkerDashboard />
              </WalletGuard>
            }
          />
          <Route
            path="/workforce"
            element={
              <WalletGuard>
                <WorkforceRegistry />
              </WalletGuard>
            }
          />

          <Route
            path="/address-book"
            element={
              <WalletGuard>
                <AddressBook />
              </WalletGuard>
            }
          />

          {/* Public Routes */}
          <Route path="/help" element={<HelpPage />} />
          <Route path="/ui-primitives" element={<UIPrimitivesPreview />} />
          <Route path="/debug" element={<Debugger />} />
          <Route path="/debug/:contractName" element={<Debugger />} />
          {/* Test-only route to trigger a paycheck PDF without wallet auth */}
          <Route path="/__test/receipt" element={<TestReceipt />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
