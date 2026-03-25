import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
}

function Input({
  className,
  type,
  label,
  error,
  hint,
  icon,
  iconPosition = "start",
  id: providedId,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = providedId ?? generatedId;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium leading-none text-foreground"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && iconPosition === "start" && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {icon}
          </div>
        )}
        <InputPrimitive
          id={inputId}
          type={type}
          data-slot="input"
          aria-describedby={
            [
              error ? `${inputId}-error` : null,
              hint && !error ? `${inputId}-hint` : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
            error &&
              "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 dark:border-destructive/50 dark:focus-visible:ring-destructive/40",
            icon && iconPosition === "start" && "pl-10",
            icon && iconPosition === "end" && "pr-10",
            className,
          )}
          {...props}
        />
        {icon && iconPosition === "end" && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {icon}
          </div>
        )}
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export { Input };
