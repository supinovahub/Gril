# Produção restaurada para atendimento inbound

- Data: 06/08/2026
- Status: decisão confirmada pelo usuário

## Decisão

O atendimento normal (`inbound`) volta a oferecer os quatro modos `off`,
`shadow`, `assisted` e `production`. `Production` significa que Pedro pode
gerar e enviar respostas automaticamente para conversas inbound elegíveis.

O modo continua desligado por padrão e só pode ser ativado explicitamente pelo
dono da imobiliária. O botão não é um bypass: a alteração passa pelos mesmos
portões técnicos de produção já existentes no banco.

## Portões preservados

Antes de aceitar `production`, o banco continua exigindo:

- identidade institucional completa;
- persona e regras publicadas, qualificação obrigatória e empreendimento válido;
- modelo principal ativo com integração e fallback aprovado;
- conexão WhatsApp inbound ativa e saudável nos últimos 15 minutos;
- regressão aprovada com 100 casos, pelo menos 90% de aprovação e zero falhas críticas.

Antes do envio de cada turno, permanecem as revalidações de conversa ativa,
ownership da IA, capacidade, opt-out, supressão e pausa global.

## Compatibilidade

- `ai_global_mode` e `inbound_ai_mode` permanecem sincronizados pela ação da tela;
- `production` continua permitido para campanhas de reativação;
- a allowlist da reativação continua restrita ao fluxo de campanhas;
- `shadow` e `assisted` mantêm o comportamento de observação e aprovação humana.

Esta decisão substitui a restrição introduzida em 04/08/2026 que removia
`production` do atendimento inbound e o reservava exclusivamente para
reativação.

## Rollout

A mudança de código e a migration devem ser publicadas juntas. Após a
publicação, o dono deve validar primeiro `shadow`, depois `assisted` e só então
`production`, usando o guia completo de homologação.
