import React from "react";
import { Code, Layout, Text } from "@stellar/design-system";
// import { GuessTheNumber } from "../components/GuessTheNumber";

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

      <Text as="h2" size="lg">
        Interact with contracts from the frontend
      </Text>
      <Text as="p" size="md">
        Scaffold stellar automatically builds, deploys, and generates frontend
        packages (sometimes called "TypeScript bindings") for each of your
        contracts. You can adjust how it does this in the{" "}
        <Code size="md">environments.toml</Code> file. Import these frontend
        packages like this:
      </Text>
      <pre>
        <Code size="md">import game from "./contracts/guess_the_number";</Code>
      </pre>
      <Text as="p" size="md">
        If your contract emits events, check out the{" "}
        <Code size="md">useSubscription</Code> hook in the{" "}
        <Code size="md">hooks/</Code> folder to listen to them.
      </Text>
      <Text as="p" size="md">
        As an example, here's the <Code size="md">GuessTheNumber</Code>{" "}
        component. Make changes to the contract and the component and see how
        things change!
      </Text>
      <Text as="h2" size="lg">
        &lt;GuessTheNumber /&gt;
      </Text>
      {/* <GuessTheNumber /> */}
      <Text as="h2" size="lg">
        Interact with wallets
      </Text>
      <Text as="p" size="md">
        This project is already integrated with Stellar Wallet Kit, and the{" "}
        <Code size="md">useWallet</Code> hook is available for you to use in
        your components. You can use it to connect to get connected account
        information.
      </Text>
      <Text as="h2" size="lg">
        Deploy your app
      </Text>
      <Text as="p" size="md">
        To deploy your contracts, use the{" "}
        <Code size="md">stellar registry publish</Code> and
        <Code size="md">stellar registry deploy</Code> commands ( use{" "}
        <Code size="md">stellar registry --help</Code> for more info ) to deploy
        to the appropriate Stellar network.
      </Text>
      <Text as="p" size="md">
        Build your frontend application code with{" "}
        <Code size="md">npm run build</Code> and deploy the output in the
        <Code size="md">dist/</Code> directory.
      </Text>
    </Layout.Inset>
  </Layout.Content>
);

export default Home;
