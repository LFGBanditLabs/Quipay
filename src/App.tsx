import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import OnboardingTour from "./components/OnboardingTour";
import Footer from "./components/layout/Footer";

const Home = lazy(() => import("./pages/Home"));
const Debugger = lazy(() => import("./pages/Debugger"));
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const GovernanceOverview = lazy(() => import("./pages/GovernanceOverview"));
const CreateStream = lazy(() => import("./pages/CreateStream"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const PayrollDashboard = lazy(() => import("./pages/PayrollDashboard"));
const TreasuryManager = lazy(() => import("./pages/TreasuryManager"));
const WithdrawPage = lazy(() => import("./pages/withdrawPage"));
const Reports = lazy(() => import("./pages/Reports"));
const NotFound = lazy(() => import("./pages/NotFound"));

const TRANSITION_MS = 280;

function AppLoadingFallback() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center px-4 py-16">
      <div className="rounded-2xl border border-white/15 bg-[var(--surface)]/80 px-6 py-5 text-center shadow-[0_18px_40px_-20px_var(--shadow-color)] backdrop-blur-md">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
        <p className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-sm font-semibold text-transparent">
          Loading Quipay Experience
        </p>
      </div>
    </div>
  );
}

function AppRoutes({ location }: { location: ReturnType<typeof useLocation> }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<EmployerDashboard />} />
      <Route path="/payroll" element={<PayrollDashboard />} />
      <Route path="/withdraw" element={<WithdrawPage />} />
      <Route path="/treasury-management" element={<TreasuryManager />} />
      <Route path="/create-stream" element={<CreateStream />} />
      <Route path="/governance" element={<GovernanceOverview />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/debug" element={<Debugger />} />
      <Route path="/debug/:contractName" element={<Debugger />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppLayout() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);

  const locationKey = useMemo(
    () => `${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.pathname, location.search],
  );
  const displayLocationKey = useMemo(
    () =>
      `${displayLocation.pathname}${displayLocation.search}${displayLocation.hash}`,
    [displayLocation.hash, displayLocation.pathname, displayLocation.search],
  );
  const isTransitioning = locationKey !== displayLocationKey;

  useEffect(() => {
    if (!isTransitioning) return;
    const timer = window.setTimeout(() => {
      setDisplayLocation(location);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, TRANSITION_MS);

    return () => window.clearTimeout(timer);
  }, [isTransitioning, location]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <OnboardingTour />
        <div
          className={`w-full transform transition-all duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none ${
            isTransitioning
              ? "pointer-events-none translate-y-2 opacity-0"
              : "translate-y-0 opacity-100"
          }`}
        >
          <Suspense fallback={<AppLoadingFallback />}>
            <AppRoutes location={displayLocation} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return <AppLayout />;
}

export default App;
