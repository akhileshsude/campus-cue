import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import supabase from './supabaseClient.js';
import { sampleEmails, sampleDigest, sampleReminders } from './sampleData.js';
import { processEmail, generateAcademicDigest, generateReplyDraft } from '../services/emailProcessor.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory state initialized with sample data (for mock mode)
let memoryEmails = [...sampleEmails];
let memoryReminders = [...sampleReminders];
let memoryDigest = { ...sampleDigest };

// Helper to resolve effective category (user override takes priority)
function getEffectiveCategory(email) {
  return email.user_category || email.category;
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
  });
});

// 2. Fetch all emails (supports ?category=Academics&priority=high)
app.get('/api/emails', async (req, res) => {
  const { category, priority, unreadOnly } = req.query;

  try {
    if (supabase) {
      let query = supabase.from('emails').select('*').order('received_at', { ascending: false });
      const { data, error } = await query;
      if (error) {
        console.warn('⚠️ Supabase error, falling back to sample data:', error.message);
      } else if (data && data.length > 0) {
        let results = data;
        if (category && category !== 'All') {
          results = results.filter(e => (e.user_category || e.category).toLowerCase() === category.toLowerCase());
        }
        if (priority) {
          results = results.filter(e => e.priority.toLowerCase() === priority.toLowerCase());
        }
        if (unreadOnly === 'true') {
          results = results.filter(e => !e.is_read);
        }
        return res.json({ emails: results, source: 'supabase', total: results.length });
      }
    }

    // In-memory list (default or fallback)
    let filtered = [...memoryEmails];
    if (category && category !== 'All') {
      filtered = filtered.filter(e => getEffectiveCategory(e).toLowerCase() === category.toLowerCase());
    }
    if (priority) {
      filtered = filtered.filter(e => e.priority.toLowerCase() === priority.toLowerCase());
    }
    if (unreadOnly === 'true') {
      filtered = filtered.filter(e => !e.is_read);
    }

    res.json({
      emails: filtered,
      source: 'memory_store',
      total: filtered.length,
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to retrieve emails' });
  }
});

// 3. Process an email with Gemini AI (POST /api/emails/process)
// Also supports ingesting new raw emails via save_as_new: true
app.post('/api/emails/process', async (req, res) => {
  const { id, subject, body, sender, received_at, save_as_new } = req.body;

  try {
    let targetEmail = null;
    let emailIndex = -1;

    if (id) {
      emailIndex = memoryEmails.findIndex(e => e.id === id);
      if (emailIndex !== -1) {
        targetEmail = memoryEmails[emailIndex];
      }
    }

    const emailToProcess = {
      subject: subject || targetEmail?.subject || '',
      body: body || targetEmail?.body || '',
      sender: sender || targetEmail?.sender || 'Unknown Sender <sender@university.edu>',
      receivedAt: received_at || targetEmail?.received_at || new Date().toISOString(),
    };

    if (!emailToProcess.subject && !emailToProcess.body) {
      return res.status(400).json({ error: 'Subject or body is required for AI processing' });
    }

    console.log(`🤖 Processing email with AI: "${emailToProcess.subject.slice(0, 40)}..."`);
    const aiResult = await processEmail(emailToProcess);

    // If an existing email is matched, update it
    if (targetEmail) {
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
        ai_processed: true,
      };

      memoryEmails[emailIndex] = updated;

      // Sync follow-up reminder
      if (aiResult.needs_followup) {
        const remIndex = memoryReminders.findIndex(r => r.emailId === targetEmail.id);
        const reminderData = {
          id: `rem-${targetEmail.id}`,
          emailId: targetEmail.id,
          subject: targetEmail.subject,
          sender: targetEmail.senderName || targetEmail.sender,
          action: aiResult.required_action || 'Reply required',
          deadline: aiResult.deadline,
          is_completed: false,
        };

        if (remIndex >= 0) {
          memoryReminders[remIndex] = reminderData;
        } else {
          memoryReminders.unshift(reminderData);
        }
      }

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

    // If saving as a brand new ingested email
    if (save_as_new) {
      const newId = `cue-ingest-${Date.now()}`;
      const senderName = emailToProcess.sender.includes('<')
        ? emailToProcess.sender.split('<')[0].trim()
        : emailToProcess.sender;

      const newEmail = {
        id: newId,
        sender: emailToProcess.sender,
        senderName: senderName || 'New Correspondence',
        subject: emailToProcess.subject,
        body: emailToProcess.body,
        category: aiResult.category,
        user_category: null,
        summary: aiResult.summary,
        priority: aiResult.priority,
        priority_reason: aiResult.priority_reason,
        received_at: emailToProcess.receivedAt,
        deadline: aiResult.deadline,
        deadline_label: aiResult.deadline ? 'Action Deadline' : null,
        deadline_confidence: aiResult.deadline_confidence,
        required_action: aiResult.required_action,
        needs_followup: aiResult.needs_followup,
        is_read: false,
        ai_processed: true,
      };

      memoryEmails.unshift(newEmail);

      if (aiResult.needs_followup) {
        memoryReminders.unshift({
          id: `rem-${newId}`,
          emailId: newId,
          subject: newEmail.subject,
          sender: newEmail.senderName,
          action: aiResult.required_action || 'Reply required',
          deadline: aiResult.deadline,
          is_completed: false,
        });
      }

      if (supabase) {
        try {
          await supabase.from('emails').insert(newEmail);
        } catch (dbErr) {
          console.warn('⚠️ Supabase insert error:', dbErr.message);
        }
      }

      return res.json({
        message: 'Email ingested and analyzed successfully',
        email: newEmail,
        aiResult,
      });
    }

    // New ad-hoc email analyzed
    res.json({
      message: 'Email analyzed successfully with AI',
      aiResult,
    });
  } catch (err) {
    console.error('Error processing email with AI:', err);
    res.status(500).json({ error: 'Failed to process email with AI', details: err.message });
  }
});

// 4. Batch Process All Emails with AI (POST /api/emails/process-all)
app.post('/api/emails/process-all', async (req, res) => {
  try {
    console.log(`🤖 Batch processing ${memoryEmails.length} emails with AI...`);
    const results = [];

    for (let i = 0; i < memoryEmails.length; i++) {
      const email = memoryEmails[i];
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
        ai_processed: true,
      };

      memoryEmails[i] = updated;
      results.push(updated);

      await new Promise(r => setTimeout(r, 200));
    }

    res.json({
      message: `Batch processed ${results.length} emails successfully`,
      emails: memoryEmails,
    });
  } catch (err) {
    console.error('Error in batch AI processing:', err);
    res.status(500).json({ error: 'Batch processing failed', details: err.message });
  }
});

// 5. Update User-Corrected Category (PATCH /api/emails/:id/category)
app.patch('/api/emails/:id/category', async (req, res) => {
  const { id } = req.params;
  const { category, user_category } = req.body;
  const targetCategory = user_category || category;

  if (!targetCategory) {
    return res.status(400).json({ error: 'Category is required' });
  }

  const emailIndex = memoryEmails.findIndex(e => e.id === id);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  memoryEmails[emailIndex].user_category = targetCategory;

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

// 6. Dynamic Academic Digest Generation (POST /api/digest/generate)
app.post('/api/digest/generate', async (req, res) => {
  try {
    const academicEmails = memoryEmails.filter(e =>
      getEffectiveCategory(e).toLowerCase() === 'academics'
    );

    console.log(`🤖 Generating dynamic academic digest from ${academicEmails.length} course emails...`);
    const digest = await generateAcademicDigest(academicEmails);
    memoryDigest = digest;

    res.json({
      message: 'Academic digest generated successfully',
      digest,
    });
  } catch (err) {
    console.error('Error generating academic digest:', err);
    res.status(500).json({ error: 'Failed to generate academic digest', details: err.message });
  }
});

// 7. Get Current Daily Academic Digest
app.get('/api/digest', (req, res) => {
  res.json({
    digest: memoryDigest,
    source: memoryDigest._source || 'sample_data',
  });
});

// 8. Smart AI Reply Drafter (POST /api/emails/reply)
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

// 9. Reminders & follow-ups
app.get('/api/reminders', (req, res) => {
  res.json({
    reminders: memoryReminders,
    source: 'sample_data',
  });
});

// 10. Toggle reminder status (Mark done)
app.patch('/api/reminders/:id', (req, res) => {
  const { id } = req.params;
  const { is_completed } = req.body;

  const reminderIndex = memoryReminders.findIndex(r => r.id === id);
  if (reminderIndex === -1) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  memoryReminders[reminderIndex].is_completed =
    is_completed !== undefined ? is_completed : !memoryReminders[reminderIndex].is_completed;

  res.json({
    message: 'Reminder updated successfully',
    reminder: memoryReminders[reminderIndex],
  });
});

// 11. Mark email read/unread
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
  console.log(`📝 AI Reply:     http://localhost:${PORT}/api/emails/reply`);
  console.log(`📰 AI Digest:    http://localhost:${PORT}/api/digest/generate`);
});
