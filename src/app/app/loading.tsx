import styles from "./loading.module.css";

export default function ApplicationLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className={styles.page}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>Gril operations</span>
        <span className={styles.title} />
        <span className={styles.subtitle} />
      </div>
      <div className={styles.grid}>
        <span className={styles.card} />
        <span className={styles.card} />
        <span className={styles.card} />
      </div>
      <span className={styles.panel} />
    </div>
  );
}
