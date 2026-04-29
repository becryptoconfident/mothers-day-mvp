-- Mother's Day MVP — Supabase schema (v2: email-only, 3 tiers, media + edit + hunt)
-- Paste into Supabase SQL editor. Idempotent — safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop legacy phone columns from a prior version, if present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='orders' AND column_name='user_phone') THEN
    ALTER TABLE orders DROP COLUMN user_phone;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='orders' AND column_name='mom_phone') THEN
    ALTER TABLE orders DROP COLUMN mom_phone;
  END IF;
  -- If a previous run created mom_email NOT NULL, relax it now.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='orders' AND column_name='mom_email' AND is_nullable='NO') THEN
    ALTER TABLE orders ALTER COLUMN mom_email DROP NOT NULL;
  END IF;
  -- Add extra_reminders if missing (older schemas).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='extra_reminders') THEN
    ALTER TABLE orders ADD COLUMN extra_reminders BOOLEAN DEFAULT FALSE;
  END IF;
  -- Tier 3 forever-page data: { long_note, video_url } JSONB. (Replaced hunt clues.)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orders' AND column_name='forever_data') THEN
    ALTER TABLE orders ADD COLUMN forever_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Tier: 1 = $19 messages, 2 = $29 messages+media, 3 = $39 full experience
  tier SMALLINT NOT NULL DEFAULT 1 CHECK (tier IN (1,2,3)),

  -- User (the buyer)
  user_email TEXT NOT NULL,
  user_name TEXT,

  -- Mom (email optional in buyer-relay model — buyer texts mom from their phone)
  mom_email TEXT,
  mom_name TEXT,

  -- Delivery preferences (8am morning email TO THE BUYER)
  delivery_time TEXT NOT NULL DEFAULT '08:00',          -- HH:MM 24h, in user's local TZ
  delivery_timezone TEXT NOT NULL DEFAULT 'America/Chicago',

  -- Optional 1pm gentle reminder (ADHD/neurodivergent opt-in)
  extra_reminders BOOLEAN DEFAULT FALSE,

  -- 5 question answers
  question_1 TEXT NOT NULL,
  question_2 TEXT NOT NULL,
  question_3 TEXT NOT NULL,
  question_4 TEXT NOT NULL,

  -- AI-generated 7 messages: { day_1: "...", ..., day_7: "..." }
  messages JSONB NOT NULL,

  -- Media (tier 2+): array of { day, type, url, caption }
  media JSONB DEFAULT '[]'::jsonb,

  -- Tier 3 Forever Page extras: { long_note: string, video_url: string }
  forever_data JSONB DEFAULT '{}'::jsonb,

  -- Legacy hunt fields (deprecated — kept for back-compat with old orders, may be NULL)
  hunt_clues JSONB,
  hunt_finale JSONB,

  -- Stripe
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  amount_paid INTEGER NOT NULL,    -- cents
  paid BOOLEAN DEFAULT FALSE,

  -- Email scheduling: ids of Resend-scheduled emails so we can cancel on edit
  scheduled_email_ids JSONB DEFAULT '{}'::jsonb,
  emails_sent JSONB DEFAULT '{}'::jsonb,

  -- Edit window: closes May 3 23:59:59 in user's local TZ (computed app-side)
  edit_locked BOOLEAN DEFAULT FALSE,

  -- Hunt progress (mom's POV)
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
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Magic-link tokens for /edit dashboard. Short-lived, single-use.
CREATE TABLE IF NOT EXISTS edit_tokens (
  token TEXT PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS edit_tokens_order_idx ON edit_tokens(order_id);
CREATE INDEX IF NOT EXISTS edit_tokens_expires_idx ON edit_tokens(expires_at);
ALTER TABLE edit_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB
);
CREATE INDEX IF NOT EXISTS analytics_events_order_idx ON analytics_events(order_id);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(event_name);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  endpoint TEXT,
  error TEXT,
  stack TEXT,
  context JSONB
);
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON error_logs(created_at);
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
