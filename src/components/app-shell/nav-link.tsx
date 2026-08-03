"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  activeClassName,
  className,
  exact = false,
  href,
  children,
}: {
  activeClassName: string;
  className: string;
  exact?: boolean;
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

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
