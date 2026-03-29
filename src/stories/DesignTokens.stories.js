import "../styles/tokens.css";

const colorTokens = [
  "--token-color-brand-300",
  "--token-color-brand-500",
  "--token-color-brand-600",
  "--token-color-neutral-0",
  "--token-color-neutral-50",
  "--token-color-neutral-300",
  "--token-color-neutral-900",
  "--token-color-success-500",
  "--token-color-warning-500",
  "--token-color-error-500",
  "--token-color-bg-canvas",
  "--token-color-bg-surface",
  "--token-color-text-primary",
  "--token-color-text-muted",
  "--token-color-border-default",
];

const spacingTokens = [
  "--token-space-1",
  "--token-space-2",
  "--token-space-3",
  "--token-space-4",
  "--token-space-5",
  "--token-space-6",
  "--token-space-8",
  "--token-space-10",
];

const radiusTokens = [
  "--token-radius-sm",
  "--token-radius-md",
  "--token-radius-lg",
  "--token-radius-xl",
  "--token-radius-pill",
];

const shadowTokens = [
  "--token-shadow-sm",
  "--token-shadow-md",
  "--token-shadow-lg",
];

const typographyTokens = [
  "--token-font-size-xs",
  "--token-font-size-sm",
  "--token-font-size-md",
  "--token-font-size-lg",
  "--token-font-weight-regular",
  "--token-font-weight-medium",
  "--token-font-weight-semibold",
];

const sectionStyle = {
  border: "1px solid var(--token-color-border-default)",
  borderRadius: "var(--token-radius-lg)",
  background: "var(--token-color-bg-surface)",
  padding: "var(--token-space-4)",
};

const titleStyle = {
  margin: 0,
  marginBottom: "var(--token-space-3)",
  fontSize: "var(--token-font-size-md)",
  color: "var(--token-color-text-primary)",
};

const meta = {
  title: "Design System/Design Tokens",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

export const TokensReference = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--token-color-bg-canvas)",
        color: "var(--token-color-text-primary)",
        padding: "var(--token-space-8)",
        fontFamily: "var(--token-font-family-sans)",
        display: "grid",
        gap: "var(--token-space-6)",
      }}
    >
      <section style={sectionStyle}>
        <h2 style={titleStyle}>Color Tokens</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--token-space-3)",
          }}
        >
          {colorTokens.map((token) => (
            <div
              key={token}
              style={{ display: "grid", gap: "var(--token-space-2)" }}
            >
              <div
                style={{
                  height: "3rem",
                  borderRadius: "var(--token-radius-md)",
                  border: "1px solid var(--token-color-border-default)",
                  background: `var(${token})`,
                }}
              />
              <code style={{ fontSize: "var(--token-font-size-xs)" }}>
                {token}
              </code>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={titleStyle}>Spacing Tokens (4px Grid)</h2>
        <div style={{ display: "grid", gap: "var(--token-space-3)" }}>
          {spacingTokens.map((token) => (
            <div
              key={token}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--token-space-3)",
              }}
            >
              <div
                style={{
                  height: "0.75rem",
                  width: `var(${token})`,
                  background: "var(--token-color-accent)",
                  borderRadius: "var(--token-radius-pill)",
                }}
              />
              <code style={{ fontSize: "var(--token-font-size-xs)" }}>
                {token}
              </code>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={titleStyle}>Radius + Shadow Tokens</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--token-space-4)",
          }}
        >
          {radiusTokens.map((token) => (
            <div
              key={token}
              style={{
                borderRadius: `var(${token})`,
                border: "1px solid var(--token-color-border-default)",
                padding: "var(--token-space-3)",
                background: "var(--token-color-bg-surface-subtle)",
              }}
            >
              <code style={{ fontSize: "var(--token-font-size-xs)" }}>
                {token}
              </code>
            </div>
          ))}

          {shadowTokens.map((token) => (
            <div
              key={token}
              style={{
                borderRadius: "var(--token-radius-md)",
                border: "1px solid var(--token-color-border-default)",
                boxShadow: `var(${token})`,
                padding: "var(--token-space-3)",
                background: "var(--token-color-bg-surface)",
              }}
            >
              <code style={{ fontSize: "var(--token-font-size-xs)" }}>
                {token}
              </code>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={titleStyle}>Typography Tokens</h2>
        <div style={{ display: "grid", gap: "var(--token-space-2)" }}>
          {typographyTokens.map((token) => (
            <div
              key={token}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--token-space-3)",
              }}
            >
              <code
                style={{
                  minWidth: "15rem",
                  fontSize: "var(--token-font-size-xs)",
                }}
              >
                {token}
              </code>
              <span
                style={
                  token.includes("font-size")
                    ? { fontSize: `var(${token})` }
                    : token.includes("font-weight")
                      ? { fontWeight: `var(${token})` }
                      : undefined
                }
              >
                The quick brown fox jumps over the lazy dog.
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
