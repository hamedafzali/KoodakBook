# Android direct release (outside Google Play)

Families install the Android app from **koodakbook.eu.cc/app**. iPhone/iPad
users get a "Add to Home Screen" guide on the same page (Apple doesn't allow
installing an app from a file; the web app is a PWA).

## Pieces

| Piece | Where |
|---|---|
| Release table | `app_releases`, migration 067 |
| Public API | `GET /api/app/latest`, newest *published* release (`routes/appReleases.ts`) |
| Admin page | Admin panel → سیستم → «انتشار اپ اندروید» (`/dashboard/app-releases`, needs `admin.manage`) |
| Download page | `apps/web/src/app/app/page.tsx` (`/app`, in the sitemap) |
| In-app update notice | `apps/mobile/components/AppUpdateCard.tsx`, Android only, parent area only |
| Channel announcement | Publishing queues a draft in the Telegram approval queue; a human approves it there |

## Releasing a new version

1. **Bump the version** in `apps/mobile/app.json` → `expo.version` (e.g. `0.2.0`).
   The in-app update notice compares this string with the published release's
   name, so every release needs a higher version.
2. **Build the APK on the Mac:**
   `cd apps/mobile && eas build -p android --profile apk`
   The `apk` profile extends `preview` (production API URL, `buildType: apk`)
   and auto-increments `versionCode` on EAS.
3. **Admin panel → «انتشار اپ اندروید» → نسخه‌ی تازه:**
   - Name: the same string as `expo.version` (`0.2.0`).
   - Code: the build's `versionCode` (EAS shows it). It must be higher than any earlier release.
   - File: upload the `.apk`, or put it on GitHub Releases and paste the https link.
     The admin panel proxies uploads through Next.js; if a large upload is
     refused (HTTP 413), use the link.
   - Notes: one short Persian line. It also goes into the channel post.
4. Press **«انتشار + پست تلگرام»**. The release becomes the one `/app` serves,
   the admin chat gets a 📱 message, and an announcement draft waits in
   «صف تأیید تلگرام». Approve it there to post to the channel.
   **«انتشار بی‌صدا»** publishes without a channel post.

**Unpublish** hides a release from `/app` and the update check (the previous
published one becomes current again). Only an unpublished release can be
deleted.
