# Children's videos («ویدیوها»)

A separate menu where children watch short videos (the animal word songs, later story videos and more). It is in the mobile app (`/videos`, a tile on Home) and on the website (`/child/videos`, a tile on Home and in «همه‌ی بخش‌ها»). Every published video is free for every child.

## Adding a video (admin → محتوا → ویدیوها)

1. Pick the `.mp4` (H.264, up to 300 MB). It uploads in 8 MB chunks, so large files work through the admin proxy.
2. Choose the category and type the title the child sees (e.g. «اسب»).
3. Cover: optional. If you don't pick one, the admin page takes a frame half a second before the end of the video and uploads it as the cover.
4. «ثبت ویدیو» saves it as a draft. «انتشار» makes it visible in the app and on the site within about a minute.

Categories are managed at the bottom of the same page: emoji, Persian name, an English slug, and the order. The app only shows categories that have at least one published video. A category with videos can't be deleted.

## Technical

- Migration `070_videos.sql`: `video_categories`, `videos`; seeds the category `animal-songs` («ترانه‌های حیوانات»).
- Backend `routes/videos.ts`: public `GET /api/videos`; admin CRUD under `/api/admin/videos*` and `/api/admin/video-categories*` (`content.read` / `content.edit`). Files go to `/uploads/videos/`, covers to `/uploads/images/videocover-*`.
- Web: `apps/web/src/app/child/videos/page.tsx` (HTML `<video>`).
- Mobile: `apps/mobile/app/videos.tsx`, playback with **expo-video** (native module — needs `npx expo install expo-video` and a new native build / APK).
- New module colour `videos` (red-400), generated with `tools/design/ramps.py`.
