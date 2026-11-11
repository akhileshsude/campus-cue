// Realistic sample email dataset for Campus Cue
// Includes tricky edge cases: relative dates, vague deadlines, multiple dates, newsletters, and urgent exam notices

import crypto from 'node:crypto';

const now = new Date();
const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
const daysFromNow = (d, h = 0) => new Date(now.getTime() + (d * 24 + h) * 60 * 60 * 1000).toISOString();

function quickHash(sender, subject, body) {
  return crypto.createHash('sha256').update(`${(sender || '').trim().toLowerCase()}|${(subject || '').trim().toLowerCase()}|${(body || '').replace(/\s+/g, ' ').trim()}`).digest('hex');
}

export const sampleDigest = {
  date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
  headline: "3 academic updates today — CS301 exam reschedule & project milestone",
  summary: "CS301 midterm exam room allocation was moved to Turing Auditorium for tomorrow morning. Prof. Thorne released rubric details for Friday's architecture doc submission. Also, Math 204 office hours have shifted from Thursday to Friday afternoon.",
  actionItems: [
    "Confirm CS301 exam seat in Turing Auditorium 101 tomorrow at 9:00 AM.",
    "Push CS301 architecture diagram to GitHub repository before Friday 11:59 PM.",
    "Review DS Lab 2 feedback on Canvas before viva next Tuesday.",
    "Select preferred Google SWE technical test slot before tomorrow 5:00 PM."
  ]
};

export const sampleEmails = [
  // 1. Tricky Case: URGENT EXAM NOTICE (High priority, strict relative date, mandatory action)
  {
    id: "cue-001",
    sender: "Department of Computer Science <cs-eval@university.edu>",
    senderName: "CS Academic Affairs",
    subject: "URGENT & MANDATORY: CS301 Midterm Exam Room Shift & Seating Allotment",
    body: `ATTENTION ALL CS301 REGISTERED STUDENTS:

Due to HVAC maintenance in Hall B, the CS301 Midterm Examination scheduled for tomorrow at 9:00 AM has been shifted to the Main Turing Auditorium (Room 101).

Mandatory rules:
1. You must report by 8:40 AM with your physical university photo ID.
2. Digital devices, smartwatches, and programmable calculators are strictly prohibited.
3. Seating allotments have been uploaded to the student portal. Verify your row number before arrival.

Failure to appear at the new location will result in an automatic zero.

Office of Academic Evaluations`,
    category: "Academics",
    user_category: null,
    priority: "High",
    priority_reason: "Marked high: mandatory exam schedule shift with severe academic penalty.",
    received_at: hoursAgo(2),
    deadline: daysFromNow(1, -2), // tomorrow morning
    deadline_label: "CS301 Midterm Exam",
    deadline_confidence: "confirmed",
    required_action: "Check portal seating row and report to Turing Auditorium 101 by 8:40 AM tomorrow.",
    needs_followup: true,
    summary: "The CS301 Midterm Examination has been moved to Turing Auditorium 101 tomorrow at 9:00 AM due to facility repairs. Students must report by 8:40 AM with a physical ID, as failure to appear results in an automatic zero.",
    is_read: false,
    ai_processed: true,
  },

  // 2. Tricky Case: TWO DATES IN ONE EMAIL (Info session on Thursday vs application/assessment slot deadline tomorrow)
  {
    id: "cue-002",
    sender: "University Placement Cell <placements@university.edu>",
    senderName: "Placement Cell",
    subject: "Google SWE Summer 2027: Campus Shortlist & Technical Assessment Slot",
    body: `Dear Shortlisted Candidate,

Congratulations! You have advanced to Round 1 of Google's Summer 2027 Software Engineering Internship drive.

Please take note of the upcoming schedule:
- Optional Info & Q&A Session: Thursday at 3:00 PM on Google Meet.
- CRITICAL DEADLINE: You MUST select your preferred online coding assessment slot (Saturday 10:00 AM or Saturday 4:00 PM) on the placement portal by tomorrow at 5:00 PM sharp.

Candidates who fail to confirm their slot by tomorrow 5:00 PM will be dropped from the drive. Keep your college ID card ready for the proctored test.

Best regards,
Placement & Corporate Relations`,
    category: "Placements",
    user_category: null,
    priority: "High",
    priority_reason: "Marked high: critical placement assessment slot registration closing in 24 hours.",
    received_at: hoursAgo(4),
    deadline: daysFromNow(1), // tomorrow 5 PM
    deadline_label: "Confirm Assessment Slot",
    deadline_confidence: "confirmed",
    required_action: "Select coding assessment time slot on placement portal before tomorrow 5:00 PM.",
    needs_followup: true,
    summary: "Shortlisted for Google SWE Summer 2027 internship round. While an optional Q&A is on Thursday, you must confirm your coding test slot by tomorrow 5:00 PM to avoid disqualification.",
    is_read: false,
    ai_processed: true,
  },

  // 3. Tricky Case: VAGUE DEADLINE ("sometime late next month" -> uncertain confidence!)
  {
    id: "cue-003",
    sender: "Undergraduate Research Committee <ug-research@university.edu>",
    senderName: "UG Research Committee",
    subject: "Spring 2027 Independent Research & Capstone Proposals (Call for Expressions of Interest)",
    body: `Dear Students,

The committee is preparing the project catalog for Spring 2027 Independent Study (CS499 / ECE499).

Faculty mentors will be submitting project abstracts over the coming weeks. Student proposals will be due sometime late next month once the portal opens. Formal submission dates and guidelines will be announced in a follow-up bulletin.

If you plan to propose an industry-sponsored topic, begin discussing preliminary scopes with your academic advisor.

Regards,
Research Committee`,
    category: "Academics",
    user_category: null,
    priority: "Medium",
    priority_reason: "Marked medium: future academic research opportunity without an immediate deadline.",
    received_at: hoursAgo(8),
    deadline: daysFromNow(35), // vague future
    deadline_label: "Capstone Proposals (Tentative)",
    deadline_confidence: "uncertain", // CRITICAL: uncertain!
    required_action: "Discuss preliminary research topic with advisor before portal opens next month.",
    needs_followup: false,
    summary: "Call for expressions of interest for Spring 2027 Independent Study proposals, which will be due sometime late next month. Students interested in industry topics should consult advisors in advance.",
    is_read: false,
    ai_processed: true,
  },

  // 4. Tricky Case: RELATIVE DATE ("this Friday by 11:59 PM")
  {
    id: "cue-004",
    sender: "Prof. Aris Thorne <a.thorne@university.edu>",
    senderName: "Prof. Aris Thorne",
    subject: "CS301: Phase 1 Architecture & Design Doc Due This Friday",
    body: `Hello Class,

Please ensure your team has finalized the Phase 1 architectural design document and database schema for the Distributed File Store project.

Key reminders:
1. Include an entity-relationship diagram and API endpoint contracts.
2. Ensure your private GitHub repository is shared with TAs (@ta-sys-core).
3. The deadline is strictly this Friday at 11:59 PM. Late submissions will incur a 10% penalty per day.

Office hours will be held on Thursday 2:00 PM - 4:00 PM in Turing Hall 304 if you need design feedback.

Best regards,
Prof. Thorne`,
    category: "Academics",
    user_category: null,
    priority: "High",
    priority_reason: "Marked high: assignment milestone due this Friday with late submission penalty.",
    received_at: hoursAgo(10),
    deadline: daysFromNow(2, 4), // this Friday
    deadline_label: "Phase 1 Design Doc",
    deadline_confidence: "confirmed",
    required_action: "Share private GitHub repo with TA and submit Phase 1 architecture PDF.",
    needs_followup: true,
    summary: "CS301 Phase 1 architectural design document and schema are due this Friday at 11:59 PM with a 10% daily late penalty. Teams must share their private GitHub repository with the TAs.",
    is_read: false,
    ai_processed: true,
  },

  // 5. Tricky Case: NON-URGENT CLUB NEWSLETTER (Low priority, no action, no deadline)
  {
    id: "cue-005",
    sender: "Pixel Photography Club <pixel-club@university.edu>",
    senderName: "Pixel Club",
    subject: "Pixel Weekly #42: Autumn Golden Hour Showcase & Lens Care Tips",
    body: `Hey shutterbugs!

Hope your week is off to a great start. In this week's newsletter, we feature Maya Lin's stunning sunrise shot over the North Quad clocktower as our Photo of the Week!

Check out our blog post on how to clean your camera sensor and prevent moisture damage during foggy mornings.

Keep shooting,
The Pixel Club Editorial Team`,
    category: "Clubs",
    user_category: null,
    priority: "Low",
    priority_reason: "Marked low: non-urgent student club newsletter with no actionable requirements.",
    received_at: hoursAgo(14),
    deadline: null,
    deadline_label: null,
    deadline_confidence: "confirmed",
    required_action: null,
    needs_followup: false,
    summary: "Weekly newsletter featuring member photography highlights and sensor cleaning tips. Contains no action items or academic deadlines.",
    is_read: true,
    ai_processed: true,
  },

  // 6. Tricky Case: TENTATIVE / CONFLICTING DATES ("Tentatively scheduled for next Wednesday, but venue approval pending")
  {
    id: "cue-006",
    sender: "AI & Robotics Society <robotics-board@university.edu>",
    senderName: "Robotics Club",
    subject: "Autonomous Rover Demo: Date Tentatively Set for Next Wednesday (Pending Venue)",
    body: `Hi Team,

Great progress on the computer vision SLAM module!

We are planning the outdoor autonomous obstacle avoidance demo. It is tentatively scheduled for next Wednesday at 3:30 PM on the East Lawn, but campus administration has not yet approved the lawn permit due to construction nearby. It might shift to Thursday.

Please do not book lab equipment transports until the venue confirmation email is sent on Monday.

Best,
Robotics Society Core`,
    category: "Clubs",
    user_category: null,
    priority: "Medium",
    priority_reason: "Marked medium: club demo scheduled tentatively pending facility permit.",
    received_at: hoursAgo(18),
    deadline: daysFromNow(7),
    deadline_label: "Rover Demo (Tentative)",
    deadline_confidence: "uncertain", // CRITICAL: uncertain!
    required_action: "Hold equipment transport bookings until lawn permit is confirmed Monday.",
    needs_followup: false,
    summary: "Outdoor autonomous rover demonstration is tentatively scheduled for next Wednesday at 3:30 PM, but may shift pending lawn permits. Team members should wait for final confirmation before booking transport.",
    is_read: true,
    ai_processed: true,
  },

  // 7. Tricky Case: EVENT WITH NEAR-TERM RSVP DEADLINE (Lecture is on Nov 18, but RSVP ticket closes Sunday)
  {
    id: "cue-007",
    sender: "Office of Student Affairs <events@university.edu>",
    senderName: "Student Affairs Events",
    subject: "Presidential Lecture: Dr. Fei-Fei Li on 'The Next Decade of AI' (Pass RSVP)",
    body: `Dear Campus Community,

We are honored to host Dr. Fei-Fei Li for our Presidential Distinguished Lecture series on Tuesday, November 18 at 5:30 PM in the University Auditorium.

Seating is free but requires registered digital passes due to auditorium fire code limits. Registered students can attend the post-lecture book signing and tea reception.

CRITICAL: RSVP via the Campus Events gateway before this Sunday 6:00 PM to claim your ticket. Remaining passes will be opened to general public on Monday.

Office of Student Affairs & Academic Colloquia`,
    category: "Events",
    user_category: null,
    priority: "Medium",
    priority_reason: "Marked medium: high-profile event RSVP closing Sunday with limited seating.",
    received_at: hoursAgo(22),
    deadline: daysFromNow(4), // Sunday RSVP
    deadline_label: "Fei-Fei Li Keynote RSVP",
    deadline_confidence: "confirmed",
    required_action: "Claim digital pass through Campus Events portal before Sunday 6:00 PM.",
    needs_followup: true,
    summary: "Dr. Fei-Fei Li will deliver the Presidential Distinguished Lecture on November 18. Students must claim free digital tickets via the events gateway before Sunday 6:00 PM before passes release to the public.",
    is_read: true,
    ai_processed: true,
  },

  // 8. Tricky Case: LIBRARY OVERDUE WARNING (High priority, imminent penalty, direct action)
  {
    id: "cue-008",
    sender: "Central Library Services <circulation@university.edu>",
    senderName: "Library Services",
    subject: "OVERDUE WARNING: 2 Reserved Books Due Tomorrow at 5:00 PM",
    body: `Dear Student,

Our records indicate that you have 2 borrowed titles due for return or online renewal tomorrow by 5:00 PM:
1. 'Introduction to Algorithms (4th Edition)' - Cormen et al.
2. 'Operating Systems: Three Easy Pieces' - Arpaci-Dusseau

Because another student has placed a hold on 'Introduction to Algorithms', online renewal for that book is unavailable. A late fee of $5.00/day applies immediately after tomorrow 5:00 PM.

Please return the book to the circulation desk drop-box before the deadline.

Circulation Services, University Library`,
    category: "Announcements",
    user_category: null,
    priority: "High",
    priority_reason: "Marked high: borrowed book with active hold due tomorrow; daily fines apply.",
    received_at: hoursAgo(26),
    deadline: daysFromNow(1, 2),
    deadline_label: "Return Reserved Books",
    deadline_confidence: "confirmed",
    required_action: "Return algorithms book to library circulation desk before tomorrow 5:00 PM.",
    needs_followup: true,
    summary: "Two borrowed books are due tomorrow at 5:00 PM, and one cannot be renewed due to another patron's hold. Failure to return will trigger a $5/day fine.",
    is_read: false,
    ai_processed: true,
  },

  // 9. Tricky Case: RESEARCH LAB INTERVIEW INVITATION (High priority, requires reply with CV)
  {
    id: "cue-009",
    sender: "Prof. Elena Rostova <e.rostova@university.edu>",
    senderName: "Prof. Elena Rostova",
    subject: "Undergraduate Research Assistant Opening: Graph Neural Networks Lab",
    body: `Hi there,

I reviewed your submission for the advanced algorithms assignment and was very impressed by your graph traversal optimizations.

My lab has an opening for an undergraduate research assistant starting next semester, focusing on scalable graph embeddings for biomedical knowledge graphs. 

Could you let me know if you are interested and available for a brief 15-minute chat this Thursday between 3:00 PM and 5:00 PM? Please reply with your updated CV and transcript by tomorrow evening.

Warm regards,
Dr. Elena Rostova
Associate Professor, AI & Data Intelligence Lab`,
    category: "Academics",
    user_category: null,
    priority: "High",
    priority_reason: "Marked high: competitive research assistantship invitation requiring reply with CV.",
    received_at: hoursAgo(28),
    deadline: daysFromNow(1, 8),
    deadline_label: "Reply with CV to Dr. Rostova",
    deadline_confidence: "confirmed",
    required_action: "Email updated CV, transcript, and preferred Thursday chat time slot.",
    needs_followup: true,
    summary: "Dr. Rostova has offered an interview for an undergraduate research assistantship in Graph Neural Networks. Students must reply by tomorrow evening with their CV and preferred Thursday chat time.",
    is_read: false,
    ai_processed: true,
  },

  // 10. Tricky Case: ROUTINE CAMPUS MAINTENANCE (Low priority announcement, no deadline, no action)
  {
    id: "cue-010",
    sender: "Campus IT Infrastructure <netops@university.edu>",
    senderName: "Campus IT Helpdesk",
    subject: "Routine Campus Wi-Fi Firmware Maintenance This Sunday Morning",
    body: `Attention Students & Faculty,

Campus Network Operations will be performing scheduled core router firmware upgrades this Sunday between 2:00 AM and 5:00 AM.

During this window, eduroam Wi-Fi in residential halls may experience brief 5-minute disconnects. No action is required on your part.

Campus IT Helpdesk`,
    category: "Announcements",
    user_category: null,
    priority: "Low",
    priority_reason: "Marked low: routine overnight infrastructure maintenance requiring no student action.",
    received_at: hoursAgo(34),
    deadline: null,
    deadline_label: null,
    deadline_confidence: "confirmed",
    required_action: null,
    needs_followup: false,
    summary: "Scheduled overnight Wi-Fi firmware upgrade on Sunday from 2:00 AM to 5:00 AM may cause brief connection drops. No student action required.",
    is_read: true,
    ai_processed: true,
  }
];

sampleEmails.forEach(email => {
  if (!email.content_hash) {
    email.content_hash = quickHash(email.sender, email.subject, email.body);
  }
  if (!email.source) {
    email.source = 'sample';
  }
});

export const sampleReminders = sampleEmails
  .filter(email => email.needs_followup || email.needs_reply || email.needs_action)
  .map(email => {
    const isReply = email.needs_reply || /reply|confirm|rsvp|slot/i.test(email.subject + ' ' + (email.required_action || ''));
    return {
      id: `rem-${email.id}`,
      email_id: email.id,
      emailId: email.id,
      subject: email.subject,
      sender: email.senderName || email.sender,
      action: email.required_action || 'Complete follow-up',
      reminder_type: isReply ? 'reply' : 'action',
      reminder_note: email.reminder_note || email.required_action || 'Review and take action',
      reminder_text: `${email.subject}: ${email.required_action || 'Follow up'}`,
      status: 'pending',
      deadline: email.deadline,
      due_date: email.deadline,
      snoozed_until: null,
      is_completed: false,
      created_at: email.received_at,
    };
  });
