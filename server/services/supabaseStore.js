import crypto from 'node:crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export function generateUuid() {
  return crypto.randomUUID();
}

/**
 * Resolve active user scope from incoming request or fallback safely.
 */
export function resolveUserId(req, explicitEmail = '') {
  const candidate = explicitEmail || req?.headers?.['x-user-email'] || '';
  const cleaned = String(candidate).trim().toLowerCase();
  return cleaned || 'default_student';
}

export function mapDbRowToEmail(row) {
  if (!row) return null;
  const senderStr = row.sender || 'Unknown Sender';
  const effectiveDeadline = row.user_deadline || row.ai_deadline || null;

  return {
    id: row.id,
    user_id: row.user_id,
    source: row.source || 'paste',
    external_id: row.external_id || null,
    content_hash: row.content_hash || null,
    recipient: row.recipient || null,
    sender: senderStr,
    senderName: row.sender_name || senderStr.split('<')[0].trim() || 'Sender',
    subject: row.subject || 'No Subject',
    body: row.body || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    is_read: Boolean(row.is_read),
    is_archived: Boolean(row.is_archived),
    received_at: row.received_at,
    category: row.ai_category || 'Announcements',
    user_category: row.user_category || null,
    priority: row.ai_priority || 'Medium',
    user_priority: row.user_priority || null,
    priority_reason: row.priority_reason || null,
    deadline: row.ai_deadline || null,
    user_deadline: row.user_deadline || null,
    deadline_completed: Boolean(row.deadline_completed),
    deadline_label: effectiveDeadline ? 'Action Deadline' : null,
    deadline_confidence: row.deadline_confidence || 'confirmed',
    summary: row.summary || '',
    required_action: row.required_action || null,
    needs_reply: Boolean(row.needs_reply),
    needs_action: Boolean(row.needs_action),
    needs_followup: Boolean(row.needs_reply || row.needs_action),
    reminder_note: row.reminder_note || null,
    edited_by_user: Boolean(row.user_category || row.user_priority || row.user_deadline),
    ai_processed: row.analysis_status === 'processed',
    status: row.analysis_status || 'processed',
    error: row.analysis_error || null,
    processed_at: row.processed_at || null,
  };
}

export async function fetchAllEmailsFromDb(supabase) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('v_emails_with_analysis')
    .select('*')
    .order('received_at', { ascending: false });

  if (error) {
    console.warn('⚠️ Supabase v_emails_with_analysis read error:', error.message);
    return null;
  }
  return (data || []).map(mapDbRowToEmail);
}

export async function findByHashInDb(supabase, userId, contentHash) {
  if (!supabase || !contentHash) return null;
  try {
    const { data, error } = await supabase
      .from('v_emails_with_analysis')
      .select('*')
      .eq('user_id', userId)
      .eq('content_hash', contentHash)
      .maybeSingle();

    if (error || !data) return null;
    return mapDbRowToEmail(data);
  } catch {
    return null;
  }
}

export async function upsertEmailAndAnalysisToDb(supabase, emailObj, userId = 'default_student') {
  if (!supabase || !isUuid(emailObj?.id)) return;

  try {
    const { error: emailErr } = await supabase.from('emails').upsert({
      id: emailObj.id,
      user_id: userId,
      source: emailObj.source || 'paste',
      external_id: emailObj.external_id || emailObj.gmail_id || null,
      content_hash: emailObj.content_hash,
      recipient: emailObj.recipient || null,
      sender: emailObj.sender,
      sender_name: emailObj.senderName || emailObj.sender?.split('<')[0]?.trim() || 'Sender',
      subject: emailObj.subject,
      body: emailObj.body,
      attachments: emailObj.attachments || [],
      is_read: Boolean(emailObj.is_read),
      is_archived: Boolean(emailObj.is_archived),
      received_at: emailObj.received_at || new Date().toISOString(),
    });

    if (emailErr) {
      console.warn('⚠️ Supabase emails upsert error:', emailErr.message);
      return;
    }

    const { error: analysisErr } = await supabase
      .from('email_analysis')
      .upsert(
        {
          email_id: emailObj.id,
          category: emailObj.category || 'Announcements',
          user_category: emailObj.user_category || null,
          summary: emailObj.summary || '',
          priority: emailObj.priority || 'Medium',
          user_priority: emailObj.user_priority || null,
          priority_reason: emailObj.priority_reason || null,
          deadline: emailObj.deadline || null,
          user_deadline: emailObj.user_deadline || null,
          deadline_completed: Boolean(emailObj.deadline_completed),
          deadline_confidence: emailObj.deadline_confidence || 'confirmed',
          required_action: emailObj.required_action || null,
          needs_reply: Boolean(emailObj.needs_reply),
          needs_action: Boolean(emailObj.needs_action),
          reminder_note: emailObj.reminder_note || null,
          model: emailObj.model || 'gemini-2.5-flash',
          status: 'processed',
          processed_at: emailObj.processed_at || new Date().toISOString(),
        },
        { onConflict: 'email_id' }
      );

    if (analysisErr) {
      console.warn('⚠️ Supabase email_analysis upsert error:', analysisErr.message);
    }
  } catch (err) {
    console.warn('⚠️ Supabase persistence skipped:', err.message);
  }
}

export async function updateEmailOverridesInDb(supabase, emailId, updates) {
  if (!supabase || !isUuid(emailId)) return;
  try {
    const analysisUpdates = {};
    if (updates.user_category !== undefined) analysisUpdates.user_category = updates.user_category;
    if (updates.user_priority !== undefined) analysisUpdates.user_priority = updates.user_priority;
    if (updates.user_deadline !== undefined) analysisUpdates.user_deadline = updates.user_deadline;
    if (updates.deadline_completed !== undefined) analysisUpdates.deadline_completed = Boolean(updates.deadline_completed);

    if (Object.keys(analysisUpdates).length > 0) {
      await supabase.from('email_analysis').update(analysisUpdates).eq('email_id', emailId);
    }
  } catch (err) {
    console.warn('⚠️ Supabase override update error:', err.message);
  }
}

export async function updateEmailArchivedInDb(supabase, emailId, isArchived) {
  if (!supabase || !isUuid(emailId)) return;
  try {
    await supabase.from('emails').update({ is_archived: Boolean(isArchived) }).eq('id', emailId);
  } catch (err) {
    console.warn('⚠️ Supabase archive update error:', err.message);
  }
}

export async function deleteEmailFromDb(supabase, emailId) {
  if (!supabase || !isUuid(emailId)) return;
  try {
    await supabase.from('emails').delete().eq('id', emailId);
  } catch (err) {
    console.warn('⚠️ Supabase delete email error:', err.message);
  }
}

export async function updateEmailReadInDb(supabase, emailId, isRead) {
  if (!supabase || !isUuid(emailId)) return;
  try {
    await supabase.from('emails').update({ is_read: Boolean(isRead) }).eq('id', emailId);
  } catch (err) {
    console.warn('⚠️ Supabase read update error:', err.message);
  }
}

export async function syncReminderToDb(supabase, reminderObj) {
  if (!supabase || !isUuid(reminderObj?.email_id)) return;
  try {
    const { data: existing } = await supabase
      .from('reminders')
      .select('id')
      .eq('email_id', reminderObj.email_id)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('reminders')
        .update({
          type: reminderObj.reminder_type === 'reply' ? 'reply' : 'action',
          status: reminderObj.status || 'pending',
          snoozed_until: reminderObj.snoozed_until || null,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('reminders').insert({
        email_id: reminderObj.email_id,
        type: reminderObj.reminder_type === 'reply' ? 'reply' : 'action',
        status: reminderObj.status || 'pending',
        snoozed_until: reminderObj.snoozed_until || null,
      });
    }
  } catch (err) {
    console.warn('⚠️ Supabase reminder sync error:', err.message);
  }
}

export async function fetchRemindersFromDb(supabase, emailsList = []) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    const emailById = new Map(emailsList.map((e) => [e.id, e]));
    return data.map((row) => {
      const e = emailById.get(row.email_id) || {};
      const note = e.reminder_note || e.required_action || 'Action required';
      return {
        id: row.id,
        email_id: row.email_id,
        emailId: row.email_id,
        sender: e.sender || 'Unknown Sender',
        senderName: e.senderName || e.sender || 'Sender',
        subject: e.subject || 'Follow-up Item',
        reminder_type: row.type || 'action',
        reminder_note: note,
        reminder_text: `${e.subject || 'Follow-up'}: ${note}`,
        status: row.status || 'pending',
        due_date: e.user_deadline || e.deadline || null,
        snoozed_until: row.snoozed_until || null,
        is_completed: row.status === 'done',
        created_at: row.created_at,
      };
    });
  } catch {
    return null;
  }
}

