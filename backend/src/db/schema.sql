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
