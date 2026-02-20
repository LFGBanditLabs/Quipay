import { lazy, Suspense, type FC, type ReactNode } from "react";
import { Routes, Route, Outlet, NavLink } from "react-router-dom";
import styles from "./App.module.css";

import Home from "./pages/Home";
import Debugger from "./pages/Debugger.tsx";
import OnboardingTour from "./components/OnboardingTour";

const RouteSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RouteLoader />}>{children}</Suspense>
);

const AppLayout: React.FC = () => (
  <main>
    <Layout.Header
      projectId="My App"
      projectTitle="My App"
      contentRight={
        <>
          <nav style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <NavLink
              to="/dashboard"
              style={{
                textDecoration: "none",
              }}
            >
              {({ isActive }) => (
                <Button
                  variant="tertiary"
                  size="md"
                  disabled={isActive}
                >
                  Dashboard
                </Button>
              )}
            </NavLink>
            <NavLink
              to="/debug"
              style={{
                textDecoration: "none",
              }}
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
    <OnboardingTour />
    <Outlet />
    <footer className={styles.publicFooter}>
      <p>
        © {new Date().getFullYear()} Quipay. Licensed under the{" "}
        <a
          href="https://opensource.org/license/mit"
          target="_blank"
          rel="noopener noreferrer"
        >
          MIT License
        </a>
        .
      </p>
    </footer>
  </main>
);

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
      </Route>
      <Route
        element={
          <RouteSuspense>
            <WalletLayout />
          </RouteSuspense>
        }
      >
        <Route
          path="/dashboard"
          element={
            <RouteSuspense>
              <EmployerDashboard />
            </RouteSuspense>
          }
        />
        <Route
          path="/debug"
          element={
            <RouteSuspense>
              <Debugger />
            </RouteSuspense>
          }
        />
        <Route
          path="/debug/:contractName"
          element={
            <RouteSuspense>
              <Debugger />
            </RouteSuspense>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
