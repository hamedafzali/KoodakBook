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

## Deploy model

Merging to `main` and deploying to production are **separate steps**. Be precise
about the boundary — we have gotten it wrong twice.

- **Merging to `main` changes nothing in production.** There is no push-triggered
  pipeline; a merge only updates the repository.
- **A deploy happens only when ACM is explicitly invoked** (an
  AdvancedContainerManager pipeline run / deploy call). Nothing deploys on its own,
  and there is no per-PR "approve-prod" gate that a merge trips.
- **A deploy ships whatever `main` holds at that moment** — not the one PR you had
  in mind. It builds from the current tip and runs every pending migration in
  filename order.

That last point is the one that bites: once a change is on `main`, the *next*
deploy carries it to prod — even a deploy triggered for something unrelated. So a
destructive or backup-dependent change (e.g. a data-dropping migration) must be
**held out of `main`**, not merely "held at deploy": merging it arms it for the
next deploy by anyone. This is why such PRs stay unmerged until their precondition
(e.g. live backups) is met — see the Migrations note below.

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
