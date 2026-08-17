# Design QA — Campanhas e Central

- Data: 14/08/2026
- Preview: `https://gril-git-agent-workspace-redesign-real-brio5.vercel.app`
- Estado: proprietário autenticado, operação principal e dados reais; nenhuma ação de escrita executada
- Viewport comparado: 1315 × 1020 px, Chrome do usuário

## Fonte de verdade visual

- Campanhas antes: `C:\Users\arthu\AppData\Roaming\orca\codex-runtime-home\home\state\plugins\product-design\audits\gril-campaigns-central-2026-08-14\01-campanhas-desktop.png`
- Central antes: `C:\Users\arthu\AppData\Roaming\orca\codex-runtime-home\home\state\plugins\product-design\audits\gril-campaigns-central-2026-08-14\02-central-desktop.png`

## Implementação verificada

- Campanhas final: `C:\Users\arthu\AppData\Roaming\orca\codex-runtime-home\home\state\plugins\product-design\design-qa\gril-campanhas-central-2026-08-14\campanhas-desktop-final.png`
- Criação progressiva: `C:\Users\arthu\AppData\Roaming\orca\codex-runtime-home\home\state\plugins\product-design\design-qa\gril-campanhas-central-2026-08-14\campanhas-criacao-desktop.png`
- Central final: `C:\Users\arthu\AppData\Roaming\orca\codex-runtime-home\home\state\plugins\product-design\design-qa\gril-campanhas-central-2026-08-14\central-acao-desktop-final.png`
- Histórico: `C:\Users\arthu\AppData\Roaming\orca\codex-runtime-home\home\state\plugins\product-design\design-qa\gril-campanhas-central-2026-08-14\central-historico-desktop.png`

## Comparação no mesmo input

- Campanhas: `C:\Users\arthu\AppData\Roaming\orca\codex-runtime-home\home\state\plugins\product-design\design-qa\gril-campanhas-central-2026-08-14\comparacao-campanhas-final.png`
- Central: `C:\Users\arthu\AppData\Roaming\orca\codex-runtime-home\home\state\plugins\product-design\design-qa\gril-campanhas-central-2026-08-14\comparacao-central-final.png`

## Passes e achados

### Passo 1

- `P2 — conteúdo`: a Central ainda expunha `Dead letter`, `Internal chat`, `Discussing` e `external_human_intervention`. Corrigido com rótulos operacionais em português.
- `P2 — responsividade`: a lista de Campanhas mantinha quatro colunas por tempo demais quando a navegação lateral reduzia a área útil. Corrigido antecipando o breakpoint para 1380 px e preservando as regras específicas de 900, 700 e 480 px.

### Passo final

- A comparação lado a lado confirma mudança estrutural: Campanhas usa inventário contínuo, ação principal e divulgação progressiva; Central prioriza registros acionáveis e mantém Histórico como segunda camada.
- Tipografia, paleta, ícones, bordas e superfícies permanecem consistentes com o shell aprovado e com a identidade de produção.
- Hierarquia, espaçamento, truncamento, estados, foco semântico e alvos de interação foram revistos na implementação e na preview.
- As interações de abrir a criação de campanha e alternar entre `Precisa agir` e `Histórico` funcionaram com dados reais.
- O console do Chrome retornou zero avisos e zero erros em Campanhas e Central.
- Nenhum achado `P0`, `P1` ou `P2` permaneceu após a segunda publicação.

## Resultado final

passed
