import { lazy, Suspense, type FC, type ReactNode } from "react";
import { Routes, Route, Outlet, NavLink } from "react-router-dom";
import styles from "./App.module.css";

import Home from "./pages/Home";
const Debugger = lazy(() => import("./pages/Debugger.tsx"));
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const WalletLayout = lazy(() => import("./components/layout/WalletLayout"));

const RouteLoader: FC = () => (
  <div className={styles.routeLoaderWrap}>
    <div className={styles.routeLoader} aria-label="Loading page" />
  </div>
);

const RouteSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<RouteLoader />}>{children}</Suspense>
);

const PublicLayout: FC = () => (
  <main className={styles.publicShell}>
    <header className={styles.publicHeader}>
      <div className={styles.publicBrand}>Quipay</div>
      <nav className={styles.headerNav}>
        <NavLink
          to="/"
          className={({ isActive }) =>
            `${styles.publicNavButton} ${isActive ? styles.publicNavButtonActive : ""}`
          }
          end
        >
          Home
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `${styles.publicNavButton} ${isActive ? styles.publicNavButtonActive : ""}`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/debug"
          className={({ isActive }) =>
            `${styles.publicNavButton} ${isActive ? styles.publicNavButtonActive : ""}`
          }
        >
          Debugger
        </NavLink>
      </nav>
    </header>
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
