begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

select extensions.ok(
  position(
    'coalesce(latest_message.created_at, conversation.started_at) as updated_at'
    in lower(pg_get_functiondef('public.inbox_conversation_page(uuid,integer)'::regprocedure))
  ) > 0,
  'Inbox activity uses the latest message creation time with a conversation-start fallback'
);

select extensions.ok(
  position(
    'order by message.created_at desc, message.id desc'
    in lower(pg_get_functiondef('public.inbox_conversation_page(uuid,integer)'::regprocedure))
  ) > 0,
  'Latest message selection is deterministic'
);

select extensions.ok(
  position(
    'conversation.updated_at,'
    in lower(pg_get_functiondef('public.inbox_conversation_page(uuid,integer)'::regprocedure))
  ) = 0,
  'Conversation metadata updates do not become the Inbox activity timestamp'
);

select extensions.ok(
  position(
    'order by row.updated_at desc, row.id'
    in lower(pg_get_functiondef('public.inbox_conversation_page(uuid,integer)'::regprocedure))
  ) > 0,
  'Inbox page remains ordered by last-message activity and deterministic id'
);

select extensions.ok(
  to_regclass('public.messages_conversation_activity_idx') is not null,
  'Latest-message lookup index exists'
);

select extensions.is(
  pg_get_indexdef('public.messages_conversation_activity_idx'::regclass),
  'CREATE INDEX messages_conversation_activity_idx ON public.messages USING btree (conversation_id, created_at DESC, id DESC)',
  'Latest-message lookup index has the expected key order'
);

select extensions.ok(
  (select function.proconfig @> array['search_path=""', 'jit=off']
   from pg_proc function
   where function.oid = 'public.inbox_conversation_page(uuid,integer)'::regprocedure),
  'Inbox page keeps its locked search path and bounded-query JIT setting'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.inbox_conversation_page(uuid,integer)',
    'execute'
  ),
  'authenticated users still cannot bypass the Inbox bootstrap'
);

select * from extensions.finish();
rollback;
