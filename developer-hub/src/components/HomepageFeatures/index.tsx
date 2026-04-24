import type { ReactNode } from "react";
import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Real-Time Payroll Streaming",
    description: (
      <>
        Quipay streams salaries to workers continuously — every second — settled
        on-chain via Soroban smart contracts. No more monthly payroll cycles, no
        wire transfers, no delays.
      </>
    ),
  },
  {
    title: "On-Chain Solvency Enforcement",
    description: (
      <>
        The PayrollVault contract enforces that employer treasury balance always
        covers outstanding liabilities. Streams pause automatically when funds
        run low, protecting workers from missed payments.
      </>
    ),
  },
  {
    title: "Built on Stellar Soroban",
    description: (
      <>
        Multi-token support (XLM, USDC, any Stellar asset), batch operations,
        and a permissioned automation-agent framework make Quipay ready for
        enterprises, DAOs, and global remote teams.
      </>
    ),
  },
];

function Feature({ title, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center padding-horiz--md padding-vert--lg">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
