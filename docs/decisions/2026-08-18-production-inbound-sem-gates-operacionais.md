# Production inbound sem gates operacionais de perfil, health recente e regressão

- Data: 18/08/2026
- Status: decisão confirmada pelo usuário após explicação do impacto

## Decisão

A ativação explícita de `production` no atendimento inbound normal deixa de
depender de três condições de prontidão:

- completude do perfil institucional;
- health check bem-sucedido do WhatsApp nos últimos quinze minutos;
- regressão aprovada por quantidade, percentual e ausência de falha crítica.

O health check continua existindo como diagnóstico da integração. Para ativar
production, permanece necessário ter ao menos uma conexão WhatsApp com status
`active` e inbound habilitado, sem exigir recência nem ausência do último erro
registrado.

## Controles preservados

- somente o dono pode selecionar `production` explicitamente;
- cadastrar um número na whitelist não altera o modo atual;
- ao menos um número ativo na whitelist é obrigatório para mostrar e salvar a
  opção;
- persona, regras, qualificação, empreendimento e modelos principal/fallback
  continuam sendo portões de ativação;
- no inbound production, a elegibilidade impede execução para destinatário
  fora da whitelist;
- o worker revalida a elegibilidade antes de iniciar;
- o trigger final do banco impede qualquer outbound da IA para contato inbound
  fora da whitelist;
- opt-out, supressão, ownership, pausas e demais controles por turno continuam
  vigentes;
- reativação mantém configuração e release independentes.

## Risco aceito

O usuário aceitou que production possa ser ativado sem perfil institucional
completo, sem uma regressão aprovada e sem teste recente do provedor. Falhas ou
lacunas nesses domínios continuam observáveis, mas não bloqueiam a seleção do
modo. A whitelist não foi relaxada.

## Rollback

Restaurar a versão anterior de `private.enforce_ai_production_readiness()` com
os três gates. O rollback não altera o modo atual, a whitelist, conversas,
mensagens nem a configuração independente de reativação.
