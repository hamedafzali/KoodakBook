import { test, expect } from "@playwright/test";
import { newFamily, signup, apiGet, loginAs, setTranslationLang } from "./helpers";

/**
 * Real UI journeys through the rendered app: logging in, the child home, the
 * lesson screen, and the bilingual story reader. Runs on both mobile engines
 * (Chromium + WebKit) since rendering/layout is the point here.
 */

test("a parent can log in with the form and reach the dashboard", async ({ page, request }) => {
  // Create the account through the API, then exercise the real login form.
  const { email, password } = await signup(request);

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "ورود" }).click();

  await expect(page).toHaveURL(/\/parent\/dashboard/, { timeout: 15_000 });
});

test("the child home renders the child's name and learning content", async ({ page, request }) => {
  const fam = await newFamily(request);
  await loginAs(page, fam);

  await page.goto("/child/home");

  // Stays in the child area (not bounced to /login or /onboarding/placement)
  // and greets the child by name. exact: true matters here — the onboarding
  // greeting text ("سلام آزمون! من سیمرغم") contains the fixture's child name
  // as a substring, so a non-exact match can silently pass on the wrong screen.
  await expect(page).toHaveURL(/\/child\/home/);
  await expect(page.getByRole("heading", { name: "آزمون", exact: true })).toBeVisible({ timeout: 15_000 });
});

test("the lesson screen renders the quiz with a progress indicator", async ({ page, request }) => {
  const fam = await newFamily(request);
  await loginAs(page, fam);

  const lessons = await apiGet<{ id: string }[]>(request, fam.token, "/api/lessons");
  expect(lessons.length).toBeGreaterThan(0);

  await page.goto(`/child/lesson/${lessons[0].id}`);

  // The lesson is an interactive quiz; its progress bar is the stable landmark.
  await expect(
    page.getByRole("progressbar", { name: /پیشرفت درس/ })
  ).toBeVisible({ timeout: 15_000 });
});

test("the story reader shows bilingual text, controlled by the parent's language setting", async ({
  page,
  request,
}) => {
  const fam = await newFamily(request);
  await loginAs(page, fam);

  // Pull the first story's first-page English line straight from the API so the
  // assertion matches the seed exactly.
  const stories = await apiGet<{ id: string }[]>(request, fam.token, "/api/stories");
  expect(stories.length).toBeGreaterThan(0);
  const story = await apiGet<{ pages: { text_english: string }[] }>(
    request,
    fam.token,
    `/api/stories/${stories[0].id}`
  );
  const englishLine = story.pages[0].text_english;
  expect(englishLine, "seed story should have English text").toBeTruthy();

  // English is the default translation language: the story reader shows it
  // under the Persian text without any per-story control.
  await page.goto(`/child/story/${stories[0].id}`);
  await expect(page.getByText(englishLine)).toBeVisible({ timeout: 15_000 });

  // Translation is a parent decision (see commit a9b2069), set from
  // /parent/settings — a PIN-gated screen that stores the choice under
  // koodakbook_translation_lang. Seed that key directly, the same way loginAs()
  // seeds the auth token, rather than driving the PIN UI to reach a settings
  // page that isn't itself under test here.
  await setTranslationLang(page, "none");

  await page.goto(`/child/story/${stories[0].id}`);
  await expect(page.getByText(englishLine)).toBeHidden();
});
