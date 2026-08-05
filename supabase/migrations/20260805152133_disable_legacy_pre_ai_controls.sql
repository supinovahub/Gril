begin;

revoke all on function public.apply_inbound_control_intent(uuid,text)
from public,anon,authenticated,service_role;

revoke all on function public.apply_inbound_control_intent_before_behavior_v3(uuid,text)
from public,anon,authenticated,service_role;

comment on function public.apply_inbound_control_intent(uuid,text) is
  'LEGADO DESATIVADO: controles comportamentais somente podem ser aplicados após análise contextual estruturada do Pedro.';

comment on function public.apply_inbound_control_intent_before_behavior_v3(uuid,text) is
  'LEGADO DESATIVADO: não chamar antes da execução contextual do Pedro.';

commit;
