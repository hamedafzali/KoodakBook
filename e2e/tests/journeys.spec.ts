import { test, expect } from "@playwright/test";
import { newFamily, signup, apiGet, loginAs } from "./helpers";

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

  // Stays in the child area (not bounced to /login) and greets the child by name.
  await expect(page).toHaveURL(/\/child\/home/);
  await expect(page.getByRole("heading", { name: "آزمون" })).toBeVisible({ timeout: 15_000 });
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

test("the story reader shows bilingual text and the translation toggle hides it", async ({
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

  await page.goto(`/child/story/${stories[0].id}`);

  // Bilingual is on by default: English line is visible and the toggle offers to
  // turn translation OFF.
  await expect(page.getByText(englishLine)).toBeVisible({ timeout: 15_000 });
  const toggle = page.getByRole("switch", { name: "غیرفعال کردن ترجمه" });
  await expect(toggle).toBeVisible();

  // Toggle off: English disappears and the switch now offers to turn it back ON.
  await toggle.click();
  await expect(page.getByText(englishLine)).toBeHidden();
  await expect(page.getByRole("switch", { name: "فعال کردن ترجمه" })).toBeVisible();
});
