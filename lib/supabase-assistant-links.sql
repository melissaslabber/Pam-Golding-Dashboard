create table if not exists public.assistant_agent_links (
  assistant_profile_id uuid not null references public.profiles(id) on delete cascade,
  agent_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (assistant_profile_id, agent_profile_id),
  check (assistant_profile_id <> agent_profile_id)
);

alter table public.assistant_agent_links enable row level security;

drop policy if exists "assistant links visible to involved staff and managers" on public.assistant_agent_links;
create policy "assistant links visible to involved staff and managers"
on public.assistant_agent_links for select to authenticated
using (
  exists (
    select 1 from public.current_staff_profile() me
    where me.role = 'manager'
       or me.profile_id = assistant_profile_id
       or me.profile_id = agent_profile_id
  )
);

drop policy if exists "managers create assistant links" on public.assistant_agent_links;
create policy "managers create assistant links"
on public.assistant_agent_links for insert to authenticated
with check (
  exists (select 1 from public.current_staff_profile() me where me.role = 'manager')
);

drop policy if exists "managers remove assistant links" on public.assistant_agent_links;
create policy "managers remove assistant links"
on public.assistant_agent_links for delete to authenticated
using (
  exists (select 1 from public.current_staff_profile() me where me.role = 'manager')
);

drop policy if exists "assistants view assigned cross-team records" on public.organiser_records;
create policy "assistants view assigned cross-team records"
on public.organiser_records for select to authenticated
using (
  exists (
    select 1
    from public.current_staff_profile() me
    join public.assistant_agent_links link on link.assistant_profile_id = me.profile_id
    join public.profiles agent on agent.id = link.agent_profile_id
    where me.role = 'assistant'
      and agent.team_id = organiser_records.team_id
      and organiser_records.payload ->> 'assigned' = me.short_name
  )
);

drop policy if exists "assistants update assigned cross-team records" on public.organiser_records;
create policy "assistants update assigned cross-team records"
on public.organiser_records for update to authenticated
using (
  exists (
    select 1
    from public.current_staff_profile() me
    join public.assistant_agent_links link on link.assistant_profile_id = me.profile_id
    join public.profiles agent on agent.id = link.agent_profile_id
    where me.role = 'assistant'
      and agent.team_id = organiser_records.team_id
      and organiser_records.payload ->> 'assigned' = me.short_name
  )
)
with check (
  exists (
    select 1
    from public.current_staff_profile() me
    where me.role = 'assistant'
      and organiser_records.payload ->> 'assigned' = me.short_name
  )
);
