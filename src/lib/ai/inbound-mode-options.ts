const safeInboundModes = ["off", "shadow", "assisted"] as const;

export function getInboundModeOptions(hasAllowlistedNumber: boolean) {
  return hasAllowlistedNumber
    ? [...safeInboundModes, "production"] as const
    : safeInboundModes;
}
