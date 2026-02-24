import React, { lazy, Suspense } from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { Layout } from "@stellar/design-system";
import Navbar from "./components/layout/Navbar";
import OnboardingTour from "./components/OnboardingTour";
import styles from "./App.module.css";

const Home = lazy(() => import("./pages/Home"));
const Debugger = lazy(() => import("./pages/Debugger.tsx"));
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const GovernanceOverview = lazy(() => import("./pages/GovernanceOverview"));
const CreateStream = lazy(() => import("./pages/CreateStream"));
const HelpPage = lazy(() => import("./pages/HelpPage.tsx"));
const PayrollDashboard = lazy(() => import("./pages/PayrollDashboard.tsx"));
const TreasuryManager = lazy(() => import("./pages/TreasuryManager"));
const WithdrawPage = lazy(() => import("./pages/withdrawPage.tsx"));

const AppLayout: React.FC = () => {
  return (
    <div className={styles.appShell}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />

      <main id="main-content" tabIndex={-1} className={styles.mainContent}>
        <OnboardingTour />
        <Outlet />
      </main>
      <Layout.Footer>
        <div className={styles.footerContent}>
          <span>
            © {new Date().getFullYear()} Quipay. Licensed under the{" "}
            <a
              href="https://opensource.org/license/mit"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License
            </a>
            .
          </span>
        </div>
      </Layout.Footer>
    </div>
  );
};

function App() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>
      }
    >
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<EmployerDashboard />} />
          <Route path="/payroll" element={<PayrollDashboard />} />
          <Route path="/withdraw" element={<WithdrawPage />} />
          <Route path="/treasury-management" element={<TreasuryManager />} />
          <Route path="/create-stream" element={<CreateStream />} />
          <Route path="/governance" element={<GovernanceOverview />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/debug" element={<Debugger />} />
          <Route path="/debug/:contractName" element={<Debugger />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
