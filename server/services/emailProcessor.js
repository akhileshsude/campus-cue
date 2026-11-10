import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

let aiClient = null;
if (API_KEY && !API_KEY.includes('your_gemini')) {
  try {
    aiClient = new GoogleGenAI({ apiKey: API_KEY });
  } catch (err) {
    console.warn('⚠️ Could not initialize GoogleGenAI client:', err.message);
  }
}

// Allowed enum constants
const VALID_CATEGORIES = ['Academics', 'Placements', 'Clubs', 'Events', 'Announcements'];
const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const VALID_CONFIDENCES = ['confirmed', 'uncertain'];

/**
 * Fallback response object when AI fails or input is malformed.
 */
function createSafeFallback(body = '') {
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
    priority_reason: 'Standard notice (fallback classification).',
    deadline: null,
    deadline_confidence: 'uncertain',
    required_action: null,
    needs_followup: false,
    _source: 'fallback',
  };
}

/**
 * Smart heuristic processor used when GEMINI_API_KEY is not set or offline.
 * Enables full end-to-end testing and development without requiring an API key.
 */
function heuristicProcessor({ subject = '', body = '', sender = '', receivedAt }) {
  const refDate = receivedAt ? new Date(receivedAt) : new Date();
  const text = `${subject} ${body}`.toLowerCase();

  // 1. Category Detection
  let category = 'Announcements';
  if (/(exam|quiz|assignment|homework|professor|prof\.|syllabus|lecture|lab viva|cs301|math204|grading|office hours|research assistant)/i.test(text)) {
    category = 'Academics';
  } else if (/(placement|shortlist|internship|interview|hiring|recruitment|coding test|assessment|deloitte|google swe)/i.test(text)) {
    category = 'Placements';
  } else if (/(hackathon|hackbattle|robotics|rover|photography|pixel club|audition|society meeting)/i.test(text)) {
    category = 'Clubs';
  } else if (/(keynote|symposium|fest|distinguished lecture|rsvp|annual conference|auditorium)/i.test(text)) {
    category = 'Events';
  }

  // 2. Priority & Reason
  let priority = 'Medium';
  let priority_reason = 'Standard campus correspondence.';
  
  if (/(urgent|mandatory|exam|shortlist|disqualification|penalty|due tomorrow|overdue|closing soon)/i.test(text)) {
    priority = 'High';
    if (/shortlist|interview|coding test/i.test(text)) {
      priority_reason = 'Marked high: time-sensitive placement assessment or interview requirement.';
    } else if (/exam|midterm|final exam/i.test(text)) {
      priority_reason = 'Marked high: mandatory academic examination schedule or policy.';
    } else if (/overdue|penalty|due/i.test(text)) {
      priority_reason = 'Marked high: upcoming submission deadline with potential penalties.';
    } else {
      priority_reason = 'Marked high: urgent university requirement.';
    }
  } else if (/(newsletter|photo of the week|routine|intermittent|courtesy notice|solutions posted)/i.test(text)) {
    priority = 'Low';
    priority_reason = 'Marked low: non-urgent routine update or informational newsletter.';
  } else {
    priority = 'Medium';
    priority_reason = 'Marked medium: relevant campus activity with moderate timeline.';
  }

  // 3. Deadline & Confidence
  let deadline = null;
  let deadline_confidence = 'confirmed';

  if (/sometime\s+(late|next|towards)|tentative|tentatively|pending\s+venue|to\s+be\s+announced/i.test(text)) {
    deadline_confidence = 'uncertain';
    if (/next month/i.test(text)) {
      const tentative = new Date(refDate);
      tentative.setDate(tentative.getDate() + 30);
      deadline = tentative.toISOString();
    } else if (/next (tuesday|wednesday|thursday|friday)/i.test(text)) {
      const tentative = new Date(refDate);
      tentative.setDate(tentative.getDate() + 7);
      deadline = tentative.toISOString();
    }
  } else if (/tomorrow\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i.test(text) || /by\s+tomorrow/i.test(text)) {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0); // default 5 PM
    deadline = d.toISOString();
    deadline_confidence = 'confirmed';
  } else if (/this\s+friday/i.test(text)) {
    const d = new Date(refDate);
    const day = d.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(23, 59, 0, 0);
    deadline = d.toISOString();
    deadline_confidence = 'confirmed';
  } else if (/in\s+(\d+)\s+days?/i.test(text)) {
    const days = parseInt(RegExp.$1, 10);
    const d = new Date(refDate);
    d.setDate(d.getDate() + days);
    deadline = d.toISOString();
    deadline_confidence = 'confirmed';
  }

  // 4. Required Action & Follow-up
  let required_action = null;
  let needs_followup = false;

  if (/(action required|you must|please confirm|reply with|register your slot|rsvp|submit your)/i.test(text)) {
    needs_followup = true;
    if (/slot/i.test(text)) {
      required_action = 'Select assessment slot on the placement portal.';
    } else if (/cv|resume/i.test(text)) {
      required_action = 'Reply with updated CV and availability.';
    } else if (/rsvp/i.test(text)) {
      required_action = 'Claim student pass via the events portal.';
    } else if (/discord/i.test(text)) {
      required_action = 'Join hackathon Discord server before deadline.';
    } else if (/design doc|github/i.test(text)) {
      required_action = 'Submit architecture doc and share GitHub repo with TA.';
    } else {
      required_action = 'Review details and complete required student action.';
    }
  }

  // 5. Summary (2-3 sentences)
  const sentences = body
    .replace(/\n+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .filter(s => s.length > 15)
    .slice(0, 3)
    .join(' ');

  const summary = sentences.length > 50 
    ? sentences 
    : `${subject}. Sent by ${sender}. Please review the instructions carefully.`;

  return {
    category,
    summary,
    priority,
    priority_reason,
    deadline,
    deadline_confidence,
    required_action,
    needs_followup,
    _source: 'heuristic',
  };
}

/**
 * Validate that parsed output adheres strictly to the schema.
 */
function validateStructuredOutput(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!VALID_CATEGORIES.includes(obj.category)) return false;
  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) return false;
  if (!VALID_PRIORITIES.includes(obj.priority)) return false;
  if (typeof obj.priority_reason !== 'string') return false;
  if (!VALID_CONFIDENCES.includes(obj.deadline_confidence)) return false;
  if (typeof obj.needs_followup !== 'boolean') return false;

  // Validate deadline format if not null
  if (obj.deadline !== null && typeof obj.deadline === 'string') {
    const parsed = new Date(obj.deadline);
    if (isNaN(parsed.getTime())) {
      // Invalid date string
      obj.deadline = null;
      obj.deadline_confidence = 'uncertain';
    }
  } else {
    obj.deadline = null;
  }

  if (obj.required_action !== null && typeof obj.required_action !== 'string') {
    obj.required_action = null;
  }

  return true;
}

/**
 * Process a student email using the Gemini API (with retry, validation, rate-limit backoff, and fallback).
 *
 * @param {Object} emailData
 * @param {string} emailData.subject
 * @param {string} emailData.body
 * @param {string} emailData.sender
 * @param {string|Date} emailData.receivedAt
 * @returns {Promise<Object>} Structured classification and summary
 */
export async function processEmail({ subject = '', body = '', sender = '', receivedAt = new Date().toISOString() }) {
  const referenceTimestamp = new Date(receivedAt).toISOString();

  // If no Gemini API key configured, use deterministic heuristic engine
  if (!aiClient) {
    return heuristicProcessor({ subject, body, sender, receivedAt: referenceTimestamp });
  }

  const systemPrompt = `You are Campus Cue's AI Email Analyst for university students.
Analyze the following student email and return ONLY a valid JSON object matching the requested schema.

REFERENCE TIMESTAMP: ${referenceTimestamp}
All relative dates like "today", "tomorrow", "this Friday", "next week", "in 2 days" MUST be calculated relative to this reference timestamp.

STRICT INSTRUCTIONS:
1. Category: Must be exactly one of: "Academics", "Placements", "Clubs", "Events", "Announcements".
2. Summary: Write a concise 2 to 3 sentence summary focusing on student obligations, deadlines, and key updates.
3. Priority:
   - "High": Urgent academic announcements (exams, room shifts, attendance warnings, imminent assignment deadlines) or high-stakes career opportunities (placement tests, interview slot booking, competitive internships) with near deadlines.
   - "Medium": Standard assignments with moderate timeline, team meetings, general events requiring RSVP.
   - "Low": Routine club newsletters, general notices, or non-urgent facilities announcements.
4. Priority Reason: A single short sentence explaining why this priority was assigned (e.g. "Marked high: assignment due in 2 days.").
5. Deadline:
   - Output an ISO 8601 string (e.g. "2026-11-14T17:00:00Z") or null if no deadline.
   - If there are multiple dates (e.g. an info session vs final application deadline), pick the FINAL ACTION DEADLINE that the student must meet.
6. Deadline Confidence:
   - CRITICAL RULE: Never present an uncertain date as confirmed.
   - Set to "uncertain" if the date is vague (e.g. "sometime late next month"), tentative ("tentatively scheduled"), missing specific details, or if dates conflict.
   - Set to "confirmed" only when the date and time are clearly established.
7. Required Action: A concise description of what the student must do (e.g. "Select coding assessment slot on portal"), or null if no student action is required.
8. Needs Follow-up: true if student reply/submission is needed; false otherwise.`;

  const userPrompt = `Email Metadata:
- Sender: ${sender}
- Received At: ${referenceTimestamp}
- Subject: ${subject}

Email Body:
${body}`;

  // Call Gemini with retry logic
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // 15 second timeout controller
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out after 15s')), 15000)
      );

      const generatePromise = aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                enum: VALID_CATEGORIES,
              },
              summary: { type: Type.STRING },
              priority: {
                type: Type.STRING,
                enum: VALID_PRIORITIES,
              },
              priority_reason: { type: Type.STRING },
              deadline: { type: Type.STRING, nullable: true },
              deadline_confidence: {
                type: Type.STRING,
                enum: VALID_CONFIDENCES,
              },
              required_action: { type: Type.STRING, nullable: true },
              needs_followup: { type: Type.BOOLEAN },
            },
            required: [
              'category',
              'summary',
              'priority',
              'priority_reason',
              'deadline_confidence',
              'needs_followup',
            ],
          },
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = response.text ? response.text.trim() : '';

      const parsed = JSON.parse(rawText);
      if (validateStructuredOutput(parsed)) {
        parsed._source = 'gemini';
        return parsed;
      } else {
        throw new Error('Gemini output failed schema validation');
      }
    } catch (err) {
      lastError = err;
      console.warn(`[emailProcessor] Attempt ${attempt} failed:`, err.message);

      // Handle 429 rate limit backoff
      if (err.message && err.message.includes('429')) {
        console.log('[emailProcessor] Rate limit hit, backing off 2s...');
        await new Promise(r => setTimeout(r, 2000));
      } else if (attempt === 1) {
        // Brief pause before single retry
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }

  // Graceful fallback: Never crash the app
  console.error('[emailProcessor] All Gemini attempts failed. Using safe default.', lastError?.message);
  return createSafeFallback(body);
}

export default { processEmail };

