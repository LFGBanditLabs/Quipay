import { Button, Layout } from "@stellar/design-system";
import { NavLink, Outlet } from "react-router-dom";
import ConnectAccount from "../ConnectAccount";
import { WalletProvider } from "../../providers/WalletProvider";
import styles from "../../App.module.css";
import "@stellar/design-system/build/styles.min.css";

export default function WalletLayout() {
  return (
    <WalletProvider>
      <main>
        <Layout.Header
          projectId="Quipay"
          projectTitle="Quipay"
          contentRight={
            <div className={styles.headerRight}>
              <nav className={styles.headerNav}>
                <NavLink to="/" className={styles.navLink}>
                  {({ isActive }) => (
                    <Button
                      className={styles.navButton}
                      variant="tertiary"
                      size="md"
                      disabled={isActive}
                    >
                      Home
                    </Button>
                  )}
                </NavLink>
                <NavLink to="/dashboard" className={styles.navLink}>
                  {({ isActive }) => (
                    <Button
                      className={styles.navButton}
                      variant="tertiary"
                      size="md"
                      disabled={isActive}
                    >
                      Dashboard
                    </Button>
                  )}
                </NavLink>
                <NavLink to="/debug" className={styles.navLink}>
                  {({ isActive }) => (
                    <Button
                      className={styles.navButton}
                      variant="tertiary"
                      size="md"
                      disabled={isActive}
                    >
                      Debugger
                    </Button>
                  )}
                </NavLink>
              </nav>

              <div className={styles.connectArea}>
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
