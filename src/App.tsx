import { lazy, Suspense } from "react";
import { Routes, Route, Outlet, NavLink } from "react-router-dom";
import OnboardingTour from "./components/OnboardingTour";
import ConnectAccount from "./components/ConnectAccount.tsx";
import { Button, Icon, Layout } from "@stellar/design-system";

const Home = lazy(() => import("./pages/Home"));
const Debugger = lazy(() => import("./pages/Debugger.tsx"));
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const GovernanceOverview = lazy(() => import("./pages/GovernanceOverview"));
const CreateStream = lazy(() => import("./pages/CreateStream"));
const HelpPage = lazy(() => import("./pages/HelpPage.tsx"));
const PayrollDashboard = lazy(() => import("./pages/PayrollDashboard.tsx"));
const TreasuryManager = lazy(() => import("./pages/TreasuryManager"));
const WithdrawPage = lazy(() => import("./pages/withdrawPage.tsx"));

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
