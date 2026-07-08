# Google Analytics 4 — The Gist Club

Measurement ID: `G-KPSM10HVTC` (also set via `NEXT_PUBLIC_GA_MEASUREMENT_ID`).

## What the app sends automatically

| GA4 sidebar area | Powered by |
|---|---|
| **Realtime overview / pages** | Page views (`/` → `/explore`, all routes) |
| **Understand web traffic** | Page views + `search` on Explore |
| **Tech** | Browser, device, OS (automatic) |
| **User attributes** | `logged_in`, `account_role` + `user_id` when signed in |

## Custom events (mark as conversions in Admin)

| Event | When | Maps to GA goal |
|---|---|---|
| `sign_up` | Account created | **Generate leads** |
| `login` | Sign in (credentials / Google click) | **Generate leads** |
| `search` | Explore search submit | Site search |
| `create_post` | Quote/post published | Engagement |
| `comment` | Thread reply | Engagement |
| `follow_book` / `unfollow_book` | Follow book | Engagement |
| `readlist_update` | Want to read / Mark read | Engagement |
| `reaction` | Like / dislike on post or comment | Engagement |
| `view_summary` | Open book AI summary | Engagement |
| `generate_summary` | Generate personal/shared summary | Engagement |
| `friend_action` | Request, accept, decline, remove | Social |
| `pwa_install` | Install app prompt | Engagement |
| `select_item` | Pick book in Compose search | Discovery |

## One-time setup in [Google Analytics](https://analytics.google.com/)

### 1. Enhanced measurement (Admin → Data streams → Web → Enhanced measurement)

Turn **ON**:

- Page views (already covered)
- Scrolls
- Outbound clicks
- Site search (optional — we also send `search` events)
- Form interactions
- Video engagement (if you add video later)

### 2. Mark conversions (Admin → Events)

Click **Mark as conversion** for:

- `sign_up`
- `login`
- `create_post` (optional)

These populate **Generate leads** and business objective reports.

### 3. Google signals (Admin → Data settings → Data collection)

Enable **Google signals** for demographics (country, age brackets) in **User attributes** reports. Requires consent in EU/UK if applicable.

### 4. Data stream URL

Set stream URL to `https://www.thegist.club` (with `www`).

### 5. Link Search Console (optional)

Admin → Product links → Search Console — ties organic search queries to GA.

### 6. DebugView (optional)

Add `NEXT_PUBLIC_GA_DEBUG=true` locally, install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger) extension, open **Admin → DebugView** to see events live.

## Not applicable for TGC today

- **Drive sales** — no e-commerce; skip unless you add payments.
- **App analytics** — web/PWA only unless you ship native apps.

## Realtime “pages” table empty?

Summary cards can show users while the pages table is still processing (30–60s lag). Use **Realtime → Event count by Event name** to confirm `page_view`, `login`, `create_post`, etc.
