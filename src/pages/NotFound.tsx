import { Link } from "react-router-dom";
import styles from "./NotFound.module.css";

export default function NotFound() {
  return (
    <section className={styles.page} aria-labelledby="not-found-title">
      <div className={styles.backdropGlow} aria-hidden="true" />

      <article className={styles.card}>
        <div
          className={styles.visual}
          role="img"
          aria-label="Centered animated 404 illustration"
        >
          <div className={styles.ringOuter} />
          <div className={styles.ringInner} />
          <div className={styles.coreGlow} />
          <p className={styles.code}>404</p>
        </div>

        <p className={styles.kicker}>Error 404</p>
        <h1 id="not-found-title" className={styles.title}>
          Page not found
        </h1>
        <p className={styles.subtitle}>
          This route does not exist in Quipay. Head back home and continue from
          a valid page.
        </p>

        <Link to="/" className={styles.ctaPrimary}>
          Go Home
        </Link>
      </article>
    </section>
  );
}
