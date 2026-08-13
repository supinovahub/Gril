# Current theme snapshot

The existing app already has a warm-neutral product palette and a single clay accent. The new design should refine this system instead of introducing a second unrelated theme.

```css
:root {
  --parchment: #f3f1eb;
  --paper: #fbfaf7;
  --paper-raised: #fffefa;
  --ledger: #e9e5dc;
  --ledger-strong: #d8d2c7;
  --charcoal: #1c211f;
  --charcoal-soft: #4d5551;
  --charcoal-muted: #747b76;
  --charcoal-faint: #a2a7a3;
  --clay: #bd572c;
  --clay-dark: #913e1d;
  --pine: #28624f;
  --pine-soft: #e5f0eb;
  --blueprint: #506873;
  --amber: #9a671d;
  --redline: #a33d36;
  --canvas: var(--parchment);
  --surface: var(--paper-raised);
  --surface-muted: var(--ledger);
  --ink: var(--charcoal);
  --ink-secondary: var(--charcoal-soft);
  --ink-muted: var(--charcoal-muted);
  --ink-faint: var(--charcoal-faint);
  --border: rgba(28, 33, 31, 0.12);
  --border-soft: rgba(28, 33, 31, 0.075);
  --border-strong: rgba(28, 33, 31, 0.2);
  --accent: var(--clay);
  --accent-dark: var(--clay-dark);
  --positive: var(--pine);
  --danger: var(--redline);
  --warning: var(--amber);
  --control-bg: #efede7;
  --control-bg-hover: #e9e6df;
  --control-bg-pressed: #ded9cf;
  --focus-ring: 0 0 0 3px rgba(189, 87, 44, 0.16);
  --radius-control: 8px;
  --radius-sm: 6px;
  --radius-pill: 999px;
  --radius-panel: 16px;
  --radius-large: 22px;
  --content-max: 1380px;
}
```

## Proposed design direction

- Dials: `DESIGN_VARIANCE 7`, `MOTION_INTENSITY 3`, `VISUAL_DENSITY 6`.
- Direction: editorial operations desk for a Brazilian real-estate team; calm, high-contrast, information-first and unmistakably product UI.
- Keep the warm paper/graphite/clay foundation, but create stronger hierarchy through a single dominant ink surface, a clearer selected state, tighter row geometry and fewer competing rounded containers.
- No purple gradients, no generic glass, no decorative dots, no oversized hero treatment and no card grid as the default page grammar.
- Motion is limited to purposeful state changes: active navigation, row hover, focus, expansion and route transitions. Respect `prefers-reduced-motion`.
