import { lazy, Suspense, useState } from "react";
import { Routes, Route, Outlet, NavLink } from "react-router-dom";
import { Layout, Button, Icon, IconButton } from "@stellar/design-system";
import ConnectAccount from "./components/ConnectAccount.tsx";
import ThemeToggle from "./components/ThemeToggle";
import OnboardingTour from "./components/OnboardingTour";
import Footer from "./components/layout/Footer";
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

const Navigation: React.FC<{
  onItemClick?: () => void;
  isMobile?: boolean;
}> = ({ onItemClick, isMobile }) => (
  <nav
    aria-label="Main Navigation"
    className={isMobile ? styles.mobileNav : styles.headerNav}
  >
    <NavLink
      to="/dashboard"
      className={styles.navLink}
      aria-label="Go to Dashboard"
      onClick={onItemClick}
    >
      {({ isActive }) => (
        <Button
          variant="tertiary"
          size="md"
          disabled={isActive}
          className={styles.navButton}
        >
          Dashboard
        </Button>
      )}
    </NavLink>
    <NavLink to="/governance" className={styles.navLink} onClick={onItemClick}>
      {({ isActive }) => (
        <Button
          variant="tertiary"
          size="md"
          disabled={isActive}
          className={styles.navButton}
        >
          Governance
        </Button>
      )}
    </NavLink>
    <NavLink to="/worker" className={styles.navLink} onClick={onItemClick}>
      {({ isActive }) => (
        <Button
          variant="tertiary"
          size="md"
          disabled={isActive}
          className={styles.navButton}
        >
          Worker
        </Button>
      )}
    </NavLink>
    <NavLink
      to="/debug"
      className={styles.navLink}
      aria-label="Go to Debugger"
      onClick={onItemClick}
    >
      {({ isActive }) => (
        <Button
          variant="tertiary"
          size="md"
          disabled={isActive}
          className={styles.navButton}
        >
          <Icon.Code02 size="md" />
          Debugger
        </Button>
      )}
    </NavLink>
  </nav>
);

const AppLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className={styles.appShell}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Layout.Header
        projectId="Quipay"
        projectTitle="Quipay"
        contentRight={
          <div className={styles.headerRight}>
            <div className={styles.desktopOnly}>
              <Navigation />
            </div>
            <ThemeToggle />
            <ConnectAccount />
            <div className={styles.mobileOnly}>
              <IconButton
                variant="default"
                altText={isMenuOpen ? "Close menu" : "Open menu"}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                icon={
                  isMenuOpen ? <Icon.X size="md" /> : <Icon.Menu01 size="md" />
                }
              />
            </div>
          </div>
        }
      />

      {isMenuOpen && (
        <div className={styles.mobileMenuOverlay}>
          <div className={styles.mobileMenu}>
            <Navigation isMobile onItemClick={() => setIsMenuOpen(false)} />
          </div>
        </div>
      )}

      <main id="main-content" tabIndex={-1} className={styles.mainContent}>
        <OnboardingTour />
        <Outlet />
      </main>
      <Footer />
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
