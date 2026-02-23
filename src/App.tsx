import { Routes, Route, Outlet, NavLink } from "react-router-dom";
import { Layout, Button, Icon } from "@stellar/design-system";
import ConnectAccount from "./components/ConnectAccount";
import ThemeToggle from "./components/ThemeToggle";

import Home from "./pages/Home";
import Debugger from "./pages/Debugger.tsx";
import Reports from "./pages/Reports.tsx";
import OnboardingTour from "./components/OnboardingTour";

import EmployerDashboard from "./pages/EmployerDashboard";
import CreateStream from "./pages/CreateStream";
import PayrollDashboard from "./pages/PayrollDashboard.tsx";
import TreasuryManager from "./pages/TreasuryManager";
import WithdrawPage from "./pages/withdrawPage.tsx";

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
          <nav style={{ display: "flex", gap: "0.25rem" }}>
            <NavLink
              to="/reports"
              style={{
                textDecoration: "none",
              }}
            >
              {({ isActive }) => (
                <Button
                  variant="tertiary"
                  size="md"
                  onClick={() => (window.location.href = "/reports")}
                  disabled={isActive}
                >
                  <Icon.Download04 size="md" />
                  Reports
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
            <NavLink to="/governance" style={{ textDecoration: "none" }}>
              {({ isActive }) => (
                <Button variant="tertiary" size="md" disabled={isActive}>
                  Governance
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
          <ThemeToggle />
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
          href="https://opensource.org/license/mit"
          target="_blank"
          rel="noopener noreferrer"
        >
          MIT License
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
        <Route path="/reports" element={<Reports />} />
        <Route path="/dashboard" element={<EmployerDashboard />} />
        <Route path="/payroll" element={<PayrollDashboard />} />
        <Route path="/dashboard" element={<EmployerDashboard />} />
        <Route path="/withdraw" element={<WithdrawPage />} />
        <Route path="/treasury-management" element={<TreasuryManager />} />
        <Route path="/create-stream" element={<CreateStream />} />
        {/* <Route path="/treasury-management" element={<TreasuryManagement />} /> */}
        <Route path="/debug" element={<Debugger />} />
        <Route path="/debug/:contractName" element={<Debugger />} />
      </Route>
    </Routes>
  );
}

export default App;
