-- Friends (online play, phase 1). Children connect only via a shared friend
-- code with parent approval — no search, no strangers.

alter table children add column if not exists friend_code text unique;

create table if not exists friendships (
  id                  uuid primary key default gen_random_uuid(),
  requester_child_id  uuid not null references children(id) on delete cascade,
  addressee_child_id  uuid not null references children(id) on delete cascade,
  status              text not null default 'pending'
                        check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (requester_child_id, addressee_child_id),
  check (requester_child_id <> addressee_child_id)
);

create index if not exists friendships_addressee_idx on friendships(addressee_child_id);
create index if not exists friendships_requester_idx on friendships(requester_child_id);
