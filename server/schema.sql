-- Campus Cue: Database Schema for Supabase (PostgreSQL) - Phase 2 with AI Columns

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Emails Table
-- Stores student emails with categories, AI summaries, priorities, deadlines, and follow-up flags
-- ============================================================================
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Academics', 'Placements', 'Clubs', 'Events', 'Announcements')),
    user_category VARCHAR(50) CHECK (user_category IN ('Academics', 'Placements', 'Clubs', 'Events', 'Announcements')),
    summary TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'Low', 'Medium', 'High')),
    priority_reason TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deadline TIMESTAMPTZ,
    deadline_confidence VARCHAR(20) DEFAULT 'confirmed' CHECK (deadline_confidence IN ('confirmed', 'uncertain')),
    required_action TEXT,
    needs_followup BOOLEAN NOT NULL DEFAULT FALSE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    ai_processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Reminders Table
-- Stores follow-up reminders associated with emails
-- ============================================================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    reminder_text TEXT NOT NULL,
    due_date TIMESTAMPTZ,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
CREATE INDEX IF NOT EXISTS idx_emails_user_category ON emails(user_category);
CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority);
CREATE INDEX IF NOT EXISTS idx_emails_deadline ON emails(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_deadline_confidence ON emails(deadline_confidence);
CREATE INDEX IF NOT EXISTS idx_emails_needs_followup ON emails(needs_followup);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_email_id ON reminders(email_id);
CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON reminders(is_completed);

-- Migration Helper (for existing databases)
ALTER TABLE emails ADD COLUMN IF NOT EXISTS user_category VARCHAR(50);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS priority_reason TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS deadline_confidence VARCHAR(20) DEFAULT 'confirmed';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS required_action TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT FALSE;
