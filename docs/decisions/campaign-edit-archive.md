# Edição e arquivamento de campanhas de reativação

- Data: 06/08/2026
- Status: adotada

## Decisão

Campanhas de reativação podem ser editadas enquanto estão em `draft`, `importing`, `review` ou `approved` sem ondas liberadas. A edição cobre nome, conexão de campanha, modo do Pedro, abertura e template Meta quando aplicável.

Uma edição de campanha `approved` sem ondas retorna o status para `review`, incrementa a versão e exige nova aprovação antes de liberar uma onda. Depois que uma onda foi liberada, a configuração não pode mais ser editada.

Qualquer campanha não arquivada pode ser arquivada. O arquivamento cancela jobs pendentes ou alugados da campanha, exclui contatos ainda prontos ou enfileirados e preserva a campanha para consulta na aba `Arquivadas`. Campanha arquivada não pode ser editada, retomada ou liberada novamente.

## Motivo

Evitar que uma alteração de configuração alcance uma onda já liberada e garantir que arquivamento seja uma parada terminal, auditável e reversível apenas por uma nova campanha, sem reiniciar disparos antigos.
