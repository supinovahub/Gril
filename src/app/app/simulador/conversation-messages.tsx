"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ConversationMessages({
  children,
  className,
  version,
}: {
  children: ReactNode;
  className: string;
  version: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [version]);

  return <div className={className} ref={containerRef}>{children}</div>;
}
