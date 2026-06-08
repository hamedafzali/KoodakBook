import { test, expect } from "@playwright/test";

test.describe("KoodakBook smoke", () => {
  test("login page renders with email + password + submit", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "ورود" })).toBeVisible();
  });

  test("API content is served through the web proxy (web → backend → db)", async ({ request }) => {
    const res = await request.get("/api/lessons");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const lessons = Array.isArray(body) ? body : body?.data;
    expect(Array.isArray(lessons)).toBeTruthy();
    expect(lessons.length).toBeGreaterThan(0);
  });

  test("recorded Persian audio assets are served", async ({ request }) => {
    const res = await request.get("/audio/words/cat.mp3");
    expect(res.status()).toBe(200);
    expect((res.headers()["content-type"] || "")).toContain("audio");
  });

  test("a new family can sign up and reach onboarding", async ({ page }) => {
    const email = `e2e+${Date.now()}@test.local`;
    await page.goto("/signup");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("test1234");
    await page.getByRole("button", { name: /ثبت|ورود|ادامه/ }).first().click();
    // Signup stores a token and routes into the app (onboarding / child area).
    await expect(page).toHaveURL(/onboarding|child|parent/, { timeout: 15_000 });
  });
});
