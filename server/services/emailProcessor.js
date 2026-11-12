import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

let aiClient = null;

function initAiClient(key) {
  const cleanKey = (key || '').trim();
  if (cleanKey && !cleanKey.includes('your_gemini')) {
    try {
      return new GoogleGenAI({ apiKey: cleanKey });
    } catch (err) {
      console.warn('⚠️ Could not initialize GoogleGenAI client:', err.message);
    }
  }
  return null;
}

aiClient = initAiClient(process.env.GEMINI_API_KEY || process.env.AI_API_KEY);

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_FALLBACK_MODEL = 'gemini-3.7-flash';

export function redactSecrets(text = '') {
  return String(text || '')
    .replace(/AIza[A-Za-z0-9_-]{10,}/g, '[REDACTED]')
    .replace(/AQ\.[A-Za-z0-9_.-]{10,}/g, '[REDACTED]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/g, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9_.-]{10,}/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g, '[REDACTED_JWT]');
}

let lastAiProbe = {
  aiMode: 'offline',
  model: GEMINI_MODEL,
  error: aiClient ? null : 'Gemini API key is not configured.',
  checkedAt: null,
};

export function getCachedAiHealth() {
  return { ...lastAiProbe };
}

let activeProbePromise = null;

export async function probeAiStatus() {
  if (activeProbePromise) {
    return activeProbePromise;
  }

  activeProbePromise = (async () => {
    const checkedAt = new Date().toISOString();
    if (!aiClient) {
      lastAiProbe = {
        aiMode: 'offline',
        model: GEMINI_MODEL,
        error: 'Gemini API key is not configured.',
        checkedAt,
      };
      return { ...lastAiProbe };
    }

    let lastErr = null;
    for (const modelName of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini health probe timed out after 20s')), 20000)
        );
        const callPromise = aiClient.models.generateContent({
          model: modelName,
          contents: 'Reply with OK',
          config: { maxOutputTokens: 4 },
        });
        await Promise.race([callPromise, timeoutPromise]);
        lastAiProbe = {
          aiMode: 'live',
          model: modelName,
          error: null,
          checkedAt: new Date().toISOString(),
        };
        return { ...lastAiProbe };
      } catch (err) {
        lastErr = redactSecrets(err?.message || 'Unknown Gemini API error');
        const isInvalidAuth = /API_KEY_INVALID|API key not valid|401|403|PERMISSION_DENIED|INVALID_ARGUMENT/i.test(lastErr);
        if (isInvalidAuth) break;
      }
    }

    lastAiProbe = {
      aiMode: 'offline',
      model: GEMINI_MODEL,
      error: lastErr || 'Gemini API request failed.',
      checkedAt: new Date().toISOString(),
    };
    return { ...lastAiProbe };
  })();

  try {
    return await activeProbePromise;
  } finally {
    activeProbePromise = null;
  }
}

export function reloadAiClient(newKey) {
  activeProbePromise = null;
  aiClient = initAiClient(newKey);
  if (!aiClient) {
    lastAiProbe = {
      aiMode: 'offline',
      model: GEMINI_MODEL,
      error: 'Gemini API key is not configured.',
      checkedAt: new Date().toISOString(),
    };
  }
  return Boolean(aiClient);
}

export function isAiConfigured() {
  return Boolean(aiClient);
}

// Allowed enum constants
const VALID_CATEGORIES = ['Academics', 'Placements', 'Clubs', 'Events', 'Announcements'];
const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_CONFIDENCES = ['confirmed', 'uncertain'];

/**
 * Step 11: Compute content hash (SHA-256) of sender + subject + body
 * Used for deduplication with user_id in database.
 */
export function computeContentHash(sender = '', subject = '', body = '') {
  const normSender = (sender || '').trim().toLowerCase();
  const normSubject = (subject || '').trim().toLowerCase();
  const normBody = (body || '').replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(`${normSender}|${normSubject}|${normBody}`).digest('hex');
}

/**
 * Step 13: Strict Date Validation & Safeguards
 * Rejects malformed dates, dates more than a year away, or invalid years.
 */
export function validateAndSanitizeDate(dateStr, referenceDate = new Date()) {
  if (!dateStr || typeof dateStr !== 'string') {
    return { validDate: null, confidence: 'uncertain' };
  }

  const parsed = new Date(dateStr);
  const time = parsed.getTime();

  if (isNaN(time)) {
    return { validDate: null, confidence: 'uncertain' };
  }

  const refTime = referenceDate.getTime();
  const diffDays = (time - refTime) / (1000 * 60 * 60 * 24);
  const year = parsed.getFullYear();

  // Reject dates more than 365 days away or ridiculous years
  if (diffDays > 365 || diffDays < -180 || year < 2024 || year > 2030) {
    return { validDate: null, confidence: 'uncertain' };
  }

  return { validDate: parsed.toISOString(), confidence: 'confirmed' };
}

/**
 * Fallback response object when AI fails or input is malformed.
 */
function createSafeFallback(body = '', errorMessage = null) {
  const sentences = (body || '')
    .replace(/\n+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .slice(0, 2)
    .join(' ')
    .trim();

  return {
    category: 'Announcements',
    summary: sentences || 'Standard campus announcement with no critical actions specified.',
    priority: 'Medium',
    priority_reason: 'Basic analysis (AI offline fallback).',
    deadline: null,
    deadline_label: null,
    deadline_confidence: 'uncertain',
    required_action: null,
    needs_followup: false,
    needs_reply: false,
    needs_action: false,
    reminder_note: null,
    status: errorMessage ? 'failed' : 'processed',
    error: errorMessage ? redactSecrets(errorMessage) : null,
    _source: 'fallback',
    _model: 'fallback',
  };
}

/**
 * Smart heuristic processor used when GEMINI_API_KEY is not set or offline.
 * Highly tuned for Indian university contexts and edge cases.
 */
export function heuristicProcessor({ subject = '', body = '', sender = '', receivedAt }) {
  const refDate = receivedAt ? new Date(receivedAt) : new Date();
  const text = `${subject} ${body}`.toLowerCase();

  // 1. Category Detection (Indian College Context)
  let category = 'Announcements';

  // Check Placements first (before Academics or Clubs, so "B.Tech students placement drive" goes to Placements)
  // Note: Use word boundary \bplacement(s)?\b so "page replacement" does not falsely match!
  if (/(\bplacements?\b|t&p\b|placement cell|campus drive|recruitment|sde role|ctc\b|lpa\b|hiring|shortlist|internship|summer research fellowship)/i.test(text)) {
    category = 'Placements';
  } else if (/(hackathon|keynote|symposium|distinguished lecture|annual day|sports fest|webinar|seminar|auditorium|guest talk|conference)/i.test(text)) {
    category = 'Events';
  } else if (/(robotics society|cultural fest|music club|audition|society meeting|photography club|pixel club|dramatics|e-cell|student council)/i.test(text)) {
    category = 'Clubs';
  } else if (/(assignment|homework|lab assignment|exam|midterm|end-semester|theory timetable|controller of examinations|lab viva|prof\.|professor|internal marks|attendance|curriculum|moodle|syllabus)/i.test(text)) {
    category = 'Academics';
  } else if (/(mess|hostel|warden|maintenance|library book|stock verification|holiday|fees|transport|bus schedule|circular)/i.test(text)) {
    category = 'Announcements';
  }

  // 2. Priority & Reason
  let priority = 'Medium';
  let priority_reason = 'Standard campus correspondence.';

  if (/(urgent|mandatory|exam|assignment.*due|due date|deduction|penalty|disqualification|registration closes strictly|cutoff|last date to register|immediate action|due tomorrow|overdue)/i.test(text)) {
    priority = 'High';
    if (/shortlist|interview|coding test|placement|registration deadline/i.test(text)) {
      priority_reason = 'Marked high: time-sensitive placement registration or interview assessment requirement.';
    } else if (/exam|midterm|final exam|theory timetable/i.test(text)) {
      priority_reason = 'Marked high: mandatory academic examination timetable or room schedule.';
    } else if (/overdue|penalty|deduction|assignment|due date/i.test(text)) {
      priority_reason = 'Marked high: upcoming submission deadline with academic penalties.';
    } else {
      priority_reason = 'Marked high: urgent university requirement.';
    }
  } else if (/(newsletter|photo of the week|routine|intermittent|courtesy notice|optional meetup|general circular|mess timings|hostel residents)/i.test(text)) {
    priority = 'Low';
    if (/mess|hostel|library/i.test(text)) {
      priority_reason = 'Marked low: routine campus administrative circular with no urgent deadline.';
    } else {
      priority_reason = 'Marked low: non-urgent routine update or student newsletter.';
    }
  } else {
    priority = 'Medium';
    priority_reason = 'Marked medium: relevant campus activity with moderate timeline.';
  }

  // 3. Deadline & Confidence (Resolves tricky cases: vague dates, relative dates, two dates)
  let deadline = null;
  let deadline_confidence = 'confirmed';

  // Tricky Case A: Vague deadline ("early next week", "sometime soon", "tentatively")
  if (/early\s+next\s+week|sometime\s+(late|next|soon)|tentative|tentatively|pending\s+venue|to\s+be\s+announced|tba/i.test(text)) {
    deadline_confidence = 'uncertain';
    const tentative = new Date(refDate);
    tentative.setDate(tentative.getDate() + 7);
    tentative.setHours(17, 0, 0, 0);
    deadline = tentative.toISOString();
  }
  // Tricky Case B: Two dates (e.g., "Workshop on Nov 22nd, but registration closes strictly on Nov 20th")
  // Rule: the student action deadline is the registration cutoff!
  else if (/registration\s+closes?\s+(?:strictly\s+)?(?:on|by)?\s*([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/i.test(text)) {
    const monthStr = RegExp.$1;
    const dayNum = parseInt(RegExp.$2, 10);
    const d = new Date(refDate);
    const monthIdx = new Date(`${monthStr} 1, 2026`).getMonth();
    if (!isNaN(monthIdx)) d.setMonth(monthIdx);
    d.setDate(dayNum);
    d.setHours(23, 59, 0, 0);
    deadline = d.toISOString();
    deadline_confidence = 'confirmed';
  }
  // Tricky Case C: Relative date ("by this Friday", "this Friday at 5:00 PM")
  else if (/this\s+friday/i.test(text)) {
    const d = new Date(refDate);
    const currentDay = d.getDay(); // 0 is Sun, 5 is Fri
    let diff = (5 - currentDay + 7) % 7;
    if (diff === 0) diff = 7; // next Friday if today is Friday
    d.setDate(d.getDate() + diff);
    if (/5(?::00)?\s*pm/i.test(text)) {
      d.setHours(17, 0, 0, 0);
    } else {
      d.setHours(23, 59, 0, 0);
    }
    deadline = d.toISOString();
    deadline_confidence = 'confirmed';
  }
  // Tomorrow deadline
  else if (/tomorrow\s+(?:at|by)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i.test(text) || /by\s+tomorrow/i.test(text)) {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    deadline = d.toISOString();
    deadline_confidence = 'confirmed';
  }
  // Specific date pattern (e.g. "commence from November 25, 2026", "before November 18, 2026", "Nov 15th")
  else if (/(?:before|due|deadline|by|on|commence\s+from|commencing\s+on|starts?\s+from|starts?\s+on|apply\s+before)\s+([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i.test(text) ||
           /(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?/i.test(text)) {
    let monthStr = RegExp.$1;
    let dayNum = parseInt(RegExp.$2, 10);
    let yearNum = RegExp.$3 ? parseInt(RegExp.$3, 10) : refDate.getFullYear();

    if (isNaN(dayNum)) {
      dayNum = parseInt(RegExp.$1, 10);
      monthStr = RegExp.$2;
    }

    const testMonth = new Date(`${monthStr} 1, 2026`).getMonth();
    if (!isNaN(testMonth)) {
      const d = new Date(yearNum, testMonth, dayNum, 23, 59, 0, 0);
      const sanitized = validateAndSanitizeDate(d.toISOString(), refDate);
      deadline = sanitized.validDate;
      deadline_confidence = sanitized.confidence;
    }
  }

  // 4. Required Action & Follow-up
  let required_action = null;
  let needs_followup = false;

  if (/(action required|you must|please confirm|reply with|register before|register your slot|rsvp|submit your|apply with|apply before|have your .* ready|bring your|admit card|fill the form)/i.test(text)) {
    needs_followup = true;
    if (/slot/i.test(text)) {
      required_action = 'Select assessment slot on the placement portal.';
    } else if (/cv|resume|statement of purpose/i.test(text)) {
      required_action = 'Reply with updated CV and availability.';
    } else if (/placement|apply before|register before|registration closes/i.test(text)) {
      required_action = 'Complete registration on the T&P portal before the deadline.';
    } else if (/assignment|github|architecture doc|source code/i.test(text)) {
      required_action = 'Submit assignment PDF to the course portal.';
    } else if (/timetable|exam|admit card|hall ticket|bring your/i.test(text)) {
      required_action = 'Verify hall ticket and note room allocations.';
    } else if (/fest|audition/i.test(text)) {
      required_action = 'Register team for the fest.';
    } else {
      required_action = 'Complete required student deliverable or verification.';
    }
  }

  // 5. Summary (2-3 sentences max)
  const sentences = body
    .replace(/\n+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .filter(s => s.length > 15)
    .slice(0, 3)
    .join(' ');

  const summary = sentences.length > 50 
    ? sentences 
    : `${subject}. Sent by ${sender}. Please review instructions carefully.`;

  // 6. Step 9 Reminders: needs_reply, needs_action, reminder_note
  const replySignals = /reply|respond|confirm|rsvp|select slot|choice|let me know|send.*cv|interview slot/i.test(text);
  const actionSignals = /submit|upload|due|pay|register|timetable|exam|bring|room|attendance|deadline/i.test(text);

  let needs_reply = false;
  let needs_action = false;
  let reminder_note = null;

  if (replySignals) {
    needs_reply = true;
    if (/slot/i.test(text)) {
      reminder_note = 'Confirm your preferred interview/assessment slot on the placement portal.';
    } else if (/cv|resume/i.test(text)) {
      reminder_note = 'Reply to professor with your updated CV and availability.';
    } else if (/rsvp|attend/i.test(text)) {
      reminder_note = 'Send RSVP / attendance confirmation.';
    } else {
      reminder_note = 'Reply to sender with requested information.';
    }
  }

  if (actionSignals || required_action) {
    needs_action = true;
    if (!reminder_note) {
      reminder_note = required_action || 'Complete required student deliverable or verification.';
    }
  }

  const cleanDeadlineLabel = deadline
    ? subject.replace(/^(?:re|fwd|urgent|mandatory|important|reminder|club event|placement notice)\s*[:&-]*\s*/gi, '').trim().slice(0, 60) || 'Scheduled Deadline'
    : null;

  return {
    category,
    summary,
    priority,
    priority_reason,
    deadline,
    deadline_label: cleanDeadlineLabel,
    deadline_confidence,
    required_action,
    needs_followup: Boolean(needs_followup || needs_reply || needs_action),
    needs_reply,
    needs_action,
    reminder_note,
    status: 'processed',
    error: null,
    _source: 'heuristic',
    _model: 'heuristic',
  };
}

/**
 * Validate that parsed output adheres strictly to the schema.
 */
function validateStructuredOutput(obj, refDate) {
  if (!obj || typeof obj !== 'object') return false;
  if (!VALID_CATEGORIES.includes(obj.category)) return false;
  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) return false;
  if (!VALID_PRIORITIES.includes(obj.priority)) return false;
  if (typeof obj.priority_reason !== 'string') return false;
  if (!VALID_CONFIDENCES.includes(obj.deadline_confidence)) return false;
  if (typeof obj.needs_followup !== 'boolean') return false;

  // Step 13: Date validation & sanitization
  if (obj.deadline) {
    const { validDate, confidence } = validateAndSanitizeDate(obj.deadline, refDate);
    obj.deadline = validDate;
    if (confidence === 'uncertain') {
      obj.deadline_confidence = 'uncertain';
    }
  } else {
    obj.deadline = null;
  }

  if (obj.deadline_label !== null && obj.deadline_label !== undefined && typeof obj.deadline_label !== 'string') {
    obj.deadline_label = null;
  }

  if (obj.required_action !== null && typeof obj.required_action !== 'string') {
    obj.required_action = null;
  }

  obj.needs_reply = Boolean(obj.needs_reply);
  obj.needs_action = Boolean(obj.needs_action);
  if (obj.reminder_note && typeof obj.reminder_note !== 'string') {
    obj.reminder_note = null;
  }

  return true;
}

/**
 * Process a student email using the Gemini API with retry, rate-limit backoff, and safe zero-crash fallback.
 */
export async function processEmail({ subject = '', body = '', sender = '', receivedAt = new Date().toISOString() }) {
  const referenceTimestamp = new Date(receivedAt).toISOString();
  const refDate = new Date(referenceTimestamp);
  const refWeekday = refDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

  if (!aiClient) {
    return heuristicProcessor({ subject, body, sender, receivedAt: referenceTimestamp });
  }

  const systemPrompt = `You are Campus Cue's AI Email Analyst for university students.
Analyze the student email and return ONLY a valid JSON object matching the requested schema.

REFERENCE TIMESTAMP: ${referenceTimestamp} (${refWeekday})
CRITICAL RULES:
1. Relative dates (e.g. "today", "tomorrow", "this Friday", "by next Monday") MUST be resolved strictly relative to this reference timestamp (${refWeekday}). For example, if reference is Thursday Nov 12, 2026, "by this Friday" is Friday Nov 13, 2026.
2. Vague or tentative dates (e.g. "early next week", "sometime soon", "tentatively planned", "pending venue approval"): MUST set deadline_confidence: "uncertain".
3. Multiple dates in one email (e.g., event date vs registration cutoff): The deadline must be the student action deadline (when registration closes), NOT the event date!
4. Reject dates more than 365 days away or with invalid years.
5. High Priority: urgent academic schedules (exams, room shifts, submissions, attendance warnings) and valuable time-sensitive opportunities (placement drives, interview shortlists, internships).
6. Low Priority: routine newsletters, club social digests, general mess/hostel maintenance circulars.
7. Category must be exactly one of: "Academics", "Placements", "Clubs", "Events", "Announcements".
8. deadline_label: specific concise 3-6 word label describing what the deadline is for (e.g. "CS301 Assignment 3 Submission", "Google SWE Slot Selection"), or null if no deadline exists. Never return a generic "Action Deadline".
9. required_action: concise sentence of what the student must do, or null.
10. needs_reply: true if the email asks student to reply, confirm attendance, or pick a slot.
11. needs_action: true if student must submit, register, attend, or complete a task.
12. reminder_note: short sentence describing what to reply to or complete.`;

  const userPrompt = `Sender: ${sender}
Subject: ${subject}
Received At: ${referenceTimestamp}

Email Body:
${body}`;

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const activeModel = attempt === 1 ? GEMINI_MODEL : GEMINI_FALLBACK_MODEL;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out after 25s')), 25000)
      );

      const generatePromise = aiClient.models.generateContent({
        model: activeModel,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, enum: VALID_CATEGORIES },
              summary: { type: Type.STRING },
              priority: { type: Type.STRING, enum: VALID_PRIORITIES },
              priority_reason: { type: Type.STRING },
              deadline: { type: Type.STRING, nullable: true },
              deadline_label: { type: Type.STRING, nullable: true },
              deadline_confidence: { type: Type.STRING, enum: VALID_CONFIDENCES },
              required_action: { type: Type.STRING, nullable: true },
              needs_followup: { type: Type.BOOLEAN },
              needs_reply: { type: Type.BOOLEAN },
              needs_action: { type: Type.BOOLEAN },
              reminder_note: { type: Type.STRING, nullable: true },
            },
            required: [
              'category',
              'summary',
              'priority',
              'priority_reason',
              'deadline_confidence',
              'needs_followup',
              'needs_reply',
              'needs_action',
            ],
          },
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = response.text ? response.text.trim() : '';

      const parsed = JSON.parse(rawText);
      if (validateStructuredOutput(parsed, refDate)) {
        parsed._source = 'gemini';
        parsed._model = activeModel;
        parsed.status = 'processed';
        parsed.error = null;
        if (!parsed.deadline_label && parsed.deadline) {
          parsed.deadline_label = subject.trim().slice(0, 60);
        }
        lastAiProbe = { aiMode: 'live', model: activeModel, error: null, checkedAt: new Date().toISOString() };
        return parsed;
      } else {
        throw new Error('Gemini output failed schema validation');
      }
    } catch (err) {
      lastError = redactSecrets(err?.message || 'Unknown error');
      console.warn(`[emailProcessor] Attempt ${attempt} (${activeModel}) failed:`, lastError);

      if (/429/.test(lastError)) {
        await new Promise(r => setTimeout(r, 2000));
      } else if (/API_KEY_INVALID|API key not valid|401|403|PERMISSION_DENIED/i.test(lastError)) {
        break;
      } else if (attempt === 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }

  lastAiProbe = {
    aiMode: 'offline',
    model: GEMINI_MODEL,
    error: lastError || 'Gemini processing failed.',
    checkedAt: new Date().toISOString(),
  };
  console.error('[emailProcessor] All Gemini attempts failed. Using safe zero-crash fallback.', lastError);
  return createSafeFallback(body, lastError);
}

/**
 * Smart AI Reply Drafter
 */
export async function generateReplyDraft({ subject = '', body = '', sender = '', action = '', intent = 'polite_confirm', studentNotes = '', studentName = '' }) {
  const intentPrompts = {
    polite_confirm: 'Acknowledge receipt and politely confirm attendance / slot / action as requested.',
    request_extension: 'Politely request a brief deadline extension with a reasonable, respectful academic justification.',
    ask_question: 'Ask a thoughtful, concise clarifying question about the submission guidelines or meeting agenda.',
    polite_decline: 'Express sincere gratitude but politely decline due to an irreconcilable scheduling conflict.',
  };

  const selectedIntent = intentPrompts[intent] || intentPrompts.polite_confirm;
  const signoffName = studentName ? studentName.trim() : 'Student';

  if (!aiClient) {
    const senderName = sender.split('<')[0].trim() || 'Professor';
    let draftBody = '';
    
    if (intent === 'request_extension') {
      draftBody = `Dear ${senderName},\n\nThank you for the update regarding "${subject}".\n\nI am writing to respectfully ask if it might be possible to grant a brief extension on this submission. Due to an overlapping course milestone this week, the additional time would allow me to ensure the work meets the highest quality standards.\n\nThank you very much for your time and understanding.\n\nSincerely,\n${signoffName}`;
    } else if (intent === 'ask_question') {
      draftBody = `Dear ${senderName},\n\nThank you for reaching out regarding "${subject}".\n\nCould you please clarify the specific format requirements for this deliverable? I want to make sure our team adheres to your guidelines.\n\nThank you for your guidance,\n${signoffName}`;
    } else if (intent === 'polite_decline') {
      draftBody = `Dear ${senderName},\n\nThank you very much for this opportunity regarding "${subject}".\n\nUnfortunately, due to a prior academic commitment scheduled at the same time, I will be unable to participate on this occasion. I hope to stay engaged with future opportunities.\n\nBest regards,\n${signoffName}`;
    } else {
      draftBody = `Dear ${senderName},\n\nThank you for the notification regarding "${subject}".\n\nI am writing to confirm that I have noted the details and have completed the requested action (${action || 'as outlined in your email'}).\n\nPlease let me know if any further information is required.\n\nBest regards,\n${signoffName}`;
    }

    return {
      draftSubject: `Re: ${subject.replace(/^Re:\s*/i, '')}`,
      draftBody,
      _source: 'heuristic',
    };
  }

  const prompt = `You are Campus Cue's Smart AI Reply Assistant for university students.
Generate a concise, professional, student-to-faculty/corporate email reply.

Original Email Subject: ${subject}
Original Sender: ${sender}
Original Email Body:
${body}

Student's Intent: ${selectedIntent}
Student's Personal Notes / Context: ${studentNotes || 'None'}
Student's Name: ${signoffName}

Generate a JSON object with:
- draftSubject: string (starting with Re:)
- draftBody: string (cleanly formatted with salutation, 2-3 body paragraphs, and student sign-off)`;

  try {
    const res = await aiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            draftSubject: { type: Type.STRING },
            draftBody: { type: Type.STRING },
          },
          required: ['draftSubject', 'draftBody'],
        },
      },
    });

    const parsed = JSON.parse(res.text.trim());
    parsed._source = 'gemini';
    return parsed;
  } catch (err) {
    console.warn('[emailProcessor] Gemini reply generation failed, using heuristic fallback:', err.message);
    const senderName = sender.split('<')[0].trim() || 'Professor';
    return {
      draftSubject: `Re: ${subject.replace(/^Re:\s*/i, '')}`,
      draftBody: `Dear ${senderName},\n\nThank you for your email regarding "${subject}".\n\nI have received your note and will proceed as requested.\n\nSincerely,\n${signoffName}`,
      _source: 'fallback',
    };
  }
}

export default { processEmail, computeContentHash, validateAndSanitizeDate, generateReplyDraft, heuristicProcessor };
