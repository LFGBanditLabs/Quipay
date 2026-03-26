import { lazy, Suspense } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "./components/layout/Navbar";
import OnboardingTour from "./components/OnboardingTour";
import Footer from "./components/layout/Footer";
import WalletGuard from "./components/WalletGuard";

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
const NotFound = lazy(() => import("./pages/NotFound"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const DashboardCustomization = lazy(
  () => import("./pages/DashboardCustomization"),
);
const StreamComparison = lazy(() => import("./pages/StreamComparison"));
const UIPrimitivesPreview = lazy(
  () => import("./pages/UIPrimitivesPreview.tsx"),
);

function AppLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center px-4 py-16">
      <div className="rounded-2xl border border-white/15 bg-[var(--surface)]/80 px-6 py-5 text-center shadow-[0_18px_40px_-20px_var(--shadow-color)] backdrop-blur-md">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
        <p className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-sm font-semibold text-transparent">
          {t("common.loading") || "Loading Quipay Experience"}
        </p>
      </div>
    </div>
  );
}

function AppLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        {t("common.skip_to_content")}
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <OnboardingTour />
        <Suspense fallback={<AppLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
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

          {/* Public Routes */}
          <Route path="/help" element={<HelpPage />} />
          <Route path="/ui-primitives" element={<UIPrimitivesPreview />} />
          <Route path="/debug" element={<Debugger />} />
          <Route path="/debug/:contractName" element={<Debugger />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
