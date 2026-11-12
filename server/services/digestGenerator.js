import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { redactSecrets } from './emailProcessor.js';

dotenv.config();

let aiClient = null;

function initDigestAiClient(key) {
  const cleanKey = (key || '').trim();
  if (cleanKey && !cleanKey.includes('your_gemini')) {
    try {
      return new GoogleGenAI({ apiKey: cleanKey });
    } catch (err) {
      console.warn('⚠️ [digestGenerator] Could not initialize GoogleGenAI:', redactSecrets(err.message));
    }
  }
  return null;
}

aiClient = initDigestAiClient(process.env.GEMINI_API_KEY || process.env.AI_API_KEY);

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_FALLBACK_MODEL = 'gemini-3.7-flash';

export function reloadDigestAiClient(newKey) {
  aiClient = initDigestAiClient(newKey);
  return Boolean(aiClient);
}

/**
 * Intelligent deterministic heuristic digest builder used when offline or without Gemini API key.
 * Strictly respects the requirement that every item carries email_id and only confirmed deadlines
 * appear in upcoming_deadlines (uncertain dates go in uncertain_deadlines / "to verify").
 */
function heuristicDigestBuilder(structuredEmails = [], studentName = '', fallbackReason = null) {
  const nameGreeting = studentName ? `${studentName}, ` : '';
  const now = new Date();

  // 1. Confirmed deadlines only
  const confirmedDeadlines = structuredEmails
    .filter(e => e.deadline && e.deadline_confidence !== 'uncertain')
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .map(e => {
      const d = new Date(e.deadline);
      const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      let urgency = 'Upcoming';
      if (diffDays <= 2) urgency = 'Urgent';
      else if (diffDays <= 5) urgency = 'Soon';

      return {
        email_id: e.id,
        deadline: e.deadline,
        event_name: e.deadline_label || e.subject,
        days_left: Math.max(0, diffDays),
        urgency,
      };
    });

  // 2. Uncertain deadlines ("to verify" list)
  const uncertainDeadlines = structuredEmails
    .filter(e => e.deadline && e.deadline_confidence === 'uncertain')
    .map(e => ({
      email_id: e.id,
      deadline_label: e.deadline_label || e.subject,
      tentative_date: e.deadline,
      notes: e.priority_reason || 'Tentative date extracted from email context; verify with instructor or organizer.',
    }));

  // 3. Urgent announcements (High priority announcements or academics)
  const urgentAnnouncements = structuredEmails
    .filter(e => {
      const cat = (e.user_category || e.category || '').toLowerCase();
      const prio = (e.priority || '').toLowerCase();
      return prio === 'high' && (cat === 'announcements' || cat === 'academics');
    })
    .map(e => ({
      email_id: e.id,
      subject: e.subject,
      takeaway: e.summary || e.subject,
      action: e.required_action || 'Review announcement details immediately.',
    }));

  // 4. Placement opportunities
  const placementOpportunities = structuredEmails
    .filter(e => {
      const cat = (e.user_category || e.category || '').toLowerCase();
      return cat === 'placements';
    })
    .map(e => ({
      email_id: e.id,
      company_role: e.subject,
      deadline: e.deadline || null,
      action: e.required_action || 'Check placement portal for eligibility and slot selection.',
    }));

  // 5. Pending actions (needs_reply, needs_action, or required_action)
  const pendingActions = structuredEmails
    .filter(e => e.needs_reply || e.needs_action || e.required_action || e.needs_followup)
    .map(e => ({
      email_id: e.id,
      action: e.reminder_note || e.required_action || 'Complete requested follow-up.',
      due_hint: e.deadline ? `Due ${new Date(e.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Action required',
      type: e.needs_reply ? 'reply' : 'action',
    }));

  // 6. Important new emails (Top priority or unread items)
  const importantNewEmails = structuredEmails
    .filter(e => (e.priority || '').toLowerCase() === 'high' || !e.is_read)
    .slice(0, 4)
    .map(e => ({
      email_id: e.id,
      headline: e.subject,
      takeaway: e.summary || e.subject,
    }));

  // 7. Friendly student-first overview (2-3 sentences)
  const urgentCount = urgentAnnouncements.length;
  const deadlineCount = confirmedDeadlines.length;
  const oppCount = placementOpportunities.length;

  const overview = `Good day, ${nameGreeting}here is your collegiate briefing. You have ${deadlineCount} confirmed deadline${deadlineCount === 1 ? '' : 's'} on your radar and ${urgentCount} urgent update${urgentCount === 1 ? '' : 's'} requiring immediate attention. ${oppCount > 0 ? `There are also ${oppCount} active placement/career opportunity updates to track.` : 'All routine campus communications are categorized below.'}`;

  return {
    overview,
    important_new_emails: importantNewEmails,
    upcoming_deadlines: confirmedDeadlines,
    uncertain_deadlines: uncertainDeadlines,
    urgent_announcements: urgentAnnouncements,
    placement_opportunities: placementOpportunities,
    pending_actions: pendingActions,
    date: new Date().toISOString().split('T')[0],
    generated_at: new Date().toISOString(),
    _source: fallbackReason ? 'fallback' : 'heuristic',
    model: fallbackReason ? 'fallback' : 'heuristic',
    ai_error: fallbackReason ? redactSecrets(fallbackReason) : null,
  };
}

/**
 * Generate full Academic Command Center Digest from already-processed structured emails.
 */
export async function generateAcademicDigest({ structuredEmails = [], studentName = '' }) {
  if (!structuredEmails || structuredEmails.length === 0) {
    return {
      overview: 'Your collegiate inbox is quiet today with no active emails to digest.',
      important_new_emails: [],
      upcoming_deadlines: [],
      uncertain_deadlines: [],
      urgent_announcements: [],
      placement_opportunities: [],
      pending_actions: [],
      date: new Date().toISOString().split('T')[0],
      generated_at: new Date().toISOString(),
      _source: 'empty',
      model: 'none',
      ai_error: null,
    };
  }

  // If no Gemini client, run heuristic generator immediately
  if (!aiClient) {
    return heuristicDigestBuilder(structuredEmails, studentName, null);
  }

  // Prepare concise structured payload (DO NOT pass raw email bodies)
  const structuredDigestInput = structuredEmails.map(e => ({
    email_id: e.id,
    sender: e.senderName || e.sender,
    subject: e.subject,
    category: e.user_category || e.category,
    priority: e.priority,
    priority_reason: e.priority_reason,
    summary: e.summary,
    deadline: e.deadline,
    deadline_confidence: e.deadline_confidence,
    required_action: e.required_action,
    needs_reply: Boolean(e.needs_reply),
    needs_action: Boolean(e.needs_action),
    reminder_note: e.reminder_note,
  }));

  const systemPrompt = `You are Campus Cue's Academic Intelligence Digest synthesizer for university students.
Synthesize the provided structured email data into an authoritative, clean Daily Academic Digest.

Rules:
1. overview: exactly 2 to 3 sentences, written to the student in a friendly, empowering, and organized tone.
2. important_new_emails: list the key takeaways from the top priority emails.
3. upcoming_deadlines: ONLY confirmed deadlines. Include email_id, deadline, event_name, days_left, and urgency (Urgent, Soon, Upcoming).
4. uncertain_deadlines: ANY tentative or unconfirmed dates go strictly here in this "to verify" list. Never mix them into upcoming_deadlines.
5. urgent_announcements: critical notices regarding exams, venue changes, policies, or grade reports.
6. placement_opportunities: placement drives, internship openings, assessments, or career notices.
7. pending_actions: checklist of things the student must reply to or complete.
8. CRITICAL: Every single item in every section MUST include the exact email_id it originates from, so the student can click to read the original email.`;

  const userPrompt = `Student Name: ${studentName || 'Student'}
Today's Date: ${new Date().toISOString().split('T')[0]}

Structured Email Data:
${JSON.stringify(structuredDigestInput, null, 2)}`;

  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const activeModel = attempt === 1 ? GEMINI_MODEL : GEMINI_FALLBACK_MODEL;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Digest generation timed out after 25s')), 25000)
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
              overview: { type: Type.STRING },
              important_new_emails: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    email_id: { type: Type.STRING },
                    headline: { type: Type.STRING },
                    takeaway: { type: Type.STRING },
                  },
                  required: ['email_id', 'headline', 'takeaway'],
                },
              },
              upcoming_deadlines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    email_id: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    event_name: { type: Type.STRING },
                    days_left: { type: Type.INTEGER },
                    urgency: { type: Type.STRING },
                  },
                  required: ['email_id', 'deadline', 'event_name', 'urgency'],
                },
              },
              uncertain_deadlines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    email_id: { type: Type.STRING },
                    deadline_label: { type: Type.STRING },
                    tentative_date: { type: Type.STRING },
                    notes: { type: Type.STRING },
                  },
                  required: ['email_id', 'deadline_label', 'notes'],
                },
              },
              urgent_announcements: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    email_id: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    takeaway: { type: Type.STRING },
                    action: { type: Type.STRING },
                  },
                  required: ['email_id', 'subject', 'takeaway'],
                },
              },
              placement_opportunities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    email_id: { type: Type.STRING },
                    company_role: { type: Type.STRING },
                    deadline: { type: Type.STRING, nullable: true },
                    action: { type: Type.STRING },
                  },
                  required: ['email_id', 'company_role'],
                },
              },
              pending_actions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    email_id: { type: Type.STRING },
                    action: { type: Type.STRING },
                    due_hint: { type: Type.STRING },
                    type: { type: Type.STRING },
                  },
                  required: ['email_id', 'action'],
                },
              },
            },
            required: [
              'overview',
              'important_new_emails',
              'upcoming_deadlines',
              'uncertain_deadlines',
              'urgent_announcements',
              'placement_opportunities',
              'pending_actions',
            ],
          },
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = response.text ? response.text.trim() : '';
      const parsed = JSON.parse(rawText);

      parsed.date = new Date().toISOString().split('T')[0];
      parsed.generated_at = new Date().toISOString();
      parsed._source = 'gemini';
      parsed.model = activeModel;
      parsed.ai_error = null;
      return parsed;
    } catch (err) {
      lastErr = redactSecrets(err?.message || 'Gemini digest failed');
      console.warn(`[digestGenerator] Attempt ${attempt} (${activeModel}) failed:`, lastErr);
      if (/API_KEY_INVALID|API key not valid|401|403|PERMISSION_DENIED/i.test(lastErr)) break;
      if (attempt === 1) await new Promise(r => setTimeout(r, 800));
    }
  }

  return heuristicDigestBuilder(structuredEmails, studentName, lastErr || 'Gemini unavailable');
}

export default { generateAcademicDigest };

