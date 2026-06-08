/**
 * Wait until the web app + API + DB are ready before tests run. The app and
 * backend boot in separate containers (and the backend runs migrations on
 * start), so we poll a public endpoint through the web proxy until it answers.
 */
const baseURL = process.env.BASE_URL || "http://localhost:3001";

export default async function globalSetup() {
  const deadline = Date.now() + 120_000; // up to 2 minutes
  const target = `${baseURL}/api/lessons`;
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(target);
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.data;
        if (Array.isArray(arr) && arr.length > 0) {
          console.log(`[e2e] app ready — ${arr.length} lessons from ${target}`);
          return;
        }
        lastErr = "lessons empty (migrations/seed not applied yet)";
      } else {
        lastErr = `HTTP ${res.status}`;
      }
    } catch (e) {
      lastErr = (e as Error).message;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`[e2e] app not ready at ${target}: ${lastErr}`);
}
