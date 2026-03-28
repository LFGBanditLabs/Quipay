import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/accessibility.css";
import "./styles/rtl.css";
import "./i18n/config";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { NotificationProvider } from "./providers/NotificationProvider.tsx";
import { ThemeProvider } from "./providers/ThemeProvider.tsx";
import { NetworkStatusProvider } from "./providers/NetworkStatusProvider.tsx";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "./providers/WalletProvider.tsx";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary region="root">
      <ThemeProvider>
        <NotificationProvider>
          <NetworkStatusProvider>
            <QueryClientProvider client={queryClient}>
              <WalletProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </WalletProvider>
            </QueryClientProvider>
          </NetworkStatusProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
