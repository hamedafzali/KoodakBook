import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Test fixtures that create real accounts/children through the same
 * web → backend → db proxy the app uses. Each call makes a fresh, unique
 * family so specs stay independent and can run fully in parallel.
 */

export type Family = {
  email: string;
  password: string;
  token: string;
  childId: string;
};

let counter = 0;
function uniqueEmail() {
  // Random entropy + a per-process counter: the counter is only unique within a
  // worker, and two parallel workers can hit the same millisecond, so the random
  // chunk is what actually prevents cross-worker collisions (a dup → 409).
  const rand = Math.random().toString(36).slice(2, 10);
  return `e2e+${Date.now()}-${rand}-${counter++}@test.local`;
}

function unwrap<T>(body: unknown): T {
  // The API wraps everything as { data, error }. Surface the error loudly so a
  // failing fixture points at the real cause instead of a downstream null.
  const b = body as { data: T; error: string | null };
  if (b.error) throw new Error(`API error: ${b.error}`);
  return b.data;
}

export async function signup(request: APIRequestContext, password = "test1234") {
  const email = uniqueEmail();
  const res = await request.post("/api/auth/signup", { data: { email, password } });
  expect(res.status(), "signup should return 201").toBe(201);
  const { token } = unwrap<{ token: string; user_id: string }>(await res.json());
  return { email, password, token };
}

export async function createChild(
  request: APIRequestContext,
  token: string,
  overrides: Partial<{ name: string; birth_year: number; level: number }> = {}
) {
  const res = await request.post("/api/children", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "آزمون", birth_year: 2018, level: 1, ...overrides },
  });
  expect(res.status(), "create child should return 2xx").toBeLessThan(300);
  const child = unwrap<{ id: string; name: string }>(await res.json());

  // /child/home redirects to /onboarding/placement until this is done, so any
  // test that wants real child-home content needs it completed. This is the
  // same direct-API shortcut the real placement quiz ends on (POST
  // /api/placement/result), not a UI flow worth driving here.
  const placementRes = await request.post("/api/placement/result", {
    headers: { Authorization: `Bearer ${token}` },
    data: { child_id: child.id, level: 1, strands: { V: 1, D: 1, F: 1, C: 1 } },
  });
  expect(placementRes.status(), "placement result should return 2xx").toBeLessThan(300);

  return child;
}

/** A ready-to-use family: account + one placed child (see createChild). */
export async function newFamily(request: APIRequestContext): Promise<Family> {
  const { email, password, token } = await signup(request);
  const child = await createChild(request, token);
  return { email, password, token, childId: child.id };
}

/** Authenticated GET that returns the unwrapped data. */
export async function apiGet<T>(request: APIRequestContext, token: string, path: string) {
  const res = await request.get(path, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok(), `GET ${path} should be ok (got ${res.status()})`).toBeTruthy();
  return unwrap<T>(await res.json());
}

/** Authenticated POST that returns the raw response (caller asserts). */
export function apiPost(request: APIRequestContext, token: string, path: string, data: unknown) {
  return request.post(path, { headers: { Authorization: `Bearer ${token}` }, data });
}

/**
 * Put the app into a logged-in state in the browser without driving the login
 * form: seed the same localStorage token the real auth flow stores. pickChild()
 * then falls back to the family's only child.
 *
 * Also sets the kb_session presence cookie that onSignIn() sets in the real
 * flow (see lib/auth.ts) — middleware.ts checks that cookie *server-side* to
 * gate /child, /parent and /onboarding, and can't see localStorage at all. It
 * has to go on the browser context's cookie jar (not document.cookie via
 * addInitScript): middleware decides on the very first request for a gated
 * page.goto(), before any init script has had a document to run in, so a
 * cookie set from inside the page would always be one request too late.
 */
export async function loginAs(page: Page, family: Family) {
  await page.context().addCookies([
    { name: "kb_session", value: "1", url: process.env.BASE_URL || "http://localhost:3001" },
  ]);
  await page.addInitScript((token) => {
    localStorage.setItem("koodakbook_token", token);
    // Skip the first-run tutorial overlay so it doesn't cover content or
    // duplicate the child's name in a second heading.
    localStorage.setItem("koodakbook_seen_tutorial", "1");
  }, family.token);
}

/**
 * Seed the family's translation-language preference the same way
 * /parent/settings writes it (apps/web/src/lib/translation.ts). That screen is
 * PIN-gated and isn't itself under test here, so tests that only care about the
 * resulting story-reader behavior set the key directly instead of driving the
 * PIN UI.
 */
export async function setTranslationLang(page: Page, code: string) {
  await page.addInitScript((c) => {
    localStorage.setItem("koodakbook_translation_lang", c);
  }, code);
}
