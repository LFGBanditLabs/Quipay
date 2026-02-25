import { Button, Layout } from "@stellar/design-system";
import { NavLink, Outlet } from "react-router-dom";
import ConnectAccount from "../ConnectAccount";
import { WalletProvider } from "../../providers/WalletProvider";
import "@stellar/design-system/build/styles.min.css";

export default function WalletLayout() {
  return (
    <WalletProvider>
      <main>
        <Layout.Header
          projectId="Quipay"
          projectTitle="Quipay"
          contentRight={
            <div className="flex items-center gap-3 [--connect-account-justify:flex-end] max-md:[--connect-account-justify:flex-start] max-md:gap-2">
              <nav className="flex items-center gap-2">
                <NavLink to="/" className="no-underline">
                  {({ isActive }) => (
                    <Button
                      className="whitespace-nowrap"
                      variant="tertiary"
                      size="md"
                      disabled={isActive}
                    >
                      Home
                    </Button>
                  )}
                </NavLink>
                <NavLink to="/dashboard" className="no-underline">
                  {({ isActive }) => (
                    <Button
                      className="whitespace-nowrap"
                      variant="tertiary"
                      size="md"
                      disabled={isActive}
                    >
                      Dashboard
                    </Button>
                  )}
                </NavLink>
                <NavLink to="/debug" className="no-underline">
                  {({ isActive }) => (
                    <Button
                      className="whitespace-nowrap"
                      variant="tertiary"
                      size="md"
                      disabled={isActive}
                    >
                      Debugger
                    </Button>
                  )}
                </NavLink>
              </nav>

              <div>
                <ConnectAccount />
              </div>
            </div>
          }
        />
        <Outlet />
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
      </main>
    </WalletProvider>
  );
}
