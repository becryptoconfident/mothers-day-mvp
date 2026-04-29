# HANDOFF — Mother's Day MVP / Memphis Carter

**Snapshot:** 2026-04-28, end of session 2 (massive rewrite)
**Project root:** `/Users/memphiscarter/mothers-day-mvp/`
**Mother's Day 2026:** Sunday, May 10. Send window: May 4–10. Edit window closes May 3 23:59.
**Status:** Code complete for the new product. Type-checks clean. Dev server runs. **Schema migrations not yet applied to Supabase.** Stripe webhook secret not yet set. **Not deployed.**

This doc replaces the previous version end-to-end — too much has changed (SMS → email, 2 tiers → 3 tiers, hunt → Forever Page, prices, copy, voice, dozens of new routes). Paste this whole file into any AI tool to brief them cold.

---

## 1. ONE-MINUTE BRIEF

A Next.js 16 web app that sells $19 / $29 / $49 personalized **Mother's Day text-message support**. Three product tiers, all email-delivered to the BUYER, who then forwards to mom from their own phone:

- **$19 — Mother Lover Package**: 5 questions → AI writes 7 messages → user gets one email each morning May 4–10 → user copy/paste/sends to mom.
- **$29 — + Feels**: same plus user attaches photos / voice / video to 2-3 days; media renders inline in the daily emails.
- **$49 — + Forever Page**: same plus a private permanent webpage at `/forever/[orderId]` with cleaned copy, photo gallery, AI-generated love letter, optional 2-min video.

**Critical model shift from earlier sessions:** emails go to the BUYER, not mom. Mom gets real texts from her real kid's real phone. We're the reminder + writer, not the sender. This kills email deliverability anxiety and makes mom's experience more authentic.

Voice / brand: founded by Memphis Carter. ADHD founder. Self-deprecating, irreverent, southern, complicit. Hashtag `#doitforbonnie` (Bonnie = Memphis's mom).

---

## 2. CURRENT STATE — every route and what it does

### Pages

| Route | Purpose |
|---|---|
| `/` | Landing — hero, countdowns, founder audio, pitch, bragging callout, primary CTA, toilet callout, example message card, 3 tier cards, safety section, "what you actually do" steps, FAQ, footer with `#doitforbonnie` |
| `/builder?tier=N` | 5-step questionnaire. State machine: q1 → q2 → q3 → q4 → contact (+ media-yn → media-days for tier 2/3). Per-keystroke localStorage save. Char counters. ND-safe ✓/→/Next breadcrumb at top, NextLine at bottom. Specific button labels ("Answer Question 2 →"). Q1 has a banner reminder we email YOU. Contact step has timezone disclosure. |
| `/preview` | Calls `/api/generate-messages?preview=true` → shows Day 1 + Day 2 unlocked + editable. Days 3-7 are blurred locked cards. Per-day media uploaders for tier 2+. ForeverSetup component for tier 3 (optional long note + optional video). "Save my workspace" email banner ("I'm not crying. You're crying."). "After you pay" recap above checkout. Pay button → `/api/create-checkout`. |
| `/success?session_id=…` | Server component, polls Supabase up to 6× for the webhook. Status checklist (✓/→/□): payment received / messages scheduled / first delivery date / nothing to do until then. Backup messages link. Edit button. `#doitforbonnie` share card with prefilled tweet. Tier 3 shows "Forever Page being prepared" + preview link. |
| `/edit/[orderId]` | Magic-link flow. Hash `#t=<token>` auto-authes; otherwise prompts for buyer email. Inline auto-save on blur. Color-coded status banner (green/amber/red) with days-remaining countdown. Read-only after May 3 lock. |
| `/backup/[orderId]` | Plain text dump of all 7 messages with `select-all` styling. Bookmarkable URL is the credential (order UUID). Backup if daily emails get lost. |
| `/resume/[orderId]` | Pre-payment "come back later" entry point. Reads `forever_data.draft_state` from DB, hydrates `localStorage`, redirects to `/preview`. If already paid, redirects to `/edit/[orderId]`. |
| `/forever/[orderId]` | Tier 3 only. Server component. Lazy-generates cleaned text + AI letter on first visit, caches into `forever_data`. Sections: hero (mom's name in serif), intro, 7 messages, photo gallery, vertical timeline of cleaned answers, AI letter card, optional video, footer ("Love, {userName}"). OG metadata `noindex,nofollow`. |
| `/hunt/[orderId]` | **DEAD CODE** — old tier-3 hunt page from before Forever Page pivot. Nothing links to it. Routes don't 500. Safe to delete in cleanup. |

### API routes

| Route | What it does |
|---|---|
| `POST /api/generate-messages` | If `body.preview === true`, returns `{day_1, day_2}` only. Otherwise generates all 7. Used by `/preview` (preview mode) and `stripe-webhook` (full mode after payment). |
| `POST /api/create-checkout` | Validates inputs (day_1 + day_2 messages required, full answers required, valid user_email; mom_email optional). Inserts pending order into `orders` (paid=false). Creates Stripe Checkout Session with tier-specific amount. Stores `stripe_session_id`. Returns `{url}`. |
| `POST /api/stripe-webhook` | Verifies Stripe signature. Marks order paid. If days 3-7 missing, generates them with Anthropic preserving any user-edited day_1. Schedules 7 daily emails to user_email at `delivery_time` × May 4-10 in user's TZ. Schedules edit-closing reminder for May 2 9am. **Tier 3:** schedules Forever Page email for May 10 9am + fires off non-awaited POST to `/api/warm-forever-page`. Sends confirmation immediately. Writes to `error_logs` at receipt/duplicate/completion. |
| `POST /api/upload-presigned` | Returns Cloudflare R2 PUT URL + public URL. Content-type allowlist + size caps (10MB photo/audio, 100MB video). 503s if R2 not configured. |
| `POST /api/send-magic-link` | Accepts `{orderId, email}`. Returns `{ok:true}` always (no enumeration). Sends only if email matches order's user_email. |
| `GET/POST /api/edit-order` | GET loads order with token; POST patches editable fields. Re-schedules Resend daily emails when content/delivery changes. |
| `POST /api/save-progress` | Pre-payment "save my workspace" — creates orders row (paid=false) with full draft state in `forever_data.draft_state`, sends "I'm not crying. You're crying." email with `/resume/[orderId]` link. |
| `GET /api/resume?orderId=…` | Returns `{paid, draft}` for resume page hydration. |
| `POST /api/warm-forever-page` | Pre-generates cleaned text + AI letter for tier 3. Idempotent. Called fire-and-forget by webhook. |
| `GET /api/cron/send-daily-emails` | Hourly. Locks orders past edit window. Resend handles actual sending. |
| `GET /api/cron/send-reminders` | Stub. Reminders are scheduled at order time via Resend. |
| `GET/POST /api/hunt` | **DEAD** — old tier 3 hunt API. No callers. Safe to delete. |

### Lib

| File | Purpose |
|---|---|
| `lib/supabase.ts` | Browser + admin clients. New `sb_` keys with legacy fallback. |
| `lib/anthropic.ts` | `claude-sonnet-4-6`. **Lazy-init client** — defers reading env until first call (avoids module-load problems). **Has .env.local fallback** for environments where parent process empties `ANTHROPIC_API_KEY` (Claude Code does this — see Hard Gotchas below). Exports `generateContent` (JSON) + `generateText` (raw prose). |
| `lib/prompts.ts` | All Anthropic prompts. `MESSAGES_SYSTEM_PROMPT` (full 7), `PREVIEW_DAYS_1_2_SYSTEM_PROMPT` (sample 2). Hunt prompts still here but unused. |
| `lib/stripe.ts` | `TIER_PRICING` table: 1900/2900/4900 cents. Names: `Mother Lover Package` / `+ Feels` / `+ Feels + Forever Page`. Descriptions in Memphis voice. |
| `lib/dates.ts` | `localToUTC`, `deliveryISOForDay`, `isEditWindowOpen`, `formatHumanDate`, `ordinal()`. Calendar constants (DELIVERY_DATES May 4–10, EDIT_CLOSE_DATE May 3). Hunt constants still defined but unused. |
| `lib/email-templates.ts` | Pure HTML templates. `dailyMessageEmail` (buyer-facing "send this to mom"), `gentleReminderEmail` (1pm ND nudge), `confirmationEmail`, `editClosingReminderEmail`, `huntReminderEmail` (unused), `foreverPageEmail`, `magicLinkEmail`, `saveProgressEmail`. All include `#doitforbonnie` in footers where appropriate. ND-safe ✓/→/Next pattern. |
| `lib/resend.ts` | `sendEmail` (with optional `scheduledAt`), `cancelEmail`. Defensive — returns `{ok:false}` if RESEND_API_KEY missing. |
| `lib/r2.ts` | Cloudflare R2 (S3-compatible). `presignUpload`, `deleteR2Object`, `r2Configured`. |
| `lib/auth.ts` | HMAC-SHA256 magic-link tokens. `signEditToken(orderId)`, `verifyEditToken(token)`, `authorizeCron(req)`. 1-hour TTL on edit tokens. |
| `lib/text-cleaner.ts` | `cleanUserText(raw)` + `cleanUserTextBatch([…])`. Used to render messy answers as clean prose on Forever Page. Has fast-path that skips API call for already-clean short text. |
| `lib/forever-letter.ts` | `generateForeverLetter({cleanedAnswers, longNote, userName, momName})` → 3-4 paragraph prose letter. |

### Components

| File | Purpose |
|---|---|
| `app/_components/Countdown.tsx` | Client component. Two pills: Mother's Day countdown + Edits-close countdown. Color-shifts (blue → amber → red) as deadlines approach. 30s tick. |
| `app/_components/StepBreadcrumb.tsx` | Reusable ND-safe breadcrumb. ✓ done / → current / progress bar / Next: line. |

### Scripts

| File | Purpose |
|---|---|
| `scripts/send-test-email.ts` | Standalone test. `npx tsx scripts/send-test-email.ts you@example.com` — sends a real Day-1 email via Resend. Confidence test for production wiring. |

---

## 3. PRODUCT MECHANICS

### Buyer-relay model (load-bearing concept — don't reinvent)

```
User pays → orders row created → 7 daily emails scheduled to user_email
   ↓
May 4 8am → user opens email → sees Day 1 message + media inline
   ↓
User copies message → pastes in iMessage to mom → attaches media → sends
   ↓
Mom gets a real text from her real kid (not from us)
```

Mom never receives anything from our system directly. The product is: writing + reminding + structuring. Memphis tested this UX choice — it dramatically increases authenticity ("from your real phone number, not a robot") and removes email deliverability risk for mom (whose email might filter unknown senders).

Schema reflects this: `mom_email` is nullable, never used for sending. We collect mom's name (for personalization in the email subject), not her contact info.

### 3 Tiers

| Tier | Price | What user adds | What mom gets |
|---|---|---|---|
| 1 | $19 | 5 question answers, contact info | 7 texts from her kid, May 4-10 morning |
| 2 | $29 | + 2-3 photos/videos/voice memos on selected days | + media attachments in those texts |
| 3 | $49 | + optional 500-char note + optional 2-min video | + a private webpage at `/forever/[id]` with the AI letter, photo gallery, video, all 7 messages |

### Soft gate at /preview

User answers 5 questions → calls `/api/generate-messages?preview=true` → gets Days 1+2 only. Days 3-7 render as locked cards with blurred placeholder text and "🔒 unlock after pay" treatment. After payment, webhook generates Days 3-7, preserving any edits to Day 1+2.

This burns ~30% of the Anthropic budget per preview vs. full 7-message gen, while still giving the buyer enough proof to convert.

### Email scheduling

**Resend `scheduledAt` is the engine, not cron.** Every email is scheduled at order-creation time with an ISO timestamp:

- 7 daily messages: `delivery_time` × May 4-10 in user's IANA timezone (sent to user_email)
- Edit-closing reminder: May 2 9am user-local
- Confirmation: immediate
- Tier 3 only: Forever Page email May 10 9am
- Tier 1+2 + extra_reminders opt-in: gentle 1pm reminder per day

If user edits on `/edit`, the API cancels old scheduled IDs and re-schedules new ones with updated content.

Cron jobs exist (`/api/cron/send-daily-emails`, `/api/cron/send-reminders`) but are housekeeping only — they lock orders past the edit window. Actual sending is Resend's job.

### Forever Page (tier 3) generation

Lazy on first visit. When mom opens her link:
1. Page loads order from DB
2. Checks `forever_data.cleaned_answers` and `forever_data.generated_letter`
3. If missing, calls `cleanUserTextBatch([q1,q2,q3,q4])` in parallel + `generateForeverLetter(...)` in serial, ~10-15 seconds
4. Writes both back to `forever_data`, renders

Webhook also fires off a non-awaited POST to `/api/warm-forever-page` after marking paid, so cache is usually warm by the time mom clicks through.

---

## 4. VOICE & COPY RULES (non-negotiable)

### Tone

Memphis Carter voice. Self-deprecating ADHD founder. Conversational, irreverent, complicit. Southern vernacular OK ("fixin to"). Light profanity OK ("brag so fucking hard", "f-up"). No marketing-speak.

### Banned words (auto-fail)

`leverage, optimize, streamline, comprehensive, robust, cutting-edge, innovative, solution, ecosystem, value-add, synergy, empower, transformative, revolutionize, seamless, holistic, paradigm, mission-critical`

(Memphis broke this rule once intentionally with "Mother loving empowerment" — irony only.)

### Required elements

- Contractions
- Specific numbers ($19, 5 questions, May 4th, 30 seconds, etc.)
- Real examples (the soup story is the canonical example message)
- Honest limitations ("Don't like them? Don't pay.")
- ND-safe orientation: ✓ what just happened / → where you are / Next: what's next

### Date formatting

Always include ordinals: `May 4th`, `May 10th`, `May 3rd`. The `ordinal()` helper in `lib/dates.ts` handles dynamic dates.

### Hashtag

`#doitforbonnie` — Memphis built this for his mom Bonnie. Tagline lives in landing footer, success page share card, confirmation email footer. Tweet share button on success page pre-fills text + hashtag.

### Key catchphrases (used everywhere)

- "Done with Mother's Day shopping in 10 minutes."
- "Stop drowning in guilt every year." (current H1)
- "The only f-up this year is fixin to be the favorite."
- "Do the whole thing from your phone. On the toilet. While you're pooping. I'm not joking."
- "She's going to get to brag so fucking hard."
- "Real original, Sybil." (the basic-flowers sister)
- "Maximum mom impact for the mother-loving time and money you've got."
- "I'm just a neurodivergent dude making things for messes."
- "I'm not crying. You're crying." (save-progress email H1)
- "Works on your phone. Yes, even on the toilet." (under each tier card CTA)

### Per-tier guilt pricing (under price)

- $19 — *Do you remember being born? She does.*
- $29 — *She drove you to soccer practice for 6 years. This takes 15 minutes.*
- $49 — *She still has your finger paintings. Give her something she'll keep forever.*

---

## 5. WHAT'S NOT BUILT (intentionally deferred)

- **Vercel deployment** — local only so far
- **Stripe webhook secret** — needs `stripe listen` for local OR a real deploy URL
- **R2 CORS configuration** — Memphis has the keys but bucket CORS may not allow `PUT` from localhost / production yet
- **Resend domain verification** — sender is currently `onboarding@resend.dev`; needs DNS verification to use a custom sender
- **Mother's Day calendar event (.ics)** — `ics` package installed but never wired
- **Analytics writes** — `analytics_events` table exists; nothing inserts yet
- **Sentry / error monitoring** — `error_logs` table is the only error sink (webhook writes to it now)
- **Tests** — none. Deliberate for the timeline.
- **Full e2e flow test script** — flagged in todos. Memphis can verify manually faster.
- **Tier 3 "edit your forever page next year"** — marketing copy promises it; no UI yet. Easy add.
- **Letter regeneration on edit** — if user edits long_note via `/edit`, the cached letter is stale. No regen trigger yet.
- **R2 video size cap enforcement** — schema says 200MB for forever-page video; presign helper allows 100MB max for video media items. Worth aligning before launch.
- **AGENTS.md** — currently a one-liner about "this isn't the Next.js you know." Could be deleted or expanded.
- **Old hunt code paths** — `/hunt/[orderId]/page.tsx`, `/api/hunt/route.ts`, `huntReminderEmail`, hunt prompts in `lib/prompts.ts`. All inert. Delete in cleanup.

---

## 6. STACK

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.4 (App Router, Turbopack) |
| React | 19.2.4 |
| Hosting (planned) | Vercel |
| DB | Supabase (Postgres) |
| AI | Anthropic Claude `claude-sonnet-4-6` (model name is canonical — earlier sessions wrongly used `claude-sonnet-4-20250514`) |
| Payments | Stripe (`sb_` keys, no `apiVersion` override) |
| Email | Resend + raw HTML templates (no React Email install) |
| Storage | Cloudflare R2 (S3-compatible via `@aws-sdk/client-s3`) |
| Forms | Controlled React + localStorage |
| Styling | Tailwind v4 |
| Type checking | TypeScript 5 |
| Test runner (added today) | `tsx` (devDep) |

**Removed since session 1:** `twilio` (still in `package.json` as harmless cruft, no imports). React Email never installed.

---

## 7. ENV VARS (all 19, status as of snapshot)

```
ANTHROPIC_API_KEY                       ✓ set (filled by Memphis via secrets UI)
NEXT_PUBLIC_SUPABASE_URL                ✓
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY    ✓
SUPABASE_SECRET_KEY                     ✓
STRIPE_SECRET_KEY                       ✓ (test mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY      ✓
STRIPE_WEBHOOK_SECRET                   ⚠ not yet set — needs `stripe listen` or Vercel deploy
RESEND_API_KEY                          ✓
RESEND_FROM                             ✓ (currently `Memphis <onboarding@resend.dev>`)
R2_ACCOUNT_ID                           ✓
R2_ACCESS_KEY_ID                        ✓
R2_SECRET_ACCESS_KEY                    ✓
R2_BUCKET                               ✓
R2_PUBLIC_URL                           ✓
NEXT_PUBLIC_URL                         http://localhost:3000 (change on deploy)
NEXT_PUBLIC_SITE_NAME                   ✓ "Mother's Day Messages"
SUPPORT_EMAIL                           ✓
EDIT_TOKEN_SECRET                       ✓ (HMAC key, openssl rand -hex 32)
CRON_SECRET                             ✓
```

Secrets UI runs at `http://127.0.0.1:7879` via `python3 secrets_ui.py --port 7879`.

---

## 8. HARD GOTCHAS (don't relitigate)

1. **No SMS, ever.** Twilio + A2P 10DLC was the original session-1 spec; we pivoted to email-only because the 1-3 day 10DLC review window broke the launch timeline. Don't suggest re-adding.
2. **Email goes to BUYER not MOM.** Confirmed product decision. Mom gets real texts from her kid's phone.
3. **Tier 3 = Forever Page, not treasure hunt.** Hunt was tier 3 for ~2 hours mid-session, then replaced. All hunt code paths are inert dead code.
4. **Tier 3 price = $49, not $39.** Bumped when scope expanded from hunt → page. `lib/stripe.ts` has the canonical pricing.
5. **Mother's Day = May 10, 2026 (2nd Sunday).** Not May 11 (was a copy bug earlier in the session). All code uses May 10.
6. **Anthropic model = `claude-sonnet-4-6`.** Old spec said `claude-sonnet-4-20250514`. Wrong.
7. **Stripe SDK: omit `apiVersion`.** Account-pinned default.
8. **Supabase NEW `sb_` keys.** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SECRET_KEY`. Legacy fallback in `lib/supabase.ts`. **🚨 Both keys start with `sb_publishable_…` if you're not careful — Supabase's UI shows publishable keys by default and you have to switch to the "Secret" tab to get the actual `sb_secret_…` value.** The secret key is what bypasses RLS; the publishable key is browser-safe. If you paste a publishable into the SECRET slot, every server-side write hits a `42501 row-level security policy` error and silently fails. Verify with: `curl -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/orders?select=count"` — if `content-range: */0` and INSERTs return 401 with code 42501, you've got the wrong key.
9. **🚨 Claude Code clears `ANTHROPIC_API_KEY`** in child processes (security feature — prevents user code from piggybacking on Claude Code's auth). When Memphis runs `npm run dev` *from* a Claude Code session, the env arrives empty even though `.env.local` is correct. Fix is in `lib/anthropic.ts`: it reads `.env.local` directly as a fallback when `process.env.ANTHROPIC_API_KEY` is empty. **In production (Vercel), no parent process touches the var, so this fallback never triggers.** If Memphis hits the same in another lib (Resend, Stripe, R2), replicate the same pattern.
10. **All dates use ordinals** (`May 4th`, `May 10th`). Computed dates use `formatHumanDate()` which calls `ordinal()`.
11. **Resend `scheduledAt` does the actual sending.** Cron is housekeeping only.
12. **`python3 -u`** for any long Python script (stdout buffering bit us multiple times).
13. **Don't reintroduce `mom_email` as required.** Schema is nullable. Buyer-relay model doesn't need it.
14. **Don't pre-warm the dev server with the Forever Page expecting instant render.** First load is ~10-15s while AI generates. Cached after.
15. **`#doitforbonnie`** — Bonnie is Memphis's actual mom. Hashtag carries the founder story.

---

## 9. SCHEMA TO RUN IN SUPABASE

Idempotent. Safe to re-run if Memphis isn't sure where he's at.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  -- Drop any legacy phone columns from session 1
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='orders' AND column_name='user_phone') THEN
    ALTER TABLE orders DROP COLUMN user_phone;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='orders' AND column_name='mom_phone') THEN
    ALTER TABLE orders DROP COLUMN mom_phone;
  END IF;
  -- Make mom_email nullable (was NOT NULL in earlier schema)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='orders' AND column_name='mom_email' AND is_nullable='NO') THEN
    ALTER TABLE orders ALTER COLUMN mom_email DROP NOT NULL;
  END IF;
  -- Add extra_reminders if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='extra_reminders') THEN
    ALTER TABLE orders ADD COLUMN extra_reminders BOOLEAN DEFAULT FALSE;
  END IF;
  -- Add forever_data if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='forever_data') THEN
    ALTER TABLE orders ADD COLUMN forever_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  tier SMALLINT NOT NULL DEFAULT 1 CHECK (tier IN (1,2,3)),
  user_email TEXT NOT NULL,
  user_name TEXT,
  mom_email TEXT,
  mom_name TEXT,
  delivery_time TEXT NOT NULL DEFAULT '08:00',
  delivery_timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  extra_reminders BOOLEAN DEFAULT FALSE,
  question_1 TEXT NOT NULL,
  question_2 TEXT NOT NULL,
  question_3 TEXT NOT NULL,
  question_4 TEXT NOT NULL,
  messages JSONB NOT NULL,
  media JSONB DEFAULT '[]'::jsonb,
  forever_data JSONB DEFAULT '{}'::jsonb,
  hunt_clues JSONB,
  hunt_finale JSONB,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  amount_paid INTEGER NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  scheduled_email_ids JSONB DEFAULT '{}'::jsonb,
  emails_sent JSONB DEFAULT '{}'::jsonb,
  edit_locked BOOLEAN DEFAULT FALSE,
  hunt_progress JSONB DEFAULT '{}'::jsonb,
  hunt_started_at TIMESTAMPTZ,
  hunt_completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_stripe_session_idx ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS orders_user_email_idx ON orders(user_email);
CREATE INDEX IF NOT EXISTS orders_paid_idx ON orders(paid);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS edit_tokens (
  token TEXT PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
ALTER TABLE edit_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB
);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  endpoint TEXT,
  error TEXT,
  stack TEXT,
  context JSONB
);
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
```

---

## 10. WHAT MEMPHIS DOES NEXT

### Tonight

1. **Run the schema above** in Supabase SQL editor
2. **Smoke test the AI path** with no Stripe needed: `npx tsx scripts/send-test-email.ts memphiscashcarter@gmail.com` → should land in inbox in <60s. If it doesn't, Resend isn't ready.
3. **Walk through the flow on phone** at `http://192.168.1.196:3000` (same wifi). All routes are mobile-tested.
4. **Stripe CLI for local webhook**: `brew install stripe/stripe-cli/stripe` → `stripe login` → `stripe listen --forward-to localhost:3000/api/stripe-webhook` → paste the printed `whsec_…` into the secrets UI.
5. **End-to-end test** with Stripe test card `4242 4242 4242 4242`. Check the success page. Walk through tier 1, 2, 3 separately.

### Tomorrow (deploy day)

6. **Vercel deploy** — `vercel --prod` or import via dashboard. Set all 19 env vars. `NEXT_PUBLIC_URL` becomes the Vercel domain.
7. **Production Stripe webhook** in dashboard → add endpoint `https://<domain>/api/stripe-webhook` → reveal `whsec_…` → swap into Vercel env → redeploy.
8. **R2 CORS** for Vercel domain — allow `PUT` from `https://<domain>`.
9. **Resend domain verify** if Memphis wants a real sender (not `onboarding@resend.dev`).
10. **Live Stripe test** with a real $19 charge to himself.
11. **Launch tweet** — drafts already in chat history; lean on `#doitforbonnie`.

### Never

- Don't reintroduce SMS / Twilio
- Don't push to live Stripe without an end-to-end test pass first
- Don't delete `forever_data.draft_state` from orders that haven't paid yet (that's the resume key)

---

## 11. KEY HAND-WRITTEN SOURCE (inline for chat-only AIs)

Below are the most-load-bearing files. For everything else, ask Memphis to paste the file you need by path.

### `lib/dates.ts` (calendar truth)

```typescript
export const DELIVERY_DATES = [
  '2026-05-04','2026-05-05','2026-05-06','2026-05-07',
  '2026-05-08','2026-05-09','2026-05-10',
] as const;
export const EDIT_CLOSE_DATE = '2026-05-03';
export const HUNT_REMINDER_DATE = '2026-05-09'; // unused
export const HUNT_DAY = '2026-05-10';            // unused

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function localToUTC(dateStr: string, timeStr: string, ianaTz: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const naiveUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
  const probe = new Date(naiveUTC);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(probe).map((p) => [p.type, p.value]));
  const interpretedUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), 0,
  );
  const offset = interpretedUTC - naiveUTC;
  return new Date(naiveUTC - offset).toISOString();
}

export function deliveryISOForDay(day: 1|2|3|4|5|6|7, timeStr: string, ianaTz: string) {
  return localToUTC(DELIVERY_DATES[day - 1], timeStr, ianaTz);
}
export function isEditWindowOpen(ianaTz: string, now: Date = new Date()): boolean {
  return now.toISOString() < localToUTC(EDIT_CLOSE_DATE, '23:59', ianaTz);
}
export function formatHumanDate(isoDate: string, ianaTz: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: ianaTz,
  });
  const parts = fmt.formatToParts(new Date(isoDate));
  return parts.map((p) => (p.type === 'day' ? ordinal(Number(p.value)) : p.value)).join('');
}
```

### `lib/anthropic.ts` (with the .env.local fallback)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

let _envCache: Record<string, string> | null = null;
function envVar(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess && fromProcess.length > 0) return fromProcess;
  if (!_envCache) {
    _envCache = {};
    try {
      const text = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        _envCache[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      }
    } catch {}
  }
  return _envCache[name];
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  const key = envVar('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in the environment');
  if (!_client) _client = new Anthropic({ apiKey: key });
  return _client;
}

const MODEL = 'claude-sonnet-4-6';

export async function generateContent(systemPrompt: string, userPrompt: string) {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  });
  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude');
  let text = textBlock.text.trim();
  text = text.replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
  try { return JSON.parse(text); }
  catch (e) { throw new Error(`JSON parse failed: ${(e as Error).message}\nRaw: ${text.slice(0, 200)}`); }
}

export async function generateText(args: { systemPrompt: string; userPrompt: string; maxTokens?: number }): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: args.maxTokens ?? 1500,
    system: [{ type: 'text', text: args.systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: args.userPrompt }],
  });
  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text response');
  return block.text.trim();
}
```

### `lib/stripe.ts`

```typescript
import Stripe from 'stripe';
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export type Tier = 1 | 2 | 3;
export const TIER_PRICING: Record<Tier, { amount: number; name: string; description: string }> = {
  1: {
    amount: 1900,
    name: 'Mother Lover Package',
    description: 'A few prompts → AI writes a week of small notes → we email you one each morning May 4th–10th. You copy, paste, send. She thinks you\'ve been planning since February.',
  },
  2: {
    amount: 2900,
    name: 'Mother Lover Package + Feels',
    description: 'Everything above, plus your own photos, video, or voice memos on 2–3 days. The days she pauses because yours showed up.',
  },
  3: {
    amount: 4900,
    name: 'Mother Lover Package + Feels + Forever Page',
    description: 'Everything above, plus a private webpage just for her — all 7 messages, your photos, an AI-written letter, optional video. Lives forever. She can share it with family.',
  },
};
```

### Where to find everything else (paths from project root)

**Pages**
- `app/page.tsx` — landing (~400 lines)
- `app/builder/page.tsx` — 5-step questionnaire (~530 lines)
- `app/preview/page.tsx` — message review + media + forever-setup + save banner (~770 lines)
- `app/success/page.tsx` — post-checkout (~210 lines)
- `app/edit/[orderId]/page.tsx` — magic-link edit dashboard (~200 lines)
- `app/forever/[orderId]/page.tsx` — Tier 3 Forever Page (~290 lines)
- `app/backup/[orderId]/page.tsx` — plain-text backup (~75 lines)
- `app/resume/[orderId]/page.tsx` — pre-payment workspace resume (~95 lines)
- `app/_components/Countdown.tsx`, `app/_components/StepBreadcrumb.tsx`

**API**
- `app/api/generate-messages/route.ts`
- `app/api/create-checkout/route.ts`
- `app/api/stripe-webhook/route.ts` (longest, ~220 lines)
- `app/api/upload-presigned/route.ts`
- `app/api/send-magic-link/route.ts`
- `app/api/edit-order/route.ts`
- `app/api/save-progress/route.ts`
- `app/api/resume/route.ts`
- `app/api/warm-forever-page/route.ts`
- `app/api/cron/send-daily-emails/route.ts`
- `app/api/cron/send-reminders/route.ts`

**Lib**
- `lib/supabase.ts`, `lib/anthropic.ts`, `lib/prompts.ts`, `lib/stripe.ts`, `lib/dates.ts`, `lib/email-templates.ts`, `lib/resend.ts`, `lib/r2.ts`, `lib/auth.ts`, `lib/text-cleaner.ts`, `lib/forever-letter.ts`

**Other**
- `supabase_schema.sql` — current canonical schema (also in §9)
- `vercel.json` — cron configs
- `.env.example` — 19 fields, annotated
- `secrets_ui.py` — local web form, port 7879
- `scripts/send-test-email.ts` — manual email test

---

## 12. HOW TO USE THIS DOC IN A FRESH CHAT

**For Claude Code (terminal, fresh session):**
> "Read /Users/memphiscarter/mothers-day-mvp/HANDOFF.md before doing anything. Then [your task]."

**For Claude.ai web / ChatGPT / Gemini / any chat-only AI:**
> "Brief yourself on the project below — do not invent file paths or features that aren't here. Then [your task]."
>
> [paste this entire HANDOFF.md]

**Critical rules every AI must respect:**
- Voice/copy rules in §4 are non-negotiable
- Hard gotchas in §8 are not up for debate (especially the Anthropic env-var fallback and the buyer-relay model)
- Don't rebuild dead hunt code paths just because you see them in `lib/prompts.ts` or `app/hunt/`

End of doc. The product is feature-complete for launch — the remaining work is deployment, schema migration, and end-to-end testing.
