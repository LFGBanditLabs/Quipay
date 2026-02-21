import { Button, Icon, Layout } from "@stellar/design-system";
import "./App.module.css";
import ConnectAccount from "./components/ConnectAccount.tsx";
import { Routes, Route, Outlet, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Debugger from "./pages/Debugger.tsx";
import OnboardingTour from "./components/OnboardingTour";

import EmployerDashboard from "./pages/EmployerDashboard";
import WorkerDashboard from "./pages/WorkerDashboard";
import CreateStream from "./pages/CreateStream";
import HelpPage from "./pages/HelpPage.tsx";
import PayrollDashboard from "./pages/PayrollDashboard.tsx";
import TreasuryManager from "./pages/TreasuryManager";

const AppLayout: React.FC = () => (
  <>
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
    <Layout.Header
      projectId="Quipay"
      projectTitle="Quipay"
      contentRight={
        <>
          <nav
            aria-label="Main Navigation"
            style={{ display: "flex", gap: "8px", alignItems: "center" }}
          >
            <NavLink
              to="/dashboard"
              style={{
                textDecoration: "none",
              }}
              aria-label="Go to Dashboard"
            >
              {({ isActive }) => (
                <Button variant="tertiary" size="md" disabled={isActive}>
                  Dashboard
                </Button>
              )}
            </NavLink>
            <NavLink
              to="/worker"
              style={{
                textDecoration: "none",
              }}
            >
              {({ isActive }) => (
                <Button variant="tertiary" size="md" disabled={isActive}>
                  Worker
                </Button>
              )}
            </NavLink>
            <NavLink
              to="/debug"
              style={{
                textDecoration: "none",
              }}
              aria-label="Go to Debugger"
            >
              {({ isActive }) => (
                <Button
                  variant="tertiary"
                  size="md"
                  onClick={() => (window.location.href = "/debug")}
                  disabled={isActive}
                >
                  <Icon.Code02 size="md" />
                  Debugger
                </Button>
              )}
            </NavLink>
          </nav>
          <ConnectAccount />
        </>
      }
    />
    <main id="main-content" tabIndex={-1} style={{ outline: "none" }}>
      <OnboardingTour />
      <Outlet />
    </main>
    <Layout.Footer>
      <span>
        © {new Date().getFullYear()} Quipay. Licensed under the{" "}
        <a
          href="http://www.apache.org/licenses/LICENSE-2.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apache License, Version 2.0
        </a>
        .
      </span>
    </Layout.Footer>
  </>
);

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<EmployerDashboard />} />
        <Route path="/worker" element={<WorkerDashboard />} />
        <Route path="/payroll" element={<PayrollDashboard />} />

        <Route path="/treasury-management" element={<TreasuryManager />} />
        <Route path="/create-stream" element={<CreateStream />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/debug" element={<Debugger />} />
        <Route path="/debug/:contractName" element={<Debugger />} />
      </Route>
    </Routes>
  );
}

export default App;
