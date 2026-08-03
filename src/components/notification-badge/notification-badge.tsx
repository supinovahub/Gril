import styles from "./notification-badge.module.css";

export function NotificationBadge({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={label}
      className={[styles.badge, className].filter(Boolean).join(" ")}
      title={label}
    >
      {count}
    </span>
  );
}
