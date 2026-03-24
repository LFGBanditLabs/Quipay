import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary
 * ─────────────
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of the
 * component tree that crashed.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "var(--bg)",
            color: "var(--sds-color-feedback-error, #ef4444)",
            borderRadius: "12px",
            margin: "20px",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h2
            style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}
          >
            Something went wrong
          </h2>
          <p style={{ fontSize: "14px", opacity: 0.8, marginBottom: "24px" }}>
            The application encountered an unexpected error and couldn't
            continue.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload application
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre
              style={{
                marginTop: "24px",
                padding: "12px",
                background: "rgba(0,0,0,0.05)",
                borderRadius: "6px",
                fontSize: "12px",
                textAlign: "left",
                overflowX: "auto",
              }}
            >
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
