import styles from './landing.module.css';

export default function LandingPage() {
  return (
    <main className={styles.landing}>
      <section className={styles.content} aria-labelledby="landing-title">
        <h1 id="landing-title">3T Ledger</h1>
        <p>Track your accounts, transactions, and budgets in one place.</p>
        <a className={styles.signIn} href="/api/v1/auth/start">Sign in</a>
      </section>
    </main>
  );
}
