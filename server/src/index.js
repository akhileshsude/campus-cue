import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { simpleParser } from 'mailparser';
import { google } from 'googleapis';
import supabase from './supabaseClient.js';
import { sampleEmails, sampleDigest, sampleReminders } from './sampleData.js';
import { processEmail, generateReplyDraft, computeContentHash, validateAndSanitizeDate } from '../services/emailProcessor.js';
import { generateAcademicDigest } from '../services/digestGenerator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const CORS_ORIGIN = process.env.CLIENT_URL || process.env.CORS_ORIGIN || '*';

// Multer memory storage for .eml file uploads (up to 25MB, up to 15 files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 15 },
});

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// In-memory state initialized with sample data (for development & offline fallback)
let memoryEmails = JSON.parse(JSON.stringify(sampleEmails));
let memoryReminders = JSON.parse(JSON.stringify(sampleReminders));
let memoryDigest = JSON.parse(JSON.stringify(sampleDigest));
let googleTokens = null;

// Initialize Google OAuth2 Client if configured
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/google/callback`;

let oauth2Client = null;
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && !GOOGLE_CLIENT_ID.includes('your_google')) {
  try {
    oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );
  } catch (err) {
    console.warn('⚠️ Could not initialize Google OAuth2 client:', err.message);
  }
}

// Helpers to resolve effective values (student overrides take strict priority everywhere)
function getEffectiveCategory(email) {
  return email.user_category || email.category;
}

function getEffectivePriority(email) {
  return email.user_priority || email.priority;
}

function getEffectiveDeadline(email) {
  return email.user_deadline || email.deadline;
}

// Helper to sync reminder for an email
function syncReminderForEmail(emailObj, aiResult) {
  if (aiResult.needs_reply || aiResult.needs_action || aiResult.needs_followup) {
    const reminderId = `rem-${emailObj.id}`;
    const remIndex = memoryReminders.findIndex(r => (r.email_id || r.emailId) === emailObj.id);
    const reminderType = aiResult.needs_reply ? 'reply' : 'action';
    const reminderNote = aiResult.reminder_note || aiResult.required_action || 'Action required';

    const reminderData = {
      id: reminderId,
      email_id: emailObj.id,
      emailId: emailObj.id,
      sender: emailObj.sender,
      senderName: emailObj.senderName || emailObj.sender,
      subject: emailObj.subject,
      reminder_type: reminderType,
      reminder_note: reminderNote,
      reminder_text: `${emailObj.subject}: ${reminderNote}`,
      status: 'pending',
      due_date: emailObj.deadline || null,
      snoozed_until: null,
      is_completed: false,
      created_at: emailObj.received_at || new Date().toISOString(),
    };

    if (remIndex >= 0) {
      memoryReminders[remIndex] = reminderData;
    } else {
      memoryReminders.unshift(reminderData);
    }

    if (supabase) {
      supabase.from('reminders').upsert(reminderData).catch(e => console.warn('Supabase reminder sync error:', e.message));
    }
  }
}

// ============================================================================
// Routes
// ============================================================================

// 1. Health-check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Campus Cue API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.AI_API_KEY),
    supabaseConnected: Boolean(supabase),
    gmailConfigured: Boolean(oauth2Client),
    gmailConnected: Boolean(googleTokens?.access_token),
  });
});

// 2. Fetch all emails (supports filters: category, priority, status/unreadOnly and pagination: page, limit)
app.get('/api/emails', async (req, res) => {
  const { category, priority, status, unreadOnly, page, limit } = req.query;

  try {
    let sourceData = memoryEmails;
    if (supabase) {
      let query = supabase.from('emails').select('*').order('received_at', { ascending: false });
      const { data, error } = await query;
      if (error) {
        console.warn('⚠️ Supabase error, falling back to sample data:', error.message);
      } else if (data && data.length > 0) {
        sourceData = data;
      }
    }

    let results = [...sourceData];

    // Filter by effective category (user override takes priority)
    if (category && category !== 'All') {
      results = results.filter(e => getEffectiveCategory(e).toLowerCase() === category.toLowerCase());
    }

    // Filter by effective priority (user override takes priority)
    if (priority && priority !== 'All') {
      results = results.filter(e => getEffectivePriority(e).toLowerCase() === priority.toLowerCase());
    }

    // Filter by read/unread status
    if (unreadOnly === 'true' || status === 'unread') {
      results = results.filter(e => !e.is_read);
    } else if (status === 'read') {
      results = results.filter(e => e.is_read);
    }

    const total = results.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 0;

    let paginated = results;
    if (limitNum > 0) {
      const start = (pageNum - 1) * limitNum;
      paginated = results.slice(start, start + limitNum);
    }

    res.json({
      emails: paginated,
      count: paginated.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1,
      source: supabase ? 'supabase' : 'sample_data',
    });
  } catch (err) {
    console.error('Error fetching emails:', err);
    res.status(500).json({ error: 'Failed to fetch emails', details: err.message });
  }
});

// 3. Process Single Email with AI (POST /api/emails/process) with Content Hash Deduplication
app.post('/api/emails/process', async (req, res) => {
  const { id, subject, body, sender, received_at, receivedAt, save_as_new, force_reprocess } = req.body;

  let targetEmail = null;
  if (id) {
    targetEmail = memoryEmails.find(e => e.id === id);
  }

  const emailToProcess = {
    subject: subject || targetEmail?.subject || '',
    body: body || targetEmail?.body || '',
    sender: sender || targetEmail?.sender || 'Unknown Sender',
    receivedAt: received_at || receivedAt || targetEmail?.received_at || new Date().toISOString(),
  };

  if (!emailToProcess.subject && !emailToProcess.body) {
    return res.status(400).json({ error: 'Subject and body are required to process an email' });
  }

  // Step 11: Compute content hash (SHA-256) of sender + subject + body
  const contentHash = computeContentHash(emailToProcess.sender, emailToProcess.subject, emailToProcess.body);

  // Check for duplicate already processed (unless force_reprocess requested or updating existing by id)
  if (!force_reprocess && !id) {
    const existing = memoryEmails.find(e => e.content_hash === contentHash);
    if (existing) {
      console.log(`ℹ️ Duplicate email detected (content_hash: ${contentHash.slice(0, 8)}...). Skipping LLM call.`);
      return res.json({
        message: 'Email already processed. Reusing existing intelligence.',
        skipped: true,
        email: existing,
        aiResult: existing,
      });
    }
  }

  try {
    console.log(`🤖 Processing email with AI: "${emailToProcess.subject.slice(0, 40)}..."`);
    const aiResult = await processEmail(emailToProcess);

    if (id && targetEmail) {
      const emailIndex = memoryEmails.findIndex(e => e.id === id);
      const updated = {
        ...targetEmail,
        content_hash: contentHash,
        category: aiResult.category,
        summary: aiResult.summary,
        priority: aiResult.priority,
        priority_reason: aiResult.priority_reason,
        deadline: aiResult.deadline,
        deadline_confidence: aiResult.deadline_confidence,
        required_action: aiResult.required_action,
        needs_followup: aiResult.needs_followup,
        needs_reply: aiResult.needs_reply,
        needs_action: aiResult.needs_action,
        reminder_note: aiResult.reminder_note,
        ai_processed: true,
        processed_at: new Date().toISOString(),
      };

      memoryEmails[emailIndex] = updated;
      syncReminderForEmail(updated, aiResult);

      if (supabase) {
        try {
          await supabase.from('emails').upsert(updated);
        } catch (dbErr) {
          console.warn('⚠️ Supabase upsert error:', dbErr.message);
        }
      }

      return res.json({
        message: 'Email processed successfully with AI',
        email: updated,
        aiResult,
      });
    }

    if (save_as_new) {
      const newId = `cue-ingest-${Date.now()}`;
      const senderName = emailToProcess.sender.includes('<')
        ? emailToProcess.sender.split('<')[0].trim()
        : emailToProcess.sender;

      const newEmail = {
        id: newId,
        content_hash: contentHash,
        sender: emailToProcess.sender,
        senderName: senderName || 'New Correspondence',
        subject: emailToProcess.subject,
        body: emailToProcess.body,
        category: aiResult.category,
        user_category: null,
        user_priority: null,
        user_deadline: null,
        edited_by_user: false,
        summary: aiResult.summary,
        priority: aiResult.priority,
        priority_reason: aiResult.priority_reason,
        received_at: emailToProcess.receivedAt,
        deadline: aiResult.deadline,
        deadline_label: aiResult.deadline ? 'Action Deadline' : null,
        deadline_confidence: aiResult.deadline_confidence,
        required_action: aiResult.required_action,
        needs_followup: aiResult.needs_followup,
        needs_reply: aiResult.needs_reply,
        needs_action: aiResult.needs_action,
        reminder_note: aiResult.reminder_note,
        is_read: false,
        ai_processed: true,
        processed_at: new Date().toISOString(),
      };

      memoryEmails.unshift(newEmail);
      syncReminderForEmail(newEmail, aiResult);

      if (supabase) {
        try {
          await supabase.from('emails').insert(newEmail);
        } catch (dbErr) {
          console.warn('⚠️ Supabase insert error:', dbErr.message);
        }
      }

      return res.status(201).json({
        message: 'Email ingested, analyzed and saved successfully',
        email: newEmail,
        aiResult,
      });
    }

    res.json({
      message: 'Email analyzed successfully with AI',
      content_hash: contentHash,
      aiResult,
    });
  } catch (err) {
    console.error('Error processing email with AI:', err);
    res.status(500).json({ error: 'Failed to process email with AI', details: err.message });
  }
});

// Step 11: Single Email Reprocess Endpoint (POST /api/emails/:id/reprocess)
app.post('/api/emails/:id/reprocess', async (req, res) => {
  const { id } = req.params;
  const targetEmail = memoryEmails.find(e => e.id === id);

  if (!targetEmail) {
    return res.status(404).json({ error: 'Email not found to reprocess' });
  }

  try {
    console.log(`🤖 Reprocessing email with AI on manual click: "${targetEmail.subject.slice(0, 40)}..."`);
    const aiResult = await processEmail({
      subject: targetEmail.subject,
      body: targetEmail.body,
      sender: targetEmail.sender,
      receivedAt: targetEmail.received_at,
    });

    const emailIndex = memoryEmails.findIndex(e => e.id === id);
    const updated = {
      ...targetEmail,
      category: aiResult.category,
      summary: aiResult.summary,
      priority: aiResult.priority,
      priority_reason: aiResult.priority_reason,
      deadline: aiResult.deadline,
      deadline_confidence: aiResult.deadline_confidence,
      required_action: aiResult.required_action,
      needs_followup: aiResult.needs_followup,
      needs_reply: aiResult.needs_reply,
      needs_action: aiResult.needs_action,
      reminder_note: aiResult.reminder_note,
      ai_processed: true,
      processed_at: new Date().toISOString(),
    };

    memoryEmails[emailIndex] = updated;
    syncReminderForEmail(updated, aiResult);

    if (supabase) {
      try {
        await supabase.from('emails').upsert(updated);
      } catch (dbErr) {
        console.warn('⚠️ Supabase upsert error on reprocess:', dbErr.message);
      }
    }

    res.json({
      message: 'Email reprocessed successfully with AI',
      email: updated,
      aiResult,
    });
  } catch (err) {
    console.error('Error reprocessing email:', err);
    res.status(500).json({ error: 'Failed to reprocess email', details: err.message });
  }
});

// 4. Batch Process All Emails with AI (POST /api/emails/process-all) with rate-limit queue delay
app.post('/api/emails/process-all', async (req, res) => {
  try {
    console.log(`🤖 Batch processing ${memoryEmails.length} emails with rate-limiting pacing...`);
    const results = [];
    const BATCH_SIZE = 2;
    const DELAY_BETWEEN_BATCHES_MS = 1200;

    for (let i = 0; i < memoryEmails.length; i += BATCH_SIZE) {
      const slice = memoryEmails.slice(i, i + BATCH_SIZE);
      const batchPromises = slice.map(async (email) => {
        const aiResult = await processEmail({
          subject: email.subject,
          body: email.body,
          sender: email.sender,
          receivedAt: email.received_at,
        });

        const updated = {
          ...email,
          category: aiResult.category,
          summary: aiResult.summary,
          priority: aiResult.priority,
          priority_reason: aiResult.priority_reason,
          deadline: aiResult.deadline,
          deadline_confidence: aiResult.deadline_confidence,
          required_action: aiResult.required_action,
          needs_followup: aiResult.needs_followup,
          needs_reply: aiResult.needs_reply,
          needs_action: aiResult.needs_action,
          reminder_note: aiResult.reminder_note,
          ai_processed: true,
          processed_at: new Date().toISOString(),
        };

        syncReminderForEmail(updated, aiResult);
        return updated;
      });

      const batchResults = await Promise.all(batchPromises);

      for (const updated of batchResults) {
        const idx = memoryEmails.findIndex(e => e.id === updated.id);
        if (idx !== -1) memoryEmails[idx] = updated;
        results.push(updated);
      }

      // Add respectful delay between batches if more remain
      if (i + BATCH_SIZE < memoryEmails.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    if (supabase) {
      try {
        await supabase.from('emails').upsert(results);
      } catch (dbErr) {
        console.warn('⚠️ Supabase batch upsert error:', dbErr.message);
      }
    }

    res.json({
      message: `Batch processed ${results.length} emails with AI queue pacing`,
      emails: results,
    });
  } catch (err) {
    console.error('Error batch processing emails:', err);
    res.status(500).json({ error: 'Failed to batch process emails', details: err.message });
  }
});

// Step 13: Student Override Endpoint (PATCH /api/emails/:id/override)
// Allows student corrections for category, priority, and deadline (with date picker), overriding AI values everywhere with "Edited by you"
app.patch('/api/emails/:id/override', async (req, res) => {
  const { id } = req.params;
  const { category, priority, deadline } = req.body;

  const emailIndex = memoryEmails.findIndex(e => e.id === id);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  const email = memoryEmails[emailIndex];

  if (category !== undefined) {
    email.user_category = category === 'default' || category === null ? null : category;
  }
  if (priority !== undefined) {
    email.user_priority = priority === 'default' || priority === null ? null : priority;
  }
  if (deadline !== undefined) {
    if (deadline === null || deadline === '') {
      email.user_deadline = null;
    } else {
      const sanitized = validateAndSanitizeDate(deadline);
      email.user_deadline = sanitized.validDate || deadline;
    }
  }

  email.edited_by_user = Boolean(email.user_category || email.user_priority || email.user_deadline);

  // Sync reminder if deadline was modified
  if (deadline !== undefined) {
    const remIndex = memoryReminders.findIndex(r => (r.email_id || r.emailId) === email.id);
    if (remIndex >= 0) {
      memoryReminders[remIndex].due_date = email.user_deadline || email.deadline;
    }
  }

  if (supabase) {
    try {
      await supabase.from('emails').update({
        user_category: email.user_category,
      }).eq('id', id);

      await supabase.from('email_analysis').update({
        user_category: email.user_category,
        user_priority: email.user_priority,
        user_deadline: email.user_deadline,
      }).eq('email_id', id);
    } catch (dbErr) {
      console.warn('⚠️ Supabase override update error:', dbErr.message);
    }
  }

  res.json({
    message: 'Student correction saved successfully',
    email,
  });
});

// 5. Update user category override (PATCH /api/emails/:id/category) [Backward compatible]
app.patch('/api/emails/:id/category', async (req, res) => {
  const { id } = req.params;
  const { category } = req.body;

  const validCategories = ['Academics', 'Placements', 'Clubs', 'Events', 'Announcements'];
  const targetCategory = category === 'default' ? null : category;

  if (targetCategory && !validCategories.includes(targetCategory)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const emailIndex = memoryEmails.findIndex(e => e.id === id);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  memoryEmails[emailIndex].user_category = targetCategory;
  memoryEmails[emailIndex].edited_by_user = Boolean(
    targetCategory || memoryEmails[emailIndex].user_priority || memoryEmails[emailIndex].user_deadline
  );

  if (supabase) {
    try {
      await supabase.from('emails').update({ user_category: targetCategory }).eq('id', id);
    } catch (dbErr) {
      console.warn('⚠️ Supabase category update error:', dbErr.message);
    }
  }

  res.json({
    message: 'User category override saved successfully',
    email: memoryEmails[emailIndex],
  });
});

// Step 14: Reset Demo Data Endpoint (POST /api/reset-demo)
app.post('/api/reset-demo', (req, res) => {
  memoryEmails = JSON.parse(JSON.stringify(sampleEmails));
  memoryReminders = JSON.parse(JSON.stringify(sampleReminders));
  memoryDigest = JSON.parse(JSON.stringify(sampleDigest));

  console.log('🔄 Demo state reset to initial showcase collegiate data.');
  res.json({
    message: 'Demo state reset successfully to default showcase data',
    emailsCount: memoryEmails.length,
    remindersCount: memoryReminders.length,
  });
});

// ============================================================================
// PHASE 3: Step 8 - Academic Command Center Digest Routes
// ============================================================================

// GET /api/digest/today - Returns cached digest for today or synthesizes one if needed
app.get('/api/digest/today', async (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const studentName = req.query.studentName || '';

  try {
    // 1. Check Supabase digests table for today
    if (supabase) {
      const { data, error } = await supabase
        .from('digests')
        .select('*')
        .eq('date', todayStr)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.content) {
        memoryDigest = data.content;
        return res.json({ digest: data.content, source: 'supabase_cached', date: todayStr });
      }
    }

    // 2. Check in-memory digest
    if (memoryDigest && memoryDigest.date === todayStr) {
      return res.json({ digest: memoryDigest, source: 'memory_cached', date: todayStr });
    }

    // 3. Otherwise generate once for today and cache
    console.log(`🤖 Generating daily academic digest for ${todayStr}...`);
    const synthesized = await generateAcademicDigest({
      structuredEmails: memoryEmails,
      studentName,
    });

    memoryDigest = synthesized;

    if (supabase) {
      try {
        await supabase.from('digests').insert({
          user_id: 'default_student',
          date: todayStr,
          content: synthesized,
        });
      } catch (dbErr) {
        console.warn('⚠️ Supabase digest insert error:', dbErr.message);
      }
    }

    res.json({ digest: synthesized, source: 'generated', date: todayStr });
  } catch (err) {
    console.error('Error fetching today digest:', err);
    res.status(500).json({ error: 'Failed to retrieve academic digest', details: err.message });
  }
});

// Backward-compatible alias GET /api/digest
app.get('/api/digest', (req, res) => {
  res.redirect('/api/digest/today');
});

// POST /api/digest/generate - Force regenerates today's digest
app.post('/api/digest/generate', async (req, res) => {
  const { studentName } = req.body || {};
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    console.log(`🤖 Force regenerating academic command center digest...`);
    const digest = await generateAcademicDigest({
      structuredEmails: memoryEmails,
      studentName: studentName || '',
    });

    memoryDigest = digest;

    if (supabase) {
      try {
        await supabase.from('digests').insert({
          user_id: 'default_student',
          date: todayStr,
          content: digest,
        });
      } catch (dbErr) {
        console.warn('⚠️ Supabase digest update error:', dbErr.message);
      }
    }

    res.json({
      message: 'Academic digest refreshed successfully',
      digest,
    });
  } catch (err) {
    console.error('Error generating academic digest:', err);
    res.status(500).json({ error: 'Failed to generate academic digest', details: err.message });
  }
});

// ============================================================================
// PHASE 3: Step 9 - Follow-up Reminders Routes
// ============================================================================

// GET /api/reminders - Returns reminders with pending/reply/action counts
app.get('/api/reminders', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('reminders').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        memoryReminders = data;
      }
    }

    const now = new Date();
    // Filter active pending reminders (excluding active snoozes)
    const activePending = memoryReminders.filter(r => {
      if (r.status === 'done' || r.is_completed) return false;
      if (r.status === 'snoozed' && r.snoozed_until && new Date(r.snoozed_until) > now) return false;
      return true;
    });

    const replyReminders = memoryReminders.filter(r => r.reminder_type === 'reply');
    const actionReminders = memoryReminders.filter(r => r.reminder_type !== 'reply');

    res.json({
      reminders: memoryReminders,
      pendingCount: activePending.length,
      replyCount: replyReminders.filter(r => r.status === 'pending').length,
      actionCount: actionReminders.filter(r => r.status === 'pending').length,
      source: supabase ? 'supabase' : 'memory',
    });
  } catch (err) {
    console.error('Error retrieving reminders:', err);
    res.status(500).json({ error: 'Failed to retrieve reminders', details: err.message });
  }
});

// PATCH /api/reminders/:id - Status toggle, Snooze (1 day / 3 days), Mark Done
app.patch('/api/reminders/:id', async (req, res) => {
  const { id } = req.params;
  const { status, is_completed, snooze_days } = req.body;

  const reminderIndex = memoryReminders.findIndex(r => r.id === id);
  if (reminderIndex === -1) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  const reminder = memoryReminders[reminderIndex];

  if (status) {
    reminder.status = status;
    reminder.is_completed = (status === 'done');
  } else if (typeof is_completed === 'boolean') {
    reminder.is_completed = is_completed;
    reminder.status = is_completed ? 'done' : 'pending';
  }

  if (status === 'snoozed') {
    const days = parseInt(snooze_days, 10) || 1;
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + days);
    reminder.snoozed_until = snoozeDate.toISOString();
  } else if (status === 'pending' || status === 'done') {
    reminder.snoozed_until = null;
  }

  if (supabase) {
    try {
      await supabase.from('reminders').update({
        status: reminder.status,
        is_completed: reminder.is_completed,
        snoozed_until: reminder.snoozed_until,
      }).eq('id', id);
    } catch (dbErr) {
      console.warn('⚠️ Supabase reminder update error:', dbErr.message);
    }
  }

  res.json({
    message: 'Reminder updated successfully',
    reminder,
  });
});

// ============================================================================
// PHASE 4: Step 10 - Email Ingestion (Upload .eml files & Gmail OAuth)
// ============================================================================

// POST /api/emails/upload-eml - Upload and parse multiple .eml files with mailparser
app.post('/api/emails/upload-eml', upload.array('emlFiles', 15), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No .eml files provided in upload request' });
    }

    console.log(`📥 Ingesting ${req.files.length} .eml files via mailparser...`);
    const ingestedEmails = [];

    for (const file of req.files) {
      const parsed = await simpleParser(file.buffer);

      const senderText = parsed.from?.text || parsed.headers.get('from') || 'Unknown Sender';
      const senderName = parsed.from?.value?.[0]?.name || senderText.split('<')[0].trim() || 'Collegiate Sender';
      const subject = parsed.subject || file.originalname.replace(/\.eml$/i, '') || 'No Subject';
      const receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

      // Extract plain text body, falling back to stripped HTML
      let bodyText = (parsed.text || '').trim();
      if (!bodyText && parsed.html) {
        bodyText = parsed.html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      if (!bodyText) {
        bodyText = 'Empty correspondence body.';
      }

      // List attachment filenames without storing heavy binaries
      const attachmentNames = (parsed.attachments || []).map(a => a.filename).filter(Boolean);

      // Compute content hash to prevent duplicate processing
      const contentHash = computeContentHash(senderText, subject, bodyText);
      const existing = memoryEmails.find(e => e.content_hash === contentHash);
      if (existing) {
        console.log(`ℹ️ Duplicate .eml detected (hash: ${contentHash.slice(0, 8)}...). Reusing existing.`);
        ingestedEmails.push(existing);
        continue;
      }

      // Analyze through AI pipeline
      const aiResult = await processEmail({
        subject,
        body: bodyText,
        sender: senderText,
        receivedAt,
      });

      const newId = `cue-eml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newEmail = {
        id: newId,
        content_hash: contentHash,
        sender: senderText,
        senderName,
        subject,
        body: bodyText,
        category: aiResult.category,
        user_category: null,
        user_priority: null,
        user_deadline: null,
        edited_by_user: false,
        summary: aiResult.summary,
        priority: aiResult.priority,
        priority_reason: aiResult.priority_reason,
        received_at: receivedAt,
        deadline: aiResult.deadline,
        deadline_label: aiResult.deadline ? 'Action Deadline' : null,
        deadline_confidence: aiResult.deadline_confidence,
        required_action: aiResult.required_action,
        needs_followup: aiResult.needs_followup,
        needs_reply: aiResult.needs_reply,
        needs_action: aiResult.needs_action,
        reminder_note: aiResult.reminder_note,
        is_read: false,
        ai_processed: true,
        attachments: attachmentNames,
      };

      memoryEmails.unshift(newEmail);
      syncReminderForEmail(newEmail, aiResult);

      if (supabase) {
        try {
          await supabase.from('emails').insert(newEmail);
        } catch (dbErr) {
          console.warn('⚠️ Supabase .eml insert error:', dbErr.message);
        }
      }

      ingestedEmails.push(newEmail);
    }

    res.status(201).json({
      message: `Successfully parsed and processed ${ingestedEmails.length} .eml files`,
      count: ingestedEmails.length,
      emails: ingestedEmails,
    });
  } catch (err) {
    console.error('Error processing .eml files:', err);
    res.status(500).json({ error: 'Failed to parse .eml files', details: err.message });
  }
});

// Google OAuth Status
app.get('/api/auth/status', (req, res) => {
  res.json({
    configured: Boolean(oauth2Client),
    connected: Boolean(googleTokens?.access_token),
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    redirectUri: GOOGLE_REDIRECT_URI,
  });
});

// Initiate Google OAuth Flow
app.get('/api/auth/google', (req, res) => {
  if (!oauth2Client) {
    return res.status(400).json({
      error: 'Google OAuth not configured on backend',
      code: 'CONFIG_MISSING',
      message: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env to enable live Gmail sync. In the meantime, use .eml upload or manual paste.',
    });
  }

  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    });

    res.redirect(authUrl);
  } catch (err) {
    console.error('OAuth URL error:', err);
    res.status(500).json({ error: 'Failed to initiate Google OAuth', details: err.message });
  }
});

// Google OAuth Callback Handler
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.warn('⚠️ Google OAuth callback received error:', error);
    return res.redirect(`/?gmail_error=${encodeURIComponent(error)}`);
  }

  if (!code || !oauth2Client) {
    return res.redirect('/?gmail_error=no_code_provided');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    googleTokens = tokens;

    // Securely persist token to Supabase if connected
    if (supabase) {
      try {
        await supabase.from('user_tokens').upsert({
          user_id: 'default_student',
          provider: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('⚠️ Supabase token save error:', dbErr.message);
      }
    }

    res.redirect('/?gmail=connected');
  } catch (err) {
    console.error('Google token exchange error:', err);
    res.redirect(`/?gmail_error=${encodeURIComponent(err.message)}`);
  }
});

// Sync Inbox via Gmail API (fetches latest 20-30 emails, passes new ones to AI)
app.post('/api/emails/sync-gmail', async (req, res) => {
  if (!oauth2Client || !googleTokens?.access_token) {
    return res.status(400).json({
      success: false,
      error: 'Gmail Not Connected',
      code: 'NOT_CONNECTED',
      message: 'Please connect your Google account or configure Google OAuth credentials in .env. You can also use .eml file upload or manual paste.',
    });
  }

  try {
    oauth2Client.setCredentials(googleTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch latest 25 messages
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 25,
      q: 'category:primary',
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) {
      return res.json({ success: true, count: 0, message: 'No new messages found in primary inbox.' });
    }

    const newSyncEmails = [];

    for (const msgRef of messages.slice(0, 15)) {
      // Check if already fetched
      const exists = memoryEmails.some(e => e.gmail_id === msgRef.id);
      if (exists) continue;

      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: msgRef.id,
        format: 'full',
      });

      const headers = msg.data.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject') || 'No Subject';
      const sender = getHeader('From') || 'Unknown Sender';
      const dateHeader = getHeader('Date');
      const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

      // Extract body snippet or payload data
      let body = msg.data.snippet || '';
      if (msg.data.payload?.parts) {
        const textPart = msg.data.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      const contentHash = computeContentHash(sender, subject, body);

      const aiResult = await processEmail({
        subject,
        body,
        sender,
        receivedAt,
      });

      const newEmail = {
        id: `cue-gmail-${msgRef.id}`,
        gmail_id: msgRef.id,
        content_hash: contentHash,
        sender,
        senderName: sender.split('<')[0].trim() || 'Collegiate Sender',
        subject,
        body,
        category: aiResult.category,
        user_category: null,
        user_priority: null,
        user_deadline: null,
        edited_by_user: false,
        summary: aiResult.summary,
        priority: aiResult.priority,
        priority_reason: aiResult.priority_reason,
        received_at: receivedAt,
        deadline: aiResult.deadline,
        deadline_label: aiResult.deadline ? 'Action Deadline' : null,
        deadline_confidence: aiResult.deadline_confidence,
        required_action: aiResult.required_action,
        needs_followup: aiResult.needs_followup,
        needs_reply: aiResult.needs_reply,
        needs_action: aiResult.needs_action,
        reminder_note: aiResult.reminder_note,
        is_read: false,
        ai_processed: true,
      };

      memoryEmails.unshift(newEmail);
      syncReminderForEmail(newEmail, aiResult);

      if (supabase) {
        try {
          await supabase.from('emails').insert(newEmail);
        } catch (dbErr) {
          console.warn('⚠️ Supabase insert error for synced email:', dbErr.message);
        }
      }

      newSyncEmails.push(newEmail);
    }

    res.json({
      success: true,
      count: newSyncEmails.length,
      message: `Synced ${newSyncEmails.length} new collegiate emails from Gmail`,
      emails: newSyncEmails,
    });
  } catch (err) {
    console.error('Error syncing Gmail:', err);
    // Graceful error handling for Institutional restriction or expired tokens
    const isRestricted = err.message?.includes('access_denied') || err.message?.includes('403') || err.message?.includes('admin_policy_enforced');
    
    res.status(isRestricted ? 403 : 500).json({
      success: false,
      error: isRestricted ? 'Institutional Workspace Restriction' : 'Gmail Sync Error',
      details: isRestricted
        ? 'Your college Google Workspace administrator restricts third-party OAuth apps. You can continue using Campus Cue seamlessly via drag-and-drop .eml upload or manual paste.'
        : err.message,
    });
  }
});

// ============================================================================
// Other Action Routes
// ============================================================================

// Smart AI Reply Drafter (POST /api/emails/reply)
app.post('/api/emails/reply', async (req, res) => {
  const { id, intent, studentNotes, studentName, email: providedEmail } = req.body;

  let targetEmail = memoryEmails.find(e => e.id === id) || providedEmail;

  if (!targetEmail) {
    return res.status(404).json({ error: 'Email not found to draft reply' });
  }

  try {
    console.log(`🤖 Drafting reply for "${targetEmail.subject.slice(0, 35)}..." with intent "${intent || 'polite_confirm'}"`);
    const draft = await generateReplyDraft({
      subject: targetEmail.subject,
      body: targetEmail.body,
      sender: targetEmail.sender,
      action: targetEmail.required_action || targetEmail.followup_action,
      intent: intent || 'polite_confirm',
      studentNotes: studentNotes || '',
      studentName: studentName || '',
    });

    res.json(draft);
  } catch (err) {
    console.error('Error drafting reply:', err);
    res.status(500).json({ error: 'Failed to generate reply draft', details: err.message });
  }
});

// Mark email read/unread
app.patch('/api/emails/:id/read', (req, res) => {
  const { id } = req.params;
  const { is_read } = req.body;

  const emailIndex = memoryEmails.findIndex(e => e.id === id);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  memoryEmails[emailIndex].is_read =
    is_read !== undefined ? is_read : !memoryEmails[emailIndex].is_read;

  res.json({
    message: 'Email read status updated',
    email: memoryEmails[emailIndex],
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 Campus Cue server listening on port ${PORT}`);
  console.log(`📡 Health-check: http://localhost:${PORT}/api/health`);
  console.log(`✉️  Emails API:  http://localhost:${PORT}/api/emails`);
  console.log(`🤖 AI Processor: http://localhost:${PORT}/api/emails/process`);
  console.log(`📰 AI Digest:    http://localhost:${PORT}/api/digest/today`);
  console.log(`⏰ Reminders:    http://localhost:${PORT}/api/reminders`);
  console.log(`📥 EML Ingestion:http://localhost:${PORT}/api/emails/upload-eml`);
});
