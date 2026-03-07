import React, { useState, useEffect, useRef } from "react";

interface AnimatedCounterProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  label,
  prefix = "",
  suffix = "",
  duration = 2000,
}) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 },
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number | null = null;
    const startValue = 0;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function: easeOutExpo
      const easing = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      const currentCount = Math.floor(
        easing * (value - startValue) + startValue,
      );
      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [hasStarted, value, duration]);

  return (
    <div ref={elementRef} className="flex flex-col items-center text-center">
      <div className="mb-2 bg-gradient-to-r from-[var(--accent)] to-pink-400 bg-clip-text text-[2.5rem] font-extrabold tabular-nums text-transparent">
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        {label}
      </div>
    </div>
  );
};

const StellarLogo = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-6 w-6 text-[var(--text)]"
  >
    <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
  </svg>
);

const SorobanLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const FreighterLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 12c-2.67 0-4.8-1.59-5.71-3.84 1.55-.91 3.52-1.16 5.71-1.16s4.16.25 5.71 1.16C16.8 17.41 14.67 19 12 19z" />
  </svg>
);

const AlbedoLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
    <path d="M12 3L2 12h3v9h14v-9h3L12 3zm0 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
  </svg>
);

const SocialProof: React.FC = () => {
  return (
    <div className="relative z-10 flex w-full flex-col items-center gap-16 px-6 py-24">
      <div className="group inline-flex cursor-default items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 shadow-[0_4px_20px_var(--shadow-color)] backdrop-blur-[8px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-[var(--accent)] hover:shadow-[0_8px_24px_var(--shadow-color)]">
        <StellarLogo />
        <span className="text-sm font-semibold tracking-wide text-[var(--muted)]">
          Built on{" "}
          <strong className="text-[var(--text)]">Stellar Network</strong>
        </span>
      </div>

      <div className="flex w-full max-w-[1000px] flex-wrap items-center justify-center gap-12 sm:gap-12 max-sm:gap-8">
        <div className="group flex cursor-pointer flex-col items-center gap-3 opacity-50 grayscale brightness-120 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:opacity-100 hover:grayscale-0">
          <SorobanLogo />
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
            Soroban
          </span>
        </div>
        <div className="group flex cursor-pointer flex-col items-center gap-3 opacity-50 grayscale brightness-120 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:opacity-100 hover:grayscale-0">
          <FreighterLogo />
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
            Freighter
          </span>
        </div>
        <div className="group flex cursor-pointer flex-col items-center gap-3 opacity-50 grayscale brightness-120 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:opacity-100 hover:grayscale-0">
          <AlbedoLogo />
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
            Albedo
          </span>
        </div>
        <div className="group flex cursor-pointer flex-col items-center gap-3 opacity-50 grayscale brightness-120 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:opacity-100 hover:grayscale-0">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM11 7h2v2h-2V7zm0 4h2v6h-2v-6z" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
            Stellar Aid
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-16">
        <AnimatedCounter value={12480} label="Total Streams" suffix="+" />
        <AnimatedCounter
          value={4250000}
          label="Total Value Streamed"
          prefix="$"
          duration={2500}
        />
      </div>
    </div>
  );
};

export default SocialProof;
