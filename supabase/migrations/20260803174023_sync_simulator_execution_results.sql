create or replace function private.sync_simulator_run_from_execution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update public.simulator_runs
  set status = case
        when new.status = 'completed' then 'completed'
        when new.status in ('failed', 'superseded', 'cancelled') then 'failed'
        else 'queued'
      end,
      output_text = new.output_text,
      output_structured = new.output_structured,
      completed_at = case
        when new.status in ('completed', 'failed', 'superseded', 'cancelled')
          then coalesce(new.completed_at, now())
        else null
      end
  where execution_id = new.id
    and org_id = new.org_id;
  return new;
end;
$$;

revoke all on function private.sync_simulator_run_from_execution() from public, anon, authenticated, service_role;

drop trigger if exists ai_execution_sync_simulator_run on public.ai_executions;
create trigger ai_execution_sync_simulator_run
after update of status, output_text, output_structured, completed_at on public.ai_executions
for each row
execute function private.sync_simulator_run_from_execution();

update public.simulator_runs as simulator
set status = case
      when execution.status = 'completed' then 'completed'
      when execution.status in ('failed', 'superseded', 'cancelled') then 'failed'
      else 'queued'
    end,
    output_text = execution.output_text,
    output_structured = execution.output_structured,
    completed_at = case
      when execution.status in ('completed', 'failed', 'superseded', 'cancelled')
        then coalesce(execution.completed_at, simulator.completed_at, now())
      else null
    end
from public.ai_executions as execution
where simulator.execution_id = execution.id
  and simulator.org_id = execution.org_id;
