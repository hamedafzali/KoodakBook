import { test, expect } from "@playwright/test";
import { newFamily, signup, createChild, apiGet, apiPost } from "./helpers";

/**
 * Exercises the core learning loop end-to-end through the real
 * web → backend → db stack (same proxy the app uses), asserting the *data*
 * the UI depends on: word mastery (Leitner), lesson/story completion, the
 * spaced-repetition queue, and the derived dashboard. These are the flows that
 * silently regress and would ship a broken build past the smoke layer.
 *
 * Runs once on Chromium only — this is data/stack coverage, not rendering, so
 * there's nothing browser-engine-specific to gain from repeating it on WebKit.
 */
test.describe("learning loop (data through the stack)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "API/data coverage — Chromium only");

  type Word = { id: string };
  type LessonDetail = { id: string; items: { word_id: string | null; word: Word | null }[] };
  type WordProgress = { box: number; status: string };
  type Dashboard = {
    words_learned: number;
    lessons_completed: number;
    stories_completed: number;
    xp: number;
  };

  async function firstLessonWord(request: Parameters<typeof apiGet>[0], token: string) {
    const lessons = await apiGet<{ id: string }[]>(request, token, "/api/lessons");
    expect(lessons.length, "seed should provide lessons").toBeGreaterThan(0);
    // Find a lesson that actually has a word item to drive word progress.
    for (const l of lessons) {
      const detail = await apiGet<LessonDetail>(request, token, `/api/lessons/${l.id}`);
      const item = detail.items.find((it) => it.word_id);
      if (item?.word_id) return { lessonId: detail.id, wordId: item.word_id };
    }
    throw new Error("no lesson with a word item found in seed data");
  }

  test("practicing a word records progress and counts toward words learned", async ({ request }) => {
    const fam = await newFamily(request);
    const { wordId } = await firstLessonWord(request, fam.token);

    const res = await apiPost(request, fam.token, "/api/progress/word", {
      child_id: fam.childId,
      word_id: wordId,
      status: "practiced",
    });
    expect(res.ok()).toBeTruthy();
    const row = (await res.json()).data as WordProgress;
    expect(row.status).not.toBe("introduced");
    expect(row.box).toBe(1); // first rep lands in Leitner box 1

    const dash = await apiGet<Dashboard>(request, fam.token, `/api/dashboard/${fam.childId}`);
    expect(dash.words_learned).toBeGreaterThanOrEqual(1);
  });

  test("repeated correct reps promote a word through the boxes to mastered", async ({ request }) => {
    const fam = await newFamily(request);
    const { wordId } = await firstLessonWord(request, fam.token);

    // Leitner: each correct rep promotes one box (max 5); box 5 == mastered.
    let last: WordProgress | undefined;
    for (let i = 0; i < 5; i++) {
      const res = await apiPost(request, fam.token, "/api/progress/word", {
        child_id: fam.childId,
        word_id: wordId,
        status: "practiced",
        result: "correct",
      });
      expect(res.ok()).toBeTruthy();
      last = (await res.json()).data as WordProgress;
    }
    expect(last?.box).toBe(5);
    expect(last?.status).toBe("mastered");
  });

  test("a freshly practiced word is not immediately due for review", async ({ request }) => {
    const fam = await newFamily(request);
    const { wordId } = await firstLessonWord(request, fam.token);

    await apiPost(request, fam.token, "/api/progress/word", {
      child_id: fam.childId,
      word_id: wordId,
      status: "practiced",
      result: "correct",
    });

    // The scheduler pushes the next review at least a day out, so a just-seen
    // word must NOT resurface now — that's the whole point of spaced repetition.
    const due = await apiGet<{ word_id: string }[]>(
      request,
      fam.token,
      `/api/progress/${fam.childId}/review`
    );
    expect(Array.isArray(due)).toBeTruthy();
    expect(due.some((d) => d.word_id === wordId)).toBeFalsy();
  });

  test("completing a lesson is reflected in the dashboard and XP", async ({ request }) => {
    const fam = await newFamily(request);
    const { lessonId } = await firstLessonWord(request, fam.token);

    const before = await apiGet<Dashboard>(request, fam.token, `/api/dashboard/${fam.childId}`);

    const res = await apiPost(request, fam.token, "/api/progress/lesson", {
      child_id: fam.childId,
      lesson_id: lessonId,
      score: 100,
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.completed).toBe(true);

    const after = await apiGet<Dashboard>(request, fam.token, `/api/dashboard/${fam.childId}`);
    expect(after.lessons_completed).toBe(before.lessons_completed + 1);
    expect(after.xp).toBeGreaterThan(before.xp);
  });

  test("finishing a story is reflected in the dashboard", async ({ request }) => {
    const fam = await newFamily(request);
    const stories = await apiGet<{ id: string }[]>(request, fam.token, "/api/stories");
    expect(stories.length, "seed should provide stories").toBeGreaterThan(0);

    const res = await apiPost(request, fam.token, "/api/progress/story", {
      child_id: fam.childId,
      story_id: stories[0].id,
      last_page: 0,
      completed: true,
    });
    expect(res.ok()).toBeTruthy();

    const dash = await apiGet<Dashboard>(request, fam.token, `/api/dashboard/${fam.childId}`);
    expect(dash.stories_completed).toBeGreaterThanOrEqual(1);
  });

  test("the dashboard summary survives after a child session is recorded", async ({ request }) => {
    // Regression: the child app opens a session on load (useChildSession), and
    // the streak calculation used to crash on the resulting timestamp rows
    // (Date vs string), 500-ing the dashboard for every active child.
    const fam = await newFamily(request);

    const start = await apiPost(request, fam.token, "/api/progress/sessions/start", {
      child_id: fam.childId,
    });
    expect(start.ok()).toBeTruthy();

    const dash = await apiGet<Dashboard & { streak_days: number }>(
      request,
      fam.token,
      `/api/dashboard/${fam.childId}`
    );
    // Today's session means a 1-day streak — and, crucially, no 500.
    expect(dash.streak_days).toBeGreaterThanOrEqual(1);
  });

  test("a parent cannot write progress for another family's child (IDOR guard)", async ({
    request,
  }) => {
    // Family A owns the child; family B is a logged-in stranger.
    const victim = await newFamily(request);
    const attacker = await signup(request);
    await createChild(request, attacker.token); // attacker has their own child too

    const { wordId } = await firstLessonWord(request, victim.token);

    const res = await apiPost(request, attacker.token, "/api/progress/word", {
      child_id: victim.childId, // not theirs
      word_id: wordId,
      status: "practiced",
    });
    expect(res.status(), "cross-family write must be forbidden").toBe(403);
  });
});
