-- Cover the nullable audit foreign key on user_roles for cleanup and audit lookups.
create index user_roles_assigned_by_idx
on public.user_roles (assigned_by)
where assigned_by is not null;
