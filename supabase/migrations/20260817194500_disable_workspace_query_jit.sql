-- These bounded OLTP queries read at most one Inbox page and a compact
-- dashboard payload. JIT compilation costs more than execution on a fresh
-- PostgREST connection, so keep it disabled only inside these contracts.
alter function public.inbox_conversation_page(uuid, integer) set jit = off;
alter function public.inbox_workspace_bootstrap(uuid, integer) set jit = off;
alter function public.dashboard_workspace_v2(uuid, timestamptz, timestamptz, timestamptz) set jit = off;
alter function public.dashboard_workspace_bootstrap(text, timestamptz, uuid) set jit = off;
