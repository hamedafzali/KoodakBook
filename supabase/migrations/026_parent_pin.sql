-- KoodakBook — Migration 026: account-bound parent PIN
-- The parent-area PIN was device-local (one localStorage key, shared across every
-- account on the browser and never cleared). Bind it to the account, store it
-- hashed, and add a simple lockout so a 4-digit PIN can't be brute-forced.

alter table users add column if not exists parent_pin_hash      text;
alter table users add column if not exists pin_failed_attempts  int not null default 0;
alter table users add column if not exists pin_locked_until      timestamptz;
