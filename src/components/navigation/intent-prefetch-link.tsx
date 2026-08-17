"use client";

import NextLink from "next/link";
import { useState, type ComponentProps } from "react";

type IntentPrefetchLinkProps = ComponentProps<typeof NextLink>;

export function IntentPrefetchLink({
  onFocus,
  onPointerEnter,
  onTouchStart,
  prefetch,
  ...props
}: IntentPrefetchLinkProps) {
  const [hasIntent, setHasIntent] = useState(false);

  return (
    <NextLink
      {...props}
      onFocus={(event) => {
        setHasIntent(true);
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        setHasIntent(true);
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        setHasIntent(true);
        onTouchStart?.(event);
      }}
      prefetch={hasIntent ? true : prefetch}
    />
  );
}
