# Variações dinâmicas nas campanhas de reativação

- Data: 06/08/2026
- Status: aprovado por solicitação explícita do produto

## Regra

Campanhas de reativação podem usar até três aberturas diferentes para o mesmo
objetivo: reativar o interesse do lead em investir ou morar em um studio.

Cada linha importada preserva os campos da planilha em `raw_data.fields`. Os
campos conhecidos recebem chaves estáveis para personalização:

- `principal_objetivo` ou `objetivo_studio`;
- `ja_investiu_em_studio`;
- `limite_entrada`;
- `limite_parcela`.

Os templates podem usar `{{first_name}}`, `{{objetivo}}`, `{{entrada}}`,
`{{parcela}}`, `{{orcamento}}` e `{{historico}}`, além das chaves estáveis da
linha. Valores vazios recebem fallback de linguagem e nunca aparecem como
`undefined`, `null` ou placeholder aberto.

## Distribuição e consistência

As variações são atribuídas de forma determinística, em rotação pela ordem das
linhas válidas importadas. O identificador da variação fica salvo em
`campaign_contacts.variant`; o preview e o worker usam o mesmo identificador e
os mesmos campos da linha.

Não há sorteio por envio nem alteração artificial de texto para contornar
políticas de plataforma. A diversidade vem de abordagens de conversa reais e
de dados fornecidos pelo próprio lead.

## Compatibilidade e segurança

Campanhas antigas continuam usando `opening_template` quando não possuem um
pack de variações. Consentimento, janela de envio, opt-out, supressão,
revalidação por contato e ondas permanecem inalterados.
