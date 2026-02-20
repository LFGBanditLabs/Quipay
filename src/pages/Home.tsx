import React from "react";
import { Link } from "react-router-dom";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import styles from "./Home.module.css";

const METRICS = [
  {
    label: "Settlement Speed",
    value: "<5s",
  },
  {
    label: "Wallet Support",
    value: "Freighter +",
  },
  {
    label: "Network",
    value: "Stellar",
  },
] as const;

const FEATURES = [
  {
    title: "Continuous Payroll",
    description:
      "Stream salaries by the second so contributors are paid in real-time without payroll cliffs.",
  },
  {
    title: "Recurring Subscriptions",
    description:
      "Automate weekly and monthly subscription payouts with programmable controls and treasury visibility.",
  },
  {
    title: "Wallet-Native Access",
    description:
      "Connect from your preferred Stellar wallet and manage payouts from one dashboard.",
  },
] as const;

const Home: React.FC = () => (
  <>
    <SeoHelmet
      title="Stream Payments on Stellar"
      description="Quipay is a real-time payment streaming platform for teams and subscriptions built on Stellar."
      path="/"
      imagePath="/social/landing-preview.png"
      robots="index,follow"
    />

    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Quipay</p>
        <h1 className={styles.heroTitle}>
          Real-time payment streaming for modern teams.
        </h1>
        <p className={styles.heroDescription}>
          Launch programmable payouts, recurring subscriptions, and treasury
          automation on Stellar with a wallet-first experience.
        </p>

        <div className={styles.ctaRow}>
          <Link
            to="/dashboard"
            className={`${styles.ctaButton} ${styles.primary}`}
          >
            Open Dashboard
          </Link>
          <a
            href="https://stellar.org"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.ctaButton} ${styles.secondary}`}
          >
            Learn Stellar
          </a>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Platform metrics">
        {METRICS.map((metric) => (
          <article key={metric.label} className={styles.metricCard}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className={styles.features} aria-label="Core features">
        {FEATURES.map((feature) => (
          <article key={feature.title} className={styles.featureCard}>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>
    </div>
  </>
);

export default Home;
