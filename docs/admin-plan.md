# KoodakBook Admin Console — Full Plan

The admin is the operator's console to **(a) support parents, (b) protect children,
(c) run the business, (d) keep content correct.** Every feature traces to a real
stakeholder need. This supersedes the MVP "content CRUD only" scope.

## Today (baseline)
Content CRUD (words/letters/lessons/stories+pages), uploads, a 5-tile dashboard,
the pilot-metrics page, single hardcoded localhost admin. No concept of *people*.

## Needs → capabilities

**Parents** → support: progress drill-down, password reset, billing/plan, trust
& quality, data export/delete (GDPR/COPPA).
**Children** → ensure: safe age-appropriate content, working audio/images, right
difficulty, private data.
**Operator/business** → product health, content production tracking, revenue,
support efficiency, audit trail.

## Foundational (current admin is unsafe for real families)
- **F1 — Admin accounts + RBAC** (`superadmin`, `support`, `content_editor`, `analyst`). Replaces the single hardcoded admin.
- **F2 — Audit log** of every admin action on a user/child. *(shipping first)*
- **F3 — PII minimization + access logging** for minors' data.
- **F4 — Admin session security** (proper auth, expiry, optional 2FA).

## Feature modules
| Mod | Module | Core | Data | Phase |
|---|---|---|---|---|
| A | Product Health Dashboard | KPIs over time (signups, DAU/WAU, activation, retention, gain, conversion) | sessions/progress/placement_history | 1 |
| B | **User & Family Management** | search parents → family → per-child drill-down; reset pw; plan; **delete family**; view-as | users/children/child_* | **0/1** |
| C | Analytics & Insights | cohort retention, funnel, content analytics (hardest words, abandoned stories) | replay_count/box_*/story progress | 1–2 |
| D | Content Management (hardened) | bulk edit, search, validation, preview-as-child, versioning | existing+content_translations | 1 |
| E | **Content Readiness & Production** | what's missing images/native-audio; worklists; native-audio hot-swap UI | audio_assets.source/image_url | 0/1 |
| F | AI Story Moderation | approve/reject/edit AI stories before a child sees them | stories.ai_generated/animation_review | 1 |
| G | Monetization & Entitlements | plan up/down, comp/extend (gifts), refunds, MRR/churn | users.plan/plan_expires_at + billing_events | 2 |
| H | Engagement & Comms | digest trigger, broadcast announcements, targeted nudges | digest + announcements | 2 |
| I | Support & Account Actions | support notes, reset, manual fixes, export/delete | reuses B | 1 |
| J | Curriculum & Pedagogy | inspect/override placement & strands; tune unlock/SR; calibrate difficulty | child_strand_levels/content_items | 2–3 |
| K | Safety/Privacy/Compliance | data-request export/delete, retention, PII access log, consent | data_requests + audit | 1 |
| L | System & Ops | feature flags, job status, health, audit viewer | feature_flags + audit | 2 |

## New tables (additive)
`admin_users`+`admin_roles` (RBAC) · `audit_log` · `announcements` · `support_notes`
· `feature_flags` · `billing_events` · `data_requests` · `content_versions`.
Everything else reads existing tables.

## Security & privacy posture (children's data)
Real admin accounts + roles; support sees minimal child PII unless escalated;
every child-record read/write audit-logged; export/delete flows for COPPA/GDPR-K;
retention limits on `child_sessions`; admin internal (SSH tunnel) + real auth + 2FA.

## Roadmap
- **Phase 0 — Foundation:** F2 audit log *(now)*, then F1 RBAC, F3 PII.
- **Phase 1 — Operate:** B (family + child drill-down), E (content readiness), A (health), I/K (support, export/delete).
- **Phase 2 — Grow:** C analytics, D hardening, F moderation, H comms.
- **Phase 3 — Monetize & tune:** G billing, J curriculum/difficulty, L ops.

## Build order (shipping now)
1. `audit_log` (mig-022) + audit helper.
2. User/Family API: list parents, family detail, child drill-down, plan change,
   password reset, delete family — all audited.
3. Admin UI: Users list, Family detail, Child drill-down, Audit viewer + nav.
Then: RBAC (multi-admin + roles), Content Readiness, Health dashboard.
