import { lazy, Suspense } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import DashboardLayout from "./components/layout/DashboardLayout";
import WalletGuard from "./components/WalletGuard";
import { TooltipProvider } from "./components/ui";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";

// ─── Lazy pages ───────────────────────────────────────────────────────────────

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Debugger = lazy(() => import("./pages/Debugger"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UIPrimitivesPreview = lazy(() => import("./pages/UIPrimitivesPreview"));

// Dashboard pages
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const PayrollDashboard = lazy(() => import("./pages/PayrollDashboard"));
const TreasuryManager = lazy(() => import("./pages/TreasuryManager"));
const TreasuryAnalytics = lazy(() => import("./pages/TreasuryAnalytics"));
const WithdrawPage = lazy(() => import("./pages/WithdrawPage"));
const CreateStream = lazy(() => import("./pages/CreateStream"));
const GovernanceOverview = lazy(() => import("./pages/GovernanceOverview"));
const Reports = lazy(() => import("./pages/Reports"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const WorkforceRegistry = lazy(() => import("./pages/WorkforceRegistry"));
const AddressBook = lazy(() => import("./pages/AddressBook"));
const DashboardCustomization = lazy(
  () => import("./pages/DashboardCustomization"),
);
const StreamTemplates = lazy(() => import("./pages/StreamTemplates"));
const StreamComparison = lazy(() => import("./pages/StreamComparison"));

// ─── Public layout (landing page + help) ─────────────────────────────────────

function PublicLayout() {
  const { t } = useTranslation();
  const { isHelpModalOpen, toggleHelpModal } = useKeyboardShortcuts();

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          {t("common.skip_to_content")}
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <Suspense
            fallback={
              <div className="p-8 text-center text-neutral-500">
                {t("common.loading")}
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        <Footer />
        <KeyboardShortcutsModal
          isOpen={isHelpModalOpen}
          onClose={toggleHelpModal}
        />
      </div>
    </TooltipProvider>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={<div className="p-8 text-center">{t("common.loading")}</div>}
    >
      <Routes>
        {/* ── Public routes (site navbar + footer) ── */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/ui-primitives" element={<UIPrimitivesPreview />} />
          <Route path="/debug" element={<Debugger />} />
          <Route path="/debug/:contractName" element={<Debugger />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* ── Protected routes (dashboard sidebar, no site navbar) ── */}
        <Route element={<DashboardLayout />}>
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
            path="/treasury-analytics"
            element={
              <WalletGuard>
                <TreasuryAnalytics />
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
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
