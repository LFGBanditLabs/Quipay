import React, { useState, useEffect, useRef } from "react";
import styles from "./SocialProof.module.css";

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
    <div ref={elementRef} className={styles.metricItem}>
      <div className={styles.metricValue}>
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className={styles.metricLabel}>{label}</div>
    </div>
  );
};

const StellarLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={styles.stellarLogo}>
    <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
  </svg>
);

const SorobanLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={styles.logoSvg}>
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const FreighterLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={styles.logoSvg}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 12c-2.67 0-4.8-1.59-5.71-3.84 1.55-.91 3.52-1.16 5.71-1.16s4.16.25 5.71 1.16C16.8 17.41 14.67 19 12 19z" />
  </svg>
);

const AlbedoLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={styles.logoSvg}>
    <path d="M12 3L2 12h3v9h14v-9h3L12 3zm0 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
  </svg>
);

const SocialProof: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.banner}>
        <StellarLogo />
        <span className={styles.bannerText}>
          Built on <strong>Stellar Network</strong>
        </span>
      </div>

      <div className={styles.logosRow}>
        <div className={styles.logoItem}>
          <SorobanLogo />
          <span className={styles.logoName}>Soroban</span>
        </div>
        <div className={styles.logoItem}>
          <FreighterLogo />
          <span className={styles.logoName}>Freighter</span>
        </div>
        <div className={styles.logoItem}>
          <AlbedoLogo />
          <span className={styles.logoName}>Albedo</span>
        </div>
        <div className={styles.logoItem}>
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={styles.logoSvg}
          >
            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM11 7h2v2h-2V7zm0 4h2v6h-2v-6z" />
          </svg>
          <span className={styles.logoName}>Stellar Aid</span>
        </div>
      </div>

      <div className={styles.metricsContainer}>
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
