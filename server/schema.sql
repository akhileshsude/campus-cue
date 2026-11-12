-- ============================================================================
-- Campus Cue Database Schema (Supabase / PostgreSQL)
-- Phase 3 & 4 Final Architecture (Step 11 & Step 13)
-- ============================================================================

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Emails Table
-- Stores raw correspondence ingested via paste, .eml upload, or Gmail sync.
-- Unique constraint on (user_id, content_hash) prevents duplicate reprocessing.
-- ============================================================================
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'default_student',
    source VARCHAR(20) NOT NULL DEFAULT 'paste' CHECK (source IN ('paste', 'eml', 'gmail', 'outlook', 'microsoft', 'imap', 'webhook', 'sample')),
    external_id TEXT, -- e.g. Gmail message ID or IMAP Message-ID
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of sender + subject + body
    recipient VARCHAR(255), -- Target email ID that received this email
    sender VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb, -- list of attachment filenames
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_emails_user_content UNIQUE (user_id, content_hash)
);

-- Idempotent column & constraint migrations for previously initialized databases
ALTER TABLE emails ADD COLUMN IF NOT EXISTS recipient VARCHAR(255);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_source_check;
ALTER TABLE emails ADD CONSTRAINT emails_source_check CHECK (source IN ('paste', 'eml', 'gmail', 'outlook', 'microsoft', 'imap', 'webhook', 'sample'));

-- ============================================================================
-- 2. Email Analysis Table
-- Stores structured AI classification, summaries, priorities, deadlines, and student overrides.
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Academics', 'Placements', 'Clubs', 'Events', 'Announcements')),
    user_category VARCHAR(50) CHECK (user_category IN ('Academics', 'Placements', 'Clubs', 'Events', 'Announcements')),
    summary TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low', 'high', 'medium', 'low')),
    user_priority VARCHAR(20) CHECK (user_priority IN ('High', 'Medium', 'Low')),
    priority_reason TEXT,
    deadline TIMESTAMPTZ,
    user_deadline TIMESTAMPTZ,
    deadline_label TEXT,
    deadline_completed BOOLEAN NOT NULL DEFAULT FALSE,
    deadline_confidence VARCHAR(20) DEFAULT 'confirmed' CHECK (deadline_confidence IN ('confirmed', 'uncertain')),
    required_action TEXT,
    needs_reply BOOLEAN NOT NULL DEFAULT FALSE,
    needs_action BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_note TEXT,
    source VARCHAR(30) NOT NULL DEFAULT 'gemini' CHECK (source IN ('gemini', 'heuristic', 'fallback')),
    model VARCHAR(100) DEFAULT 'gemini-3.5-flash-lite',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    error TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_email_analysis_email UNIQUE (email_id)
);

ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS deadline_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS deadline_label TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'gemini';

-- ============================================================================
-- 3. Reminders Table
-- Tracks student action items and reply reminders with snooze capabilities.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT '',
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'action' CHECK (type IN ('reply', 'action')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'snoozed')),
    snoozed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reminders_email UNIQUE (email_id)
);

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
DO $$
BEGIN
  DELETE FROM reminders a USING reminders b WHERE a.ctid < b.ctid AND a.email_id = b.email_id;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_reminders_email') THEN
    ALTER TABLE reminders ADD CONSTRAINT uq_reminders_email UNIQUE (email_id);
  END IF;
END $$;

-- ============================================================================
-- 4. Academic Command Center Digests Table
-- Caches daily synthesized briefings for reuse throughout the day.
-- ============================================================================
CREATE TABLE IF NOT EXISTS digests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'default_student',
    date DATE NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. User Auth & OAuth Tokens Table
-- Stores AES-256-GCM encrypted Google / Microsoft OAuth tokens for inbox sync.
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'default_student',
    provider VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_tokens_provider UNIQUE (user_id, provider)
);

-- ============================================================================
-- Row Level Security (Server queries strictly authenticate with service role key)
-- ============================================================================
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Unified View: v_emails_with_analysis
-- Convenient view combining raw emails with their latest AI analysis & overrides.
-- ============================================================================
DROP VIEW IF EXISTS v_emails_with_analysis;
CREATE VIEW v_emails_with_analysis AS
SELECT 
    e.id,
    e.user_id,
    e.source,
    e.external_id,
    e.content_hash,
    e.recipient,
    e.sender,
    e.sender_name,
    e.subject,
    e.body,
    e.attachments,
    e.is_read,
    e.is_archived,
    e.received_at,
    e.created_at,
    COALESCE(a.user_category, a.category, 'Announcements') AS effective_category,
    a.category AS ai_category,
    a.user_category,
    COALESCE(a.user_priority, a.priority, 'Medium') AS effective_priority,
    a.priority AS ai_priority,
    a.user_priority,
    a.priority_reason,
    COALESCE(a.user_deadline, a.deadline) AS effective_deadline,
    a.deadline AS ai_deadline,
    a.user_deadline,
    a.deadline_label,
    a.deadline_completed,
    a.deadline_confidence,
    a.summary,
    a.required_action,
    a.needs_reply,
    a.needs_action,
    a.reminder_note,
    a.source AS analysis_source,
    a.status AS analysis_status,
    a.error AS analysis_error,
    a.model AS analysis_model,
    a.processed_at
FROM emails e
LEFT JOIN email_analysis a ON e.id = a.email_id;

-- ============================================================================
-- Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_emails_user_hash ON emails(user_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_emails_source ON emails(source);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_analysis_email ON email_analysis(email_id);
CREATE INDEX IF NOT EXISTS idx_email_analysis_status ON email_analysis(status);
CREATE INDEX IF NOT EXISTS idx_email_analysis_category ON email_analysis(category);
CREATE INDEX IF NOT EXISTS idx_email_analysis_user_category ON email_analysis(user_category);
CREATE INDEX IF NOT EXISTS idx_email_analysis_priority ON email_analysis(priority);
CREATE INDEX IF NOT EXISTS idx_email_analysis_deadline ON email_analysis(deadline);
CREATE INDEX IF NOT EXISTS idx_reminders_email ON reminders(email_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_digests_user_date ON digests(user_id, date DESC);
