# Gril UI redesign direction

## Product read

Gril is a dense B2B real-estate operations product for brokers, managers and owners in Brazil. The visual language must support quick decisions, conversation triage and safe operational controls. Taste anti-slop principles are adapted here to a product workbench: the app should feel authored and calm, while data density and route compatibility win over decorative marketing patterns.

## Direction

**Name:** Ink, paper, signal.

**Dials:** `DESIGN_VARIANCE: 7`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 6`.

The existing warm-neutral palette is worth keeping, but the current page grammar overuses bordered rounded containers and makes every section compete equally. The redesign should create a clearer visual order:

1. graphite navigation and explicit active state;
2. a quiet paper canvas with a narrow content measure;
3. one high-signal clay accent for attention and primary actions;
4. compact, almost editorial worklist rows;
5. fewer, flatter surfaces with borders used as separators;
6. display typography only for page titles, not every card.

## Tokens

```text
canvas       #f3f1eb
surface      #fffefa
surface-soft #fbfaf7
ink          #1c211f
ink-soft     #4d5551
ink-muted    #747b76
line         rgba(28, 33, 31, .12)
accent       #bd572c
accent-dark  #913e1d
positive     #28624f
warning      #9a671d
danger       #a33d36
control      #efede7
```

Shape: control radius 8px, small radius 6px, panel radius 14px maximum, pills only for statuses. Avoid mixing panel radii.

Type: keep Manrope for interface controls and Newsreader for high-level display headings; use a restrained type scale and strong numeric alignment. Never use all-caps for ordinary navigation labels.

Motion: 120–180ms ease-out for hover/focus/selection; no ornamental loops; no scroll listeners; reduced motion disables nonessential transitions.

## Surfaces to redesign first

- authenticated shell/navigation;
- `/app/conversas` worklist;
- `/app` dashboard attention and activity hierarchy.

Preserve routes, aliases, action contracts, role/permission gates, server-side ordering, product copy and accessibility semantics. The Taste Skill is used as a visual quality bar and anti-slop checklist, not as permission to change product behavior.
