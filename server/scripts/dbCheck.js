import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import supabase from '../src/supabaseClient.js';

import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const REQUIRED_SCHEMA = {
  emails: [
    'id', 'user_id', 'source', 'external_id', 'content_hash', 'recipient',
    'sender', 'sender_name', 'subject', 'body', 'attachments', 'is_read',
    'is_archived', 'received_at', 'created_at',
  ],
  email_analysis: [
    'id', 'email_id', 'category', 'user_category', 'summary', 'priority',
    'user_priority', 'priority_reason', 'deadline', 'user_deadline',
    'deadline_label', 'deadline_completed', 'deadline_confidence', 'required_action',
    'needs_reply', 'needs_action', 'reminder_note', 'source', 'model', 'status',
    'error', 'processed_at',
  ],
  reminders: [
    'id', 'user_id', 'email_id', 'type', 'status', 'snoozed_until', 'created_at',
  ],
  digests: [
    'id', 'user_id', 'date', 'content', 'created_at',
  ],
  user_tokens: [
    'id', 'user_id', 'provider', 'access_token', 'refresh_token',
    'token_expiry', 'created_at', 'updated_at',
  ],
  v_emails_with_analysis: [
    'id', 'user_id', 'source', 'external_id', 'content_hash', 'recipient',
    'sender', 'sender_name', 'subject', 'body', 'attachments', 'is_read',
    'is_archived', 'received_at', 'created_at', 'effective_category',
    'ai_category', 'user_category', 'effective_priority', 'ai_priority',
    'user_priority', 'priority_reason', 'effective_deadline', 'ai_deadline',
    'user_deadline', 'deadline_label', 'deadline_completed', 'deadline_confidence', 'summary',
    'required_action', 'needs_reply', 'needs_action', 'reminder_note',
    'analysis_source', 'analysis_status', 'analysis_error', 'analysis_model', 'processed_at',
  ],
};

async function runDbCheck() {
  console.log('====================================================================');
  console.log('Campus Cue Database Verification (npm run db:check)');
  console.log('====================================================================');

  if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL is missing in server/.env');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing in server/.env (required when RLS is enabled)');
    process.exit(1);
  }
  if (!supabase) {
    console.error('❌ Supabase client failed to initialize.');
    process.exit(1);
  }

  let hasFailure = false;

  for (const [relation, columns] of Object.entries(REQUIRED_SCHEMA)) {
    const { error: batchErr } = await supabase.from(relation).select(columns.join(',')).limit(1);
    if (!batchErr) {
      console.log(`✅ ${relation}: exists & all ${columns.length} columns verified`);
      continue;
    }

    const { error: tableErr } = await supabase.from(relation).select(columns[0]).limit(1);
    if (tableErr) {
      hasFailure = true;
      console.error(`❌ Relation missing or inaccessible: ${relation} -> ${tableErr.message}`);
      continue;
    }

    const missingCols = [];
    for (const col of columns) {
      const { error: colErr } = await supabase.from(relation).select(col).limit(1);
      if (colErr) {
        missingCols.push(`${col} (${colErr.message})`);
      }
    }

    if (missingCols.length > 0) {
      hasFailure = true;
      console.error(`❌ ${relation}: missing columns -> ${missingCols.join(', ')}`);
    }
  }

  // Verify RLS enforcement via anon key if configured
  if (process.env.SUPABASE_ANON_KEY) {
    const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const table of ['emails', 'email_analysis', 'reminders', 'digests', 'user_tokens']) {
      const { data: anonRows, error: anonErr } = await anonClient.from(table).select('id').limit(1);
      const rlsOk = Boolean(anonErr) || (Array.isArray(anonRows) && anonRows.length === 0);
      if (!rlsOk) {
        hasFailure = true;
        console.error(`❌ RLS check FAILED on ${table}: anon key was able to read rows!`);
      } else {
        console.log(`🔒 RLS verified on ${table} (anon blocked / 0 rows visible)`);
      }
    }
  }

  console.log('====================================================================');
  if (hasFailure) {
    console.error('❌ Database check found missing tables, columns, or RLS gaps.');
    console.error('👉 Run the updated server/schema.sql in Supabase Dashboard -> SQL Editor.');
    process.exit(1);
  }
  console.log('🎉 ALL DATABASE TABLES, COLUMNS & RLS VERIFIED WITH SERVICE ROLE KEY!');
}

runDbCheck().catch((err) => {
  console.error('❌ Unexpected db:check error:', err);
  process.exit(1);
});
