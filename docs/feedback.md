# Family feedback

One inbox for everything families tell us. Code: `apps/backend/src/routes/feedback.ts`, migration 068.

## Where families write

| Place | Who | Email |
|---|---|---|
| Website: «تماس با ما» on the landing page (`/#contact`), linked from the footer and `/app` | Anyone, no account | Required (for the answer) |
| Web parent area: `/parent/feedback`, from the sidebar and Settings → «ارتباط با ما» | Signed-in parent | The account email |
| Mobile parent area: «پیشنهاد، مشکل یا سؤال» in the parent hub menu | Signed-in parent | The account email |

**Kind:** پیشنهاد, مشکل, سؤال, or پیام دیگر.

**Context sent with each message:** the page or screen, the platform, the app version and the browser. Nothing about the child is ever sent.

**Behind the parent PIN:** the parent-area screens are, so children don't get a free-text box. A kid-login token is never accepted as the family.

**Spam limits:** a honeypot field and at most 5 messages a minute per IP or account, the same as `/api/leads`.

## Where the team reads it

- **Telegram:** an instant «💬 بازخورد تازه» DM with kind, sender, where it was sent from, and the message. The daily summary counts new and open feedback.
- **Admin panel → «بازخورد خانواده‌ها»** (`/dashboard/feedback`, needs `users.read`):
  - Filter by status (new / in progress / answered / closed) and kind, search, export CSV.
  - The detail view shows the message, its context, and the family's account (plan, number of children, link to their record).
  - **Reply:**
    - For a signed-in family, the reply is shown in their parent area under «پیام‌های من». Their dashboard / hub shows «جواب تازه» until they open it, and the admin panel shows when they saw it. The item's status becomes "answered".
    - For a website message (no account), reply by email: the button opens your mail app with the message quoted.
  - **Internal note:** never shown to the family.
- **Elsewhere:** Dashboard → «کارهای منتظر» and Reports → Content count open feedback.
