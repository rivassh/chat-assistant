# Public Rule: TODO Compliance
# Every agent, developer, devops, llmops must respect tasks listed in @TODO.md.
# - Move completed tasks to the "in_progress" section after marking them "done"
# - New tasks must be added to the TODO.md file before work begins
# - All tasks must be tracked in this file; no work outside of TODO.md is permitted

every time take a todo task mve it to in_progress part after done move to done part.
# TODO

# in_progress
- (none)

# COMPLETED
* Implement real-time human handoff (operator inbox + visitor live chat):
  - New `Handoff` Prisma model (`widgetId`, `conversationId?`, `visitorId`, `status` pending/active/ended; indexes `[widgetId, status]`, `[visitorId]`). **The table is created by `npx prisma db push` — the container does NOT migrate on boot.**
  - `backend/src/lib/handoff-bus.js`: in-process `EventEmitter` bus keyed by `widgetId` (`subscribe`/`publish`/`notifyHandoff` seam for a future external channel).
  - Admin routes in `backend/src/routes/widgets.js`: `GET /handoffs`, `GET /handoffs/stream?token=` (SSE), `POST /handoffs/:hid/reply`, `POST /handoffs/:hid/end` — all scoped by widget ownership (`where: { id, userId }`).
  - Public routes in `backend/src/routes/widget-public.js`: creates the Handoff on `humanRequested`/`escalate:true`, serves `GET /handoffs/stream?visitorId=` (SSE), and routes visitor messages to the operator while a handoff is active.
  - `backend/src/middleware/auth.js` accepts `req.query.token` as a fallback because `EventSource` cannot send an `Authorization` header.
  - SSE proxying is handled by the **shared** nginx (`/opt/nginx-certbot/data/nginx/sub/debug.adlr.ir.conf`, `location /api/`), which already has `proxy_http_version 1.1`, `proxy_set_header Connection ""` and `proxy_buffering off`. **`backend/nginx.conf` is DEAD CONFIG** — the backend container image is `node:18-slim` and runs `node src/index.js` with no nginx; do not "fix" SSE there.
  - The SSE heartbeat (`backend/src/lib/sse.js`, every 25 s) keeps the stream alive inside the shared nginx's 90 s `proxy_read_timeout`.
  - `dashboard/src/LiveInbox.jsx` (NEW) + `api.js` `handoffs` group + `App.jsx` live-widget route + `WidgetList.jsx` "Live Inbox" button.
  - `widget/src/chat.js`: opens the visitor SSE stream on escalation, renders the `sa-msg-operator` bubble, sends `handoff:true` while a handoff is active, and closes on `handoff_ended`.
  - Verified live **at the edge** (`http://debug.adlr.ir`, through the shared nginx): the admin stream emitted `handoff_new` -> `handoff_update` -> `operator_message` -> `visitor_message` -> `handoff_ended` -> `: ping`; the visitor stream emitted `operator_message` -> `visitor_message` -> `handoff_ended`; while active the chat route returned `response: ""` and made NO provider call; after `ended` the AI answered normally (clean Persian reply, 138 chars, no reasoning leak); a DB-write failure still returns the answer with `conversationId: null`.
* Fix the live-inbox UI never reaching the shipped dashboard: `LiveInbox` was imported but never rendered, so Vite tree-shaken it out. Added a `liveWidget` state + full-screen route in `App.jsx` and a "Live Inbox" button in `WidgetList.jsx`. **Verified by grepping the built `assets/*.js` inside the RUNNING container** — `Live Inbox`, `End Takeover`, `handoffs/stream`, `operator_message`, `visitor_message`, `handoff_ended` are all present.
* Harden the widget language detection (`widget/src/i18n.js`): full-body `innerText` sniff (not just the first 800 chars), `<html lang>` first, `dir`/`getComputedStyle().direction` as an RTL hint, a 2 s cache, and re-detection at every string render so a SPA that mounts after the widget is still detected correctly. Verified against the real page shapes: `lang=fa` -> fa, `lang=en` + Persian body -> fa, `lang=en` + English body -> en, `lang=en dir=rtl` -> fa.
* Fix the widget freezing its language at construction: `ChatPanel` captured `translator()` in the constructor, which resolved the (empty, English) detection result before the host SPA rendered. `this.t` now re-resolves the language on every lookup.
* Fix the operator-bubble label rendering the literal key `supportReply` (undefined in the string table) instead of the localized label — now uses `operatorReply` ("تیم پشتیبانی"). Verified in the built bundle.
* Implement chat route resilience (DB write failure guard) in `backend/src/routes/widget-public.js` (chat/events). Verified live: with the `conversations` table renamed away, the chat route still returns HTTP 200 with the answer and `conversationId: null`; the events route is best-effort (201/202, never 500).
* Implement reasoning-leak fix in `backend/src/lib/ai.js`: a single `isDefectiveAnswer()` predicate (reasoning openers, upstream safety verdict, planning markers, script mismatch, Persian third-person narration) plus a 3-attempt ladder (original prompt -> strict retry at 2x tokens -> terse re-ask at temperature 0.5) before an honest language-matched fallback. Verified live: 12/12 clean at `localhost:3001` and 6/6 clean at `debug.adlr.ir`.
* Add human-answer capability:
  - Wired `backend/src/lib/escalation.js` (detectHumanRequest, resolveEscalation, buildEscalationMessage). Verified live: a Persian human request returns the handoff message with `escalation.available = true` and no model call.
  - Added `ai.escalation { enabled, message, contact }` config to dashboard AI Settings (single "Human Handoff" block in the AI tab).
  - Added the "Talk to a human" quick-reply affordance in `widget/src/chat.js` (posts `escalate: true`). Verified live: the served bundle at `debug.adlr.ir/widget.js` contains the `sa-msg-action` pill and `talkToHuman`.
* Add `ai.escalation` to the live `site-assistant-widget` config row in Postgres. Verified: `config->'ai'->'escalation'` = `{enabled: true, message: <persian handoff>, contact: ""}`; the contact resolves from the seeded "Contact and support" knowledge entry.
* Build + deploy: `node --check` on the changed backend files, `cd widget && node build.js`, `docker compose up -d --build backend widget dashboard` (+ `--force-recreate dashboard`), then `docker builder prune -f`.
* Live-verify on `debug.adlr.ir`: Persian question returns a direct Persian answer with no reasoning preamble; "talk to a human" button appears under the reply and the handoff returns the support contact; `conversationId` still returned while the DB is healthy; CORS emits exactly one `Access-Control-Allow-Origin: *` with no `Access-Control-Allow-Credentials`.
* Fix silently truncated answers: the upstream reports `finish_reason: "stop"` even when it cuts the reply mid-word, so `isTruncated()` detects a long reply that ends on a letter with no terminator and the ladder retries with a doubled token budget (500 → 1000). A reply that is only truncated (not defective) is still shown rather than replaced by the generic fallback. `ai.maxTokens` raised from 200 to 500 in the route default, `backend/src/routes/widgets.js`, `backend/prisma/seed.js`, the dashboard input and the live `site-assistant-widget` config row. Verified live: 12/12 replies complete, none truncated.
* Localize the seeded knowledge base to Persian (titles + content: "تماس و پشتیبانی", "ساعات کاری", "خدمات سایت") in `backend/prisma/seed.js` and in the live rows, so the assistant's answers and the human-handoff contact text are fully Persian.
* Make the assistant name/greeting configurable and localized instead of the hardcoded "Astra" default.
* Replace mock AI backend (backend/src/lib/ai.js) with a real LLM call via the OpenAI-compatible mimo-adapter, and force replies in the user's own language (currently it returns random canned Arabic).
* Widget half-circle fixes: true semicircle (not half-ellipse), flush against the side wall in both RTL and LTR, raised off the bottom edge, lighter inner icon using bug.jpg, drop the version badge outside the trigger.
* Widget UI localization (fa/en/ar) for chat labels, placeholders, and error messages.
* Widget personality localized to Persian ("دستیار") with a Persian greeting and proactive messages.
* Fix PostgreSQL "No space left on device" gate: truncated /var/log/syslog.1 (1.3G), kern.log.1 (983M), syslog (203M), candash-rate-limits.log (431M); pruned Docker build cache + unused images (~4.7GB). Disk now 85%.
* add embeded script with nginx in all services.
* Resolve PostgreSQL overload: remove redundant isolated postgres:16-alpine service from docker-compose.yml and start site-assistant backend on shared ymls-pgsql-1 (port 5432).
* Fix duplicate Access-Control-Allow-Origin on public widget API (consolidate to single request-aware CORS handler in backend/src/index.js, remove nginx add_header).
* Fix widget shape/positioning in RTL mode: convert widget inline-axis geometry to logical CSS properties (inset-inline-*, padding-inline-*, logical border radii), pin container dir to host page direction, mount chat panel inside container so it mirrors with the widget.
