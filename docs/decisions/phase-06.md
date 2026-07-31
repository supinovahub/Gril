# Fase 6 — qualificação, conhecimento e curadoria

## Escopo entregue

- oito objetivos iniciais de qualificação, versionados por organização;
- valores tipados, fonte, evidência, confiança, validade e histórico append-only;
- conflito seguro: extração da IA não sobrescreve confirmação humana;
- catálogo resumido de empreendimentos, fatos, mídia e FAQ versionada;
- publicação atômica e auditada de FAQ;
- compatibilidade determinística por preço total e entrada mínima;
- ranking secundário por região, entrega e prioridade comercial;
- snapshot dos fatos usados e telas de conhecimento/qualificação do lead.

## Gate da fase

- valor humano confirmado permanece vigente diante de sugestão conflitante da IA;
- empreendimento vencido, inativo ou sem preço/entrada compatíveis não é elegível;
- o resultado registra critérios e fonte usados;
- corretor só lê conhecimento quando possui acesso à oportunidade/conversa/call;
- FAQ e primeira versão são criadas na mesma transação;
- lint, testes unitários e build passaram com 19 rotas.

## Escolha de MVP

O ranking não usa similaridade vetorial. Os critérios comerciais aprovados continuam determinísticos e auditáveis; busca semântica poderá ser adicionada depois sem substituir preço e entrada como filtros mínimos.
