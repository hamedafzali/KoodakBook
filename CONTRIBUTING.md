# Contributing

## Branching convention

To keep the number of branches/PRs in flight small while preserving the ability
to merge, review, and revert unrelated work independently:

> **One branch per deployable behavior change; one shared branch per audit pass
> for everything that doesn't ship runtime behavior.**

Concretely:

- **Give it its own branch** if the change:
  - **(a)** alters runtime or production configuration (a security fix, a rate
    limiter, a bind/port change, a compose change), **or**
  - **(b)** is something you'd want to be able to revert on its own, **or**
  - **(c)** is gated on an external confirmation before it can merge (e.g. a
    dashboard/DNS check, a provisioning step).

- **Batch onto one branch**:
  - all documentation / roadmap / notes output from a single review or audit
    pass, **and**
  - code fixes that touch the **same file** — stack them on one branch rather
    than splitting them into competing PRs that will conflict on merge.

Rationale: the branch boundary should follow *deployable units of behavior*, not
individual findings. A single audit that turns up eight observations should
produce roughly three branches (behavior fixes, one docs branch, anything held
on an external check) — not eight PRs.

## Migrations

- Migrations live in `supabase/migrations/` and are applied in **filename sort
  order**; the runner (`apps/backend/src/lib/migrate.ts`) tracks applied files by
  **full filename** in the `_migrations` table.
- **Numbers must be unique.** Two files sharing a numeric prefix both run (they
  aren't de-duplicated), but the duplicate breaks the number-as-order convention
  and is a trap for anyone who assumes uniqueness. If two in-flight branches pick
  the same number, renumber one before merging.
- Migrations run inside a transaction and roll back on failure. This protects
  against a *failed* migration — it does **not** protect against a *successful
  but wrong* one. A migration that drops columns or overwrites data via `UPDATE`
  is irreversible once committed: on a database without a current restore point,
  take a `pg_dump` first or hold the merge until backups are live.

## Commits

- Do **not** add `Co-Authored-By` trailers to commit messages.
