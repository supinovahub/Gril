begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

select extensions.is(
  private.campaign_message_cleanup('rentabilizar_com_aluguel_'),
  'rentabilizar com aluguel',
  'normaliza valores da planilha para a mensagem'
);
select extensions.is(
  private.campaign_message_value('{"principal_objetivo":"utilização_própria_"}'::jsonb, 'objetivo'),
  'utilização própria',
  'resolve o objetivo principal do lead'
);
select extensions.is(
  private.campaign_message_context('{"principal_objetivo":"rentabilizar_com_aluguel_","limite_entrada":"100k","limite_parcela":"até_2k","ja_investiu_em_studio":"não"}'::jsonb)->>'objetivo',
  'rentabilizar com aluguel',
  'mapeia rentabilização para uma frase natural'
);
select extensions.is(
  private.campaign_message_context('{"limite_entrada":"100k","limite_parcela":"até_2k"}'::jsonb)->>'orcamento',
  'uma entrada de 100k e uma parcela de até 2k',
  'combina entrada e parcela no fallback de orçamento'
);
select extensions.is(
  private.render_campaign_opening(
    'Olá {{first_name}}: {{objetivo}} / {{orcamento}} / {{ja_investiu_em_studio}}',
    'Maria',
    '{"principal_objetivo":"rentabilizar_com_aluguel_","limite_entrada":"100k","limite_parcela":"até_2k","ja_investiu_em_studio":"não"}'::jsonb
  ),
  'Olá Maria: rentabilizar com aluguel / uma entrada de 100k e uma parcela de até 2k / não',
  'renderiza nome e campos da linha'
);
select extensions.is(
  private.render_campaign_opening('Olá {{first_name}} {{missing}}', 'Maria', '{}'::jsonb),
  'Olá Maria',
  'remove placeholders sem valor'
);
select extensions.is(
  private.campaign_opening_template('[{"id":"investment","template":"Texto de investimento"}]'::jsonb, 'investment', 'fallback'),
  'Texto de investimento',
  'escolhe o template salvo pela variante'
);
select extensions.is(
  private.campaign_opening_template('[]'::jsonb, 'investment', 'fallback'),
  'fallback',
  'mantém compatibilidade com campanha antiga'
);

select * from extensions.finish();
rollback;
