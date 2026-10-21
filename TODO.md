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
