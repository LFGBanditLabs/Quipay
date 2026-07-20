/* eslint-disable react-refresh/only-export-components */
/**
 * Compatibility shim for @stellar/design-system
 * Provides Tailwind-based equivalents of all used components.
 * Vite aliases @stellar/design-system → this file.
 */
import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  note?: string;
  error?: string;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const Content: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={`px-6 py-8 sm:px-8 sm:py-10 ${className ?? ""}`}>
    {children}
  </div>
);

const Inset: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={className}>{children}</div>;

export const Layout = { Content, Inset };

// ─── Text ─────────────────────────────────────────────────────────────────────

type TextAs =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "span"
  | "div"
  | "label";
type TextSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
type TextWeight = "regular" | "medium" | "semi-bold" | "bold";

const sizeMap: Record<TextSize, string> = {
  xxs: "text-[11px]",
  xs: "text-[12px]",
  sm: "text-[13px]",
  md: "text-[15px]",
  lg: "text-[18px]",
  xl: "text-[22px]",
  xxl: "text-[28px]",
};
const weightMap: Record<TextWeight, string> = {
  regular: "font-normal",
  medium: "font-medium",
  "semi-bold": "font-semibold",
  bold: "font-bold",
};

export const Text: React.FC<{
  as?: TextAs;
  size?: TextSize;
  weight?: TextWeight;
  variant?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({
  as: Tag = "p",
  size = "md",
  weight = "regular",
  variant,
  children,
  className,
  style,
}) => {
  const colorCls =
    variant === "secondary"
      ? "text-neutral-500"
      : variant === "error"
        ? "text-red-400"
        : "text-white";
  const cls =
    `${sizeMap[size]} ${weightMap[weight]} ${colorCls} ${className ?? ""}`.trim();
  return (
    <Tag className={cls} style={style}>
      {children}
    </Tag>
  );
};

// ─── Button ───────────────────────────────────────────────────────────────────

type BtnVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "tertiary"
  | "error";
type BtnSize = "xs" | "sm" | "md" | "lg";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";
const btnVariants: Record<BtnVariant, string> = {
  primary: "text-black hover:opacity-90",
  secondary:
    "border border-white/[0.1] bg-white/[0.04] text-white hover:bg-white/[0.08]",
  destructive:
    "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20",
  tertiary: "text-neutral-400 hover:text-white",
  error:
    "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20",
};
const btnSizes: Record<BtnSize, string> = {
  xs: "px-2.5 py-1 text-[11px]",
  sm: "px-3.5 py-1.5 text-[12px]",
  md: "px-5 py-2.5 text-[13px]",
  lg: "px-6 py-3 text-[15px]",
};

export const Button: React.FC<{
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  type?: "button" | "submit" | "reset";
}> = ({
  variant = "secondary",
  size = "md",
  disabled,
  onClick,
  children,
  className,
  style,
  id,
  type = "button",
}) => {
  const isPrimary = variant === "primary";
  return (
    <button
      id={id}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className ?? ""}`}
      style={isPrimary ? { backgroundColor: "#facc15", ...style } : style}
    >
      {children}
    </button>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────

export const Card: React.FC<{
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className, style }) => (
  <div
    className={`rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5 ${className ?? ""}`}
    style={style}
  >
    {children}
  </div>
);

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "pending"
  | "highlight";
const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-white/[0.06] text-neutral-400",
  success: "bg-green-500/10 text-green-400",
  warning: "bg-yellow-400/10 text-yellow-400",
  error: "bg-red-500/10 text-red-400",
  pending: "bg-amber-500/10 text-amber-400",
  highlight: "bg-yellow-400/10 text-yellow-400",
};

export const Badge: React.FC<{
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}> = ({ variant = "default", children, className }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeVariants[variant]} ${className ?? ""}`}
  >
    {children}
  </span>
);

// ─── Input ────────────────────────────────────────────────────────────────────

export const Input: React.FC<InputProps> = ({
  label,
  note,
  error,
  className,
  ...props
}) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-[13px] font-semibold text-white">{label}</label>
    )}
    <input
      className={`w-full rounded-xl border bg-black px-4 py-3 text-[14px] text-white placeholder:text-neutral-700 focus:outline-none focus:ring-1 transition-colors ${
        error
          ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
          : "border-white/[0.1] focus:border-yellow-400/40 focus:ring-yellow-400/20"
      } ${className ?? ""}`}
      {...props}
    />
    {note && <p className="text-[11px] text-neutral-600">{note}</p>}
    {error && <p className="text-[11px] text-red-400">{error}</p>}
  </div>
);

// ─── Label ────────────────────────────────────────────────────────────────────

export const Label: React.FC<{
  size?: "sm" | "md" | "lg";
  htmlFor?: string;
  children?: React.ReactNode;
  className?: string;
}> = ({ size = "md", htmlFor, children, className }) => {
  const s =
    size === "sm"
      ? "text-[11px]"
      : size === "lg"
        ? "text-[15px]"
        : "text-[13px]";
  return (
    <label
      htmlFor={htmlFor}
      className={`font-semibold text-white ${s} ${className ?? ""}`}
    >
      {children}
    </label>
  );
};

// ─── Table ────────────────────────────────────────────────────────────────────

export const Table: React.FC<{
  columnLabels?: string[];
  data?: React.ReactNode[][];
  children?: React.ReactNode;
  className?: string;
}> = ({ columnLabels, data, children, className }) => (
  <div
    className={`overflow-x-auto rounded-xl border border-white/[0.07] ${className ?? ""}`}
  >
    <table className="w-full border-collapse text-[13px]">
      {columnLabels && (
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columnLabels.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      {data ? (
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} className="border-b border-white/[0.04] last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-neutral-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ) : (
        <tbody>{children}</tbody>
      )}
    </table>
  </div>
);

// ─── Textarea ─────────────────────────────────────────────────────────────────

export const Textarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    note?: string;
    error?: string;
  }
> = ({ label, note, error, className, ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-[13px] font-semibold text-white">{label}</label>
    )}
    <textarea
      className={`w-full rounded-xl border bg-black px-4 py-3 text-[14px] text-white placeholder:text-neutral-700 focus:outline-none focus:ring-1 transition-colors resize-y min-h-[96px] ${
        error
          ? "border-red-500/50 focus:ring-red-500/20"
          : "border-white/[0.1] focus:border-yellow-400/40 focus:ring-yellow-400/20"
      } ${className ?? ""}`}
      {...props}
    />
    {note && <p className="text-[11px] text-neutral-600">{note}</p>}
    {error && <p className="text-[11px] text-red-400">{error}</p>}
  </div>
);

// ─── Select ───────────────────────────────────────────────────────────────────

export const Select: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }
> = ({ label, className, children, ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-[13px] font-semibold text-white">{label}</label>
    )}
    <select
      className={`w-full rounded-xl border border-white/[0.1] bg-black px-4 py-3 text-[14px] text-white focus:border-yellow-400/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/20 ${className ?? ""}`}
      {...props}
    >
      {children}
    </select>
  </div>
);

// ─── Link ─────────────────────────────────────────────────────────────────────

export const Link: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({
  className,
  children,
  ...props
}) => (
  <a
    className={`text-yellow-400 hover:underline ${className ?? ""}`}
    {...props}
  >
    {children}
  </a>
);

// ─── Loader ───────────────────────────────────────────────────────────────────

export const Loader: React.FC<{ size?: "sm" | "md" | "lg" }> = ({
  size = "md",
}) => {
  const s = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  return (
    <div
      className={`${s} animate-spin rounded-full border-2 border-white/10 border-t-yellow-400`}
    />
  );
};

// ─── Code ─────────────────────────────────────────────────────────────────────

export const Code: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <code
    className={`rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[13px] text-yellow-300 ${className ?? ""}`}
  >
    {children}
  </code>
);

// ─── Alert / Notification ─────────────────────────────────────────────────────

type AlertVariant = "default" | "success" | "warning" | "error" | "info";
const alertVariants: Record<AlertVariant, string> = {
  default: "border-white/[0.1] bg-white/[0.03] text-white",
  success: "border-green-500/20 bg-green-500/8 text-green-400",
  warning: "border-yellow-400/20 bg-yellow-400/8 text-yellow-400",
  error: "border-red-500/20 bg-red-500/8 text-red-400",
  info: "border-blue-500/20 bg-blue-500/8 text-blue-400",
};

export const Alert: React.FC<{
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}> = ({ variant = "default", title, children, className }) => (
  <div
    className={`rounded-xl border p-4 ${alertVariants[variant]} ${className ?? ""}`}
  >
    {title && <p className="mb-1 text-[13px] font-semibold">{title}</p>}
    <div className="text-[13px] opacity-80">{children}</div>
  </div>
);

export const Notification = Alert;

// ─── Modal ────────────────────────────────────────────────────────────────────

export const Modal: React.FC<{
  heading?: string;
  visible?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}> = ({ heading, visible, onClose, children }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111] shadow-2xl">
        {/* Header */}
        {(heading || onClose) && (
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            {heading && (
              <h3 className="text-[15px] font-bold text-white">{heading}</h3>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export const Tooltip: React.FC<{
  content?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ children }) => <>{children}</>;

// ─── Icon ─────────────────────────────────────────────────────────────────────

// Generic icon renderer — accepts a `name` prop and renders a simple SVG placeholder.
// Pages that use Icon.ChevronDown etc. will get an empty span.
const IconComponent: React.FC<{
  name?: string;
  size?: string;
  className?: string;
  color?: string;
}> = ({ className, color }) => (
  <span
    className={`inline-flex items-center justify-center ${className ?? ""}`}
    style={color ? { color } : {}}
  />
);

// Create a proxy so `Icon.SomeName` returns the same component
export const Icon = new Proxy(IconComponent, {
  get: (target, prop) => {
    if (prop in target) return (target as never)[prop];
    return IconComponent;
  },
}) as typeof IconComponent & Record<string, typeof IconComponent>;
