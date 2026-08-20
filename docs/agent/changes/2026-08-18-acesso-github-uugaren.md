# Inclusão de colaborador pessoal no GitHub

- Data: 18/08/2026
- Responsável: Codex, por solicitação do usuário
- Branch/PR: `ops/github-uugaren-access`; PR criado na publicação deste registro
- Commit: o commit que contém este arquivo

## Objetivo

Conceder à identidade pessoal `Uugaren` acesso de escrita ao repositório
`supinovahub/Gril`, preservando o acesso existente de `mathdias2020`.

## Antes e depois

- Antes: `Uugaren` tinha somente a leitura pública do repositório;
  `mathdias2020` já tinha permissão `write`.
- Depois: `Uugaren` e `mathdias2020` têm permissão efetiva `write`; a conta
  `supinovahub` continua como proprietária do repositório.

## Escopo executado

- Arquivos: somente este registro operacional.
- Migrations: nenhuma.
- Mudanças externas em Supabase, Vercel, GitHub ou fornecedores: o GitHub
  criou o convite de colaboração para `Uugaren`, o convite foi aceito pela
  própria identidade convidada e a permissão efetiva foi confirmada como
  `write`. Nenhum outro colaborador foi alterado.

## Validação

- Comandos/testes executados: consultas de permissão pela API do GitHub antes
  e depois da inclusão; criação e aceite do convite; `git diff --check`.
- Evidência observada: o convite retornou `201 Created`, o aceite retornou
  `204 No Content` e a consulta final retornou `write` tanto para `Uugaren`
  quanto para `mathdias2020`.
- Validações não executadas e motivo: lint, testes e build não se aplicam,
  porque não houve alteração de código ou configuração da aplicação.

## Impacto operacional

- Deploy necessário: não.
- Migração aplicada: não.
- Compatibilidade/rollback: a inclusão não altera o produto; se necessário, a
  proprietária do repositório pode remover o colaborador pelo GitHub.

## Pendências e riscos

- Cada desenvolvedor ainda deve conectar sua própria conta GitHub ao respectivo
  Codex e configurar nome, e-mail e autenticação Git locais.
- A separação das identidades de Vercel e Supabase permanece pendente.

## Documentos relacionados

- Decisões atualizadas: nenhuma.
- Guia de homologação atualizado: não se aplica; o fluxo do produto não mudou.
