# Primeiro nome nas campanhas de reativação

- Data: 06/08/2026
- Status: aprovado por solicitação explícita do produto

## Regra

As mensagens de abertura de uma campanha de reativação usam sempre somente o
primeiro nome do contato. O valor é congelado no vínculo da campanha:

- quando a linha importada traz um nome válido, usa-se o primeiro termo desse
  nome;
- quando a linha contém um identificador de lead ou não traz nome utilizável,
  usa-se o primeiro termo do nome canônico do CRM.

O preview e o disparo devem usar o mesmo valor. O nome completo do contato no
CRM não é alterado e continua disponível para a equipe.

## Motivo

O telefone continua sendo a chave de deduplicação e de vínculo com o CRM, mas
isso não deve fazer uma campanha de reativação transformar uma abertura com
primeiro nome em uma saudação com nome completo.

## Compatibilidade

Contatos já vinculados a campanhas recebem um snapshot durante a migration de
implementação. Campanhas futuras congelam o primeiro nome no momento da
importação. O fallback evita que imports antigos que salvaram `LEAD-0013` como
nome exibam o identificador na mensagem.
