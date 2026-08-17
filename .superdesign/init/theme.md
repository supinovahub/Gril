# Tema canônico de produção

## Resumo compacto de tokens

Identidade confirmada em `https://gril-lac.vercel.app/login` em 13/08/2026: título `Entrar | Pedro`, `theme-color` `#1f1b17` e favicon SVG com monograma P em carvão e papel. Esta identidade é uma restrição, não uma direção a explorar.

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
  --radius-control: 8px;
  --radius-panel: 16px;
  --radius-large: 22px;
}
```

- Interface: Manrope, `--font-interface`.
- Display pontual: Newsreader, `--font-display`.
- Canvas claro único; sem dark mode atual.
- Acento principal argila; pinho, âmbar e vermelho apenas para estados semânticos.
- Sombras: borda sutil mais elevação baixa; evitar caixas flutuantes repetidas.
- Breakpoint estrutural do shell: 820px.
- Transições atuais: 120 a 180ms com `--ease-out`; respeitar `prefers-reduced-motion`.

## Fontes brutas

- Tokens globais completos: `src/app/globals.css`.
- Shell desktop/mobile completo: `src/components/app-shell/app-shell.module.css`.
- Dashboard atual: `src/app/app/dashboard.module.css`.
- Metadados: `src/app/layout.tsx`, `src/app/manifest.ts` e `src/app/icon.svg`.
