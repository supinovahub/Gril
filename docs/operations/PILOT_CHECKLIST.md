# Checklist do piloto

## Antes de liberar

- [ ] credenciais de OpenAI e do provedor de WhatsApp validadas pelo autosserviço e armazenadas somente no Supabase Vault;
- [ ] adapter do provedor validado com payload real e assinatura original;
- [ ] envio e recebimento real testados em um número autorizado;
- [ ] health check recente visível antes da ativação;
- [ ] cem casos de regressão executados, com 100% dos 52 críticos aprovados;
- [ ] opt-out, número errado, privacidade e handoff humano testados ponta a ponta;
- [ ] capacidade 10/25/30 e retomada após 5/2 minutos confirmadas;
- [ ] backup do banco confirmado e procedimento de restauração ensaiado;
- [ ] dono e ao menos um corretor aprovados na organização;
- [ ] nenhuma credencial presente em Git ou em tabela pública; somente hint mascarado visível.
- [ ] push habilitado com VAPID e alerta persistente confirmado mesmo quando o push é negado;
- [ ] template de lembrete Meta com variável de link, quando videochamada for usada fora da janela de 24 horas;
- [ ] proteção contra senhas vazadas habilitada no Supabase Auth.

## Liberação controlada

1. Ativar uma única conexão com inbound habilitado e campanhas desabilitadas.
2. Rodar atendimentos internos nos modos sombra e assistido.
3. Cadastrar na Whitelist de produção somente os números internos autorizados para o primeiro teste.
4. Autorizar produção apenas após revisar os casos críticos e comprovar bloqueio server-side de um número fora da whitelist.
5. Liberar a primeira onda com no máximo 20 contatos e revisar 100% das conversas.
6. Liberar manualmente a segunda onda com no máximo 50 contatos, revisando ao menos 30%, somente se os gates estiverem verdes.
7. Nas ondas posteriores, revisar ao menos 10% mais todos os casos obrigatórios de risco.
8. Interromper imediatamente diante de promessa proibida, violação de opt-out, dado sensível exposto, duplicidade de envio ou divergência de capacidade.

## Saída do piloto

- [ ] zero falha crítica aberta;
- [ ] zero envio após opt-out;
- [ ] zero isolamento multi-tenant violado;
- [ ] nenhuma duplicidade com o mesmo idempotency key;
- [ ] custos e filas dentro dos limites definidos;
- [ ] aceite explícito do dono antes de preparar deploy na Vercel.
