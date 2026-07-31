# Fase 1 — identidade e isolamento

## Escopo

- autenticação por e-mail e senha, confirmação e recuperação;
- perfil com nome e WhatsApp operacional;
- organizações, operações, vínculos, papéis e permissões granulares;
- convite individual e link geral;
- aprovação, suspensão, reativação e revogação transacionais;
- RLS por organização e operação;
- auditoria mínima das mudanças administrativas;
- shell local para validação humana.

## Decisões

1. `memberships` é a fonte de verdade de autorização. `user_metadata` só pode preencher dados de exibição.
2. O link geral cria vínculo `pending` e não libera dados. Convite individual só ativa o e-mail confirmado que foi convidado.
3. O cliente nunca atualiza `memberships` diretamente. Mudanças passam por `membership_change_requests` e um trigger privado auditável.
4. Owners e managers veem todas as operações da organização; brokers veem apenas as operações atribuídas.
5. O schema `private` não é exposto à Data API. Funções `SECURITY DEFINER` têm `search_path` fixo e grants mínimos.
6. A única base remota é usada como desenvolvimento durante o MVP. Vercel fica fora do escopo até a versão final.

## Gate da fase

- conta sem vínculo não enxerga dados;
- vínculo pendente continua sem acesso;
- owner acessa organização e operação;
- broker não acessa outra operação ou organização;
- Advisors sem alertas de schema/RLS; a proteção de senhas vazadas do Auth fica como ajuste de painel antes da produção;
- lint, testes, build e smoke test local aprovados.

## Evidência de validação

- owner enxerga e administra apenas a própria organização;
- broker enxerga somente o próprio vínculo e a operação atribuída;
- usuário pendente aceita o link geral, permanece sem dados e é redirecionado para `aguardando-aprovacao`;
- owner de outra organização não enxerga o tenant principal;
- login, dashboard, equipe e perfil foram validados no localhost em desktop e mobile;
- axe WCAG A/AA: zero violações nas superfícies principais;
- lint, 7 testes, build de produção e `npm audit --omit=dev` aprovados.
