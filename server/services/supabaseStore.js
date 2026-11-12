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
  return String(candidate).trim().toLowerCase();
}

export function deriveDeadlineLabel(subject = '', existingLabel = '') {
  const trimmed = String(existingLabel || '').trim();
  if (trimmed && trimmed.toLowerCase() !== 'action deadline') return trimmed;
  const cleanedSubject = String(subject || '')
    .replace(/^(?:re|fwd|urgent|mandatory|important|reminder)\s*[:&-]*\s*/gi, '')
    .trim();
  if (!cleanedSubject) return 'Scheduled Deadline';
  return cleanedSubject.length > 60 ? `${cleanedSubject.slice(0, 57).trim()}...` : cleanedSubject;
}

export function mapDbRowToEmail(row) {
  if (!row) return null;
  const senderStr = row.sender || 'Unknown Sender';
  const effectiveDeadline = row.user_deadline || row.ai_deadline || null;
  const resolvedSource =
    row.analysis_source ||
    (String(row.analysis_model || '').includes('gemini')
      ? 'gemini'
      : row.analysis_model === 'fallback'
      ? 'fallback'
      : 'heuristic');

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
    deadline_label: effectiveDeadline ? deriveDeadlineLabel(row.subject, row.deadline_label) : row.deadline_label || null,
    deadline_confidence: row.deadline_confidence || 'confirmed',
    summary: row.summary || '',
    required_action: row.required_action || null,
    needs_reply: Boolean(row.needs_reply),
    needs_action: Boolean(row.needs_action),
    needs_followup: Boolean(row.needs_reply || row.needs_action),
    reminder_note: row.reminder_note || null,
    analysis_source: resolvedSource,
    model: row.analysis_model || (resolvedSource === 'gemini' ? 'gemini-3.5-flash-lite' : resolvedSource),
    edited_by_user: Boolean(row.user_category || row.user_priority || row.user_deadline),
    ai_processed: (row.analysis_status || 'processed') === 'processed',
    status: row.analysis_status || 'processed',
    error: row.analysis_error || null,
    processed_at: row.processed_at || null,
  };
}

export async function findEmailByIdInDb(supabase, emailId, userId = null) {
  if (!supabase || !isUuid(emailId)) return null;
  try {
    let q = supabase
      .from('v_emails_with_analysis')
      .select('*')
      .eq('id', emailId);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.maybeSingle();

    if (error || !data) return null;
    return mapDbRowToEmail(data);
  } catch {
    return null;
  }
}

export async function fetchAllEmailsFromDb(supabase, userId = null) {
  if (!supabase) return null;
  let q = supabase
    .from('v_emails_with_analysis')
    .select('*')
    .order('received_at', { ascending: false });
  if (userId) {
    q = q.eq('user_id', userId);
  }

  const { data, error } = await q;

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

export async function upsertEmailAndAnalysisToDb(supabase, emailObj, userId) {
  if (
    !supabase ||
    !userId ||
    !isUuid(emailObj?.id) ||
    emailObj?.source === 'sample' ||
    String(emailObj?.id || '').startsWith('cue-')
  ) {
    return;
  }

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

    const analysisRow = {
      email_id: emailObj.id,
      category: emailObj.category || 'Announcements',
      user_category: emailObj.user_category || null,
      summary: emailObj.summary || '',
      priority: emailObj.priority || 'Medium',
      user_priority: emailObj.user_priority || null,
      priority_reason: emailObj.priority_reason || null,
      deadline: emailObj.deadline || null,
      user_deadline: emailObj.user_deadline || null,
      deadline_label: emailObj.deadline_label || null,
      deadline_completed: Boolean(emailObj.deadline_completed),
      deadline_confidence: emailObj.deadline_confidence || 'confirmed',
      required_action: emailObj.required_action || null,
      needs_reply: Boolean(emailObj.needs_reply),
      needs_action: Boolean(emailObj.needs_action),
      reminder_note: emailObj.reminder_note || null,
      source: emailObj.analysis_source || (String(emailObj.model || '').includes('gemini') ? 'gemini' : 'heuristic'),
      model: emailObj.model || 'heuristic',
      status: emailObj.status === 'failed' ? 'failed' : emailObj.status === 'pending' ? 'pending' : 'processed',
      error: emailObj.error || null,
      processed_at: emailObj.processed_at || new Date().toISOString(),
    };

    let { error: analysisErr } = await supabase
      .from('email_analysis')
      .upsert(analysisRow, { onConflict: 'email_id' });

    if (analysisErr && (analysisErr.code === 'PGRST204' || /column .* does not exist/i.test(analysisErr.message))) {
      console.warn('⚠️ Optional schema column missing in Supabase email_analysis (run server/schema.sql in SQL Editor):', analysisErr.message);
      const { deadline_label: _dl, source: _src, ...legacyRow } = analysisRow;
      const retryRes = await supabase.from('email_analysis').upsert(legacyRow, { onConflict: 'email_id' });
      analysisErr = retryRes.error;
    }

    if (analysisErr) {
      console.warn('⚠️ Supabase email_analysis upsert error:', analysisErr.message);
    }
  } catch (err) {
    console.warn('⚠️ Supabase persistence skipped:', err.message);
  }
}

export async function updateEmailOverridesInDb(supabase, emailId, updates, userId = null) {
  if (!supabase || !isUuid(emailId)) return;
  try {
    if (userId) {
      const owned = await findEmailByIdInDb(supabase, emailId, userId);
      if (!owned) return;
    }
    const analysisUpdates = {};
    if (updates.user_category !== undefined) analysisUpdates.user_category = updates.user_category;
    if (updates.user_priority !== undefined) analysisUpdates.user_priority = updates.user_priority;
    if (updates.user_deadline !== undefined) analysisUpdates.user_deadline = updates.user_deadline;
    if (updates.deadline_completed !== undefined) analysisUpdates.deadline_completed = Boolean(updates.deadline_completed);

    if (Object.keys(analysisUpdates).length > 0) {
      const { error } = await supabase.from('email_analysis').update(analysisUpdates).eq('email_id', emailId);
      if (error) console.warn('⚠️ Supabase override update error:', error.message);
    }
  } catch (err) {
    console.warn('⚠️ Supabase override update error:', err.message);
  }
}

export async function updateEmailArchivedInDb(supabase, emailId, isArchived, userId = null) {
  if (!supabase || !isUuid(emailId)) return;
  try {
    let q = supabase.from('emails').update({ is_archived: Boolean(isArchived) }).eq('id', emailId);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) console.warn('⚠️ Supabase archive update error:', error.message);
  } catch (err) {
    console.warn('⚠️ Supabase archive update error:', err.message);
  }
}

export async function deleteEmailFromDb(supabase, emailId, userId = null) {
  if (!supabase || !isUuid(emailId)) return;
  try {
    let q = supabase.from('emails').delete().eq('id', emailId);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) console.warn('⚠️ Supabase delete email error:', error.message);
  } catch (err) {
    console.warn('⚠️ Supabase delete email error:', err.message);
  }
}

export async function updateEmailReadInDb(supabase, emailId, isRead, userId = null) {
  if (!supabase || !isUuid(emailId)) return;
  try {
    let q = supabase.from('emails').update({ is_read: Boolean(isRead) }).eq('id', emailId);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) console.warn('⚠️ Supabase read update error:', error.message);
  } catch (err) {
    console.warn('⚠️ Supabase read update error:', err.message);
  }
}

export async function findReminderByIdInDb(supabase, reminderId, userId = null) {
  if (!supabase || !isUuid(reminderId)) return null;
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('id', reminderId)
      .maybeSingle();
    if (error || !data) return null;
    const e = await findEmailByIdInDb(supabase, data.email_id, userId);
    if (userId && !e) return null;
    const resolvedEmail = e || {};
    const note = resolvedEmail.reminder_note || resolvedEmail.required_action || 'Action required';
    return {
      id: data.id,
      user_id: data.user_id || resolvedEmail.user_id || userId || '',
      email_id: data.email_id,
      emailId: data.email_id,
      sender: resolvedEmail.sender || 'Unknown Sender',
      senderName: resolvedEmail.senderName || resolvedEmail.sender || 'Sender',
      subject: resolvedEmail.subject || 'Follow-up Item',
      reminder_type: data.type || 'action',
      reminder_note: note,
      reminder_text: `${resolvedEmail.subject || 'Follow-up'}: ${note}`,
      status: data.status || 'pending',
      due_date: resolvedEmail.user_deadline || resolvedEmail.deadline || null,
      snoozed_until: data.snoozed_until || null,
      is_completed: data.status === 'done',
      created_at: data.created_at,
    };
  } catch {
    return null;
  }
}

export async function syncReminderToDb(supabase, reminderObj) {
  if (
    !supabase ||
    !isUuid(reminderObj?.email_id) ||
    String(reminderObj?.id || '').startsWith('rem-cue-')
  ) {
    return null;
  }
  try {
    const { data: existingList, error: lookupErr } = await supabase
      .from('reminders')
      .select('id')
      .eq('email_id', reminderObj.email_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (lookupErr) {
      console.warn('⚠️ Supabase reminder lookup error:', lookupErr.message);
    }

    const existing = Array.isArray(existingList) && existingList.length > 0 ? existingList[0] : null;
    const payload = {
      user_id: reminderObj.user_id || '',
      email_id: reminderObj.email_id,
      type: reminderObj.reminder_type === 'reply' ? 'reply' : 'action',
      status: reminderObj.status || 'pending',
      snoozed_until: reminderObj.snoozed_until || null,
    };

    if (existing?.id) {
      let { error: updateErr } = await supabase
        .from('reminders')
        .update({
          user_id: payload.user_id,
          type: payload.type,
          status: payload.status,
          snoozed_until: payload.snoozed_until,
        })
        .eq('id', existing.id);
      if (updateErr && (updateErr.code === 'PGRST204' || /user_id/i.test(updateErr.message))) {
        const retry = await supabase
          .from('reminders')
          .update({ type: payload.type, status: payload.status, snoozed_until: payload.snoozed_until })
          .eq('id', existing.id);
        updateErr = retry.error;
      }
      if (updateErr) console.warn('⚠️ Supabase reminder update error:', updateErr.message);
      return existing.id;
    }

    const reminderId = isUuid(reminderObj.id) ? reminderObj.id : generateUuid();
    let { data: inserted, error: insertErr } = await supabase
      .from('reminders')
      .insert({ id: reminderId, ...payload })
      .select('id')
      .single();

    if (insertErr && (insertErr.code === 'PGRST204' || /user_id/i.test(insertErr.message))) {
      console.warn('⚠️ Optional schema column reminders.user_id missing in Supabase (run server/schema.sql in SQL Editor).');
      const { user_id: _uid, ...legacyPayload } = payload;
      const retry = await supabase
        .from('reminders')
        .insert({ id: reminderId, ...legacyPayload })
        .select('id')
        .single();
      inserted = retry.data;
      insertErr = retry.error;
    }

    if (insertErr) {
      console.warn('⚠️ Supabase reminder insert error:', insertErr.message);
      return null;
    }
    return inserted?.id || reminderId;
  } catch (err) {
    console.warn('⚠️ Supabase reminder sync error:', err.message);
    return null;
  }
}

export async function updateReminderInDb(supabase, reminderId, updates, userId = null) {
  if (!supabase || !isUuid(reminderId)) return false;
  try {
    if (userId) {
      const owned = await findReminderByIdInDb(supabase, reminderId, userId);
      if (!owned) return false;
    }
    const { error } = await supabase
      .from('reminders')
      .update({
        status: updates.status,
        snoozed_until: updates.snoozed_until ?? null,
      })
      .eq('id', reminderId);
    if (error) {
      console.warn('⚠️ Supabase reminder patch error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('⚠️ Supabase reminder patch failed:', err.message);
    return false;
  }
}

export async function fetchRemindersFromDb(supabase, emailsList = [], userId = null) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    let resolvedEmails = Array.isArray(emailsList) ? emailsList : [];
    const emailById = new Map(resolvedEmails.map((e) => [e.id, e]));
    const missingEmail = data.some((row) => !emailById.has(row.email_id));
    if (missingEmail) {
      const dbEmails = await fetchAllEmailsFromDb(supabase, userId);
      if (Array.isArray(dbEmails)) {
        for (const e of dbEmails) {
          emailById.set(e.id, e);
        }
      }
    }

    const mapped = data
      .filter((row) => {
        if (!userId) return true;
        const em = emailById.get(row.email_id);
        return em ? em.user_id === userId : row.user_id === userId;
      })
      .map((row) => {
        const e = emailById.get(row.email_id) || {};
        const note = e.reminder_note || e.required_action || 'Action required';
        return {
          id: row.id,
          user_id: row.user_id || e.user_id || userId || '',
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

    return mapped;
  } catch {
    return null;
  }
}

export async function upsertDigestToDb(supabase, userId, dateStr, content) {
  if (!supabase) return;
  try {
    const { data: existingRows, error: selErr } = await supabase
      .from('digests')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .order('created_at', { ascending: false });

    if (selErr) {
      console.warn('⚠️ Supabase digest lookup error:', selErr.message);
    }

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      const keepId = existingRows[0].id;
      const { error: updErr } = await supabase
        .from('digests')
        .update({ content })
        .eq('id', keepId);
      if (updErr) console.warn('⚠️ Supabase digest update error:', updErr.message);

      if (existingRows.length > 1) {
        const extraIds = existingRows.slice(1).map((r) => r.id);
        await supabase.from('digests').delete().in('id', extraIds);
      }
    } else {
      const { error: insErr } = await supabase
        .from('digests')
        .insert({ user_id: userId, date: dateStr, content });
      if (insErr) console.warn('⚠️ Supabase digest insert error:', insErr.message);
    }
  } catch (err) {
    console.warn('⚠️ Supabase digest upsert error:', err.message);
  }
}

export async function deleteUserTokenFromDb(supabase, email, provider = '') {
  if (!supabase || !email) return;
  try {
    let q = supabase.from('user_tokens').delete().eq('user_id', email.toLowerCase());
    if (provider) q = q.eq('provider', provider);
    await q;
  } catch (err) {
    console.warn('⚠️ Supabase token delete error:', err.message);
  }
}

