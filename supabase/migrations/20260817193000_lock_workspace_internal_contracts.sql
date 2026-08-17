-- Only the route bootstraps are public authenticated entry points. The lower
-- level data contracts remain callable by the bootstrap owner and service role.
revoke execute on function public.inbox_conversation_page(uuid, integer) from authenticated;
revoke execute on function public.dashboard_workspace_v2(uuid, timestamptz, timestamptz, timestamptz) from authenticated;
