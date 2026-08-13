"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  activeClassName,
  className,
  exact = false,
  href,
  aliases = [],
  children,
}: {
  activeClassName: string;
  className: string;
  exact?: boolean;
  href: string;
  aliases?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const matches = (candidate: string) => exact
    ? pathname === candidate
    : pathname === candidate || pathname.startsWith(`${candidate}/`);
  const active = matches(href) || aliases.some(matches);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`${className}${active ? ` ${activeClassName}` : ""}`}
      href={href}
    >
      {children}
    </Link>
  );
}
