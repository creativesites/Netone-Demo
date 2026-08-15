-- NetOne Lead Automation — schema
-- Deliberately small: leads + an append-only event log + a dedup guard.

CREATE TABLE IF NOT EXISTS leads (
  id                   SERIAL PRIMARY KEY,
  external_contact_id  TEXT        NOT NULL,
  channel              TEXT        NOT NULL,
  source               TEXT        NOT NULL DEFAULT 'Social / Demo',
  name                 TEXT,
  phone                TEXT,
  initial_message      TEXT        NOT NULL,
  intent               TEXT,
  product              TEXT,
  financing_interest   BOOLEAN,
  purchase_intent      TEXT,
  qualification_status TEXT,
  ai_reasoning         TEXT,
  ai_summary           TEXT,
  ai_source            TEXT,
  bitrix_lead_id       TEXT,
  bitrix_status        TEXT,           -- pending | synced | failed
  bitrix_synced_at     TIMESTAMPTZ,
  assigned_to          TEXT,
  next_action          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One live lead per contact per channel (repeat messages update it).
  CONSTRAINT leads_channel_contact_uniq UNIQUE (channel, external_contact_id)
);

CREATE TABLE IF NOT EXISTS lead_events (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'info',  -- ok | error | info
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_events_lead_id_idx ON lead_events(lead_id);

-- Idempotency guard: dedup inbound messages by channel + external message id.
CREATE TABLE IF NOT EXISTS processed_messages (
  channel              TEXT        NOT NULL,
  external_message_id  TEXT        NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel, external_message_id)
);

-- Lead profile enrichment collected conversationally by the agent.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS collected        JSONB   NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT false;

-- ── Inbox: conversations + messages (mirrored to Firestore) ──
CREATE TABLE IF NOT EXISTS conversations (
  id                   SERIAL PRIMARY KEY,
  channel              TEXT        NOT NULL,
  external_contact_id  TEXT        NOT NULL,
  contact_name         TEXT,
  phone                TEXT,
  is_lead              BOOLEAN     NOT NULL DEFAULT false,
  lead_id              INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  last_message         TEXT,
  last_direction       TEXT,                       -- inbound | outbound
  last_message_at      TIMESTAMPTZ,
  unread_count         INTEGER     NOT NULL DEFAULT 0,
  intent               TEXT,
  sentiment            TEXT,                        -- positive | neutral | negative
  ai_priority          TEXT,                        -- high | medium | low
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_channel_contact_uniq UNIQUE (channel, external_contact_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id                   SERIAL PRIMARY KEY,
  conversation_id      INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction            TEXT    NOT NULL,            -- inbound | outbound
  sender               TEXT    NOT NULL DEFAULT 'contact', -- contact | agent | system
  body                 TEXT    NOT NULL,
  external_message_id  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);

-- The exact channel-native address to reply to (e.g. a WhatsApp JID). Not
-- always a dialable phone number — WhatsApp increasingly uses LID privacy
-- identifiers ("<digits>@lid") instead of phone-number JIDs, and replying by
-- reconstructing "<phone-digits>@s.whatsapp.net" from those silently fails.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS raw_reply_address TEXT;

-- Outbound delivery outcome — null for inbound messages (not applicable) or
-- outbound messages sent before this column existed. Lets the inbox show a
-- clear "not delivered" indicator instead of a failed send looking identical
-- to a successful one.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT;

-- ── Runtime settings (auto-reply toggle, etc.) ──────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
