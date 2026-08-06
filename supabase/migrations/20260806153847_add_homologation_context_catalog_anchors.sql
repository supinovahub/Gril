Exit code: 0
Wall time: 0.7 seconds
Output:
begin;

-- The cleanup functions create per-transaction temporary tables with these
-- names. These inaccessible catalog anchors let Supabase's static PL/pgSQL
-- linter resolve the columns; the temporary tables always shadow them at
-- runtime and are dropped on commit.
create table private.hml_context_blockers (reason text primary key);
create table private.hml_context_storage (bucket text not null, path text not null, primary key (bucket, path));
create table private.hml_context_ids (id uuid primary key);
create table private.hml_context_contacts (id uuid primary key);
create table private.hml_context_phones (e164 text primary key);
create table private.hml_context_opportunities (id uuid primary key);
create table private.hml_context_conversations (id uuid primary key);
create table private.hml_context_messages (id uuid primary key);
create table private.hml_context_calls (id uuid primary key);
create table private.hml_context_holds (id uuid primary key);
create table private.hml_context_executions (id uuid primary key);
create table private.hml_context_suggestions (id uuid primary key);
create table private.hml_context_ai_requests (id uuid primary key);
create table private.hml_context_send_requests (id uuid primary key);
create table private.hml_context_reviews (id uuid primary key);
create table private.hml_context_context_versions (id uuid primary key);
create table private.hml_context_qualification_values (id uuid primary key);
create table private.hml_context_submissions (id uuid primary key);
create table private.hml_context_jobs (id uuid primary key);

revoke all on table
  private.hml_context_blockers,
  private.hml_context_storage,
  private.hml_context_ids,
  private.hml_context_contacts,
  private.hml_context_phones,
  private.hml_context_opportunities,
  private.hml_context_conversations,
  private.hml_context_messages,
  private.hml_context_calls,
  private.hml_context_holds,
  private.hml_context_executions,
  private.hml_context_suggestions,
  private.hml_context_ai_requests,
  private.hml_context_send_requests,
  private.hml_context_reviews,
  private.hml_context_context_versions,
  private.hml_context_qualification_values,
  private.hml_context_submissions,
  private.hml_context_jobs
from public, anon, authenticated, service_role;

commit;
