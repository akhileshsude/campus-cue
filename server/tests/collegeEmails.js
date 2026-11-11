/**
 * Step 12: Realistic Indian College Emails Dataset
 * Includes 6 realistic emails from Indian university environments + 3 tricky edge cases.
 */

const BASE_DATE = '2026-11-10T09:00:00.000Z';

export const realisticCollegeEmails = [
  // 1. Assignment announcement (with a due date)
  {
    id: 'test-in-001',
    name: '1. Assignment Announcement (Due Date)',
    sender: 'Prof. R. Ramanathan <ramanathan.cs@nitk.edu.in>',
    subject: 'CS302: Operating Systems Lab Assignment 4 Due Date Announced',
    received_at: BASE_DATE,
    body: `Dear 5th Semester B.Tech Students,\n\nThe problem statement for Lab Assignment 4 (Virtual Memory Page Replacement Algorithms in C++) has been uploaded to the course moodle.\n\nYou must submit your source code and design document before November 18, 2026 at 11:59 PM.\n\nSubmissions uploaded after the deadline will face a 10% deduction per day.\n\nProf. Ramanathan\nDept of Computer Science & Engineering`,
    expected: {
      category: 'Academics',
      priority: 'High',
      hasDeadline: true,
      deadlineConfidence: 'confirmed',
      requiredAction: 'Submit assignment PDF to the course portal.',
    },
  },

  // 2. Examination timetable
  {
    id: 'test-in-002',
    name: '2. Examination Timetable',
    sender: 'Controller of Examinations <coe-office@iitd.ac.in>',
    subject: 'MANDATORY: B.Tech Sem V End-Semester Theory Timetable & Hall Allocations',
    received_at: BASE_DATE,
    body: `Notice to all Registered Students,\n\nThe End-Semester Theory Examinations for November-December 2026 will commence from November 25, 2026.\n\nThe detailed seating matrix and room assignments across Bharti Building and Lecture Hall Complex are now active on the portal. Bring your physical student ID card and printed admit card.\n\nController of Examinations`,
    expected: {
      category: 'Academics',
      priority: 'High',
      hasDeadline: true,
      deadlineConfidence: 'confirmed',
      requiredAction: 'Verify hall ticket and note room allocations.',
    },
  },

  // 3. Placement registration notice (with eligibility and a deadline)
  {
    id: 'test-in-003',
    name: '3. Placement Registration Notice',
    sender: 'Training & Placement Cell <placements@bits-pilani.ac.in>',
    subject: 'Microsoft India Campus Drive 2026: SDE Role (CTC 44 LPA) Registration Closes Nov 14',
    received_at: BASE_DATE,
    body: `Dear Final Year Students,\n\nMicrosoft is visiting our campus for hiring Software Development Engineers (CTC 44.5 LPA).\n\nEligibility criteria: B.Tech CSE/ECE/EE with minimum CGPA 7.5 and no active backlogs.\n\nEligible students must register before November 14, 2026 on the placement portal. Late submissions will result in immediate disqualification.\n\nTraining & Placement Cell`,
    expected: {
      category: 'Placements',
      priority: 'High',
      hasDeadline: true,
      deadlineConfidence: 'confirmed',
      requiredAction: 'Complete registration on the T&P portal before the deadline.',
    },
  },

  // 4. Internship opportunity
  {
    id: 'test-in-004',
    name: '4. Internship Opportunity',
    sender: 'Centre for Sponsored Research <research-internships@iisc.ac.in>',
    subject: 'Summer Research Fellowship 2027: Computer Vision & Robotics Lab',
    received_at: BASE_DATE,
    body: `Applications are invited for the Summer Research Fellowship in Autonomous Systems. Selected interns will receive a monthly stipend of Rs. 25,000.\n\nInterested 3rd-year students should apply with their updated CV and statement of purpose before November 30, 2026.\n\nCoordinator, Robotics Research Lab`,
    expected: {
      category: 'Placements',
      priority: 'Medium',
      hasDeadline: true,
      deadlineConfidence: 'confirmed',
      requiredAction: 'Reply with updated CV and availability.',
    },
  },

  // 5. Club event announcement
  {
    id: 'test-in-005',
    name: '5. Club Event Announcement',
    sender: 'Culturals Secretariat <raag-club@vit.ac.in>',
    subject: 'Riviera 2027: Eastern Music Club Auditions & Battle of the Bands',
    received_at: BASE_DATE,
    body: `Hey VITians!\n\nAuditions for the official college band 'Raag' for the upcoming cultural fest Riviera are scheduled for this Saturday at the Indoor Amphitheatre from 5:00 PM onwards.\n\nBring your own instruments (amps and drum kit provided). Register your slot at the student desk!\n\nRaag Music Society`,
    expected: {
      category: 'Clubs',
      priority: 'Medium',
      hasDeadline: false,
      deadlineConfidence: 'confirmed',
      requiredAction: 'Register team for the fest.',
    },
  },

  // 6. General college announcement (low priority)
  {
    id: 'test-in-006',
    name: '6. General College Announcement (Low Priority)',
    sender: 'Office of Chief Warden <hostel-office@thapar.edu>',
    subject: 'Circular: Revised Hostel Mess Timings During Upcoming Mid-Term Break',
    received_at: BASE_DATE,
    body: `Attention Hostel Residents,\n\nPlease note that starting next Monday, dining hall services in Hostels J, K, and L will operate on the holiday schedule:\n- Breakfast: 8:00 AM - 10:00 AM\n- Lunch: 12:30 PM - 2:30 PM\n- Dinner: 7:30 PM - 9:30 PM\n\nNo student action is required.\n\nChief Warden`,
    expected: {
      category: 'Announcements',
      priority: 'Low',
      hasDeadline: false,
      deadlineConfidence: 'confirmed',
      requiredAction: null,
    },
  },

  // 7. Tricky Extra 1: Vague deadline ("early next week")
  {
    id: 'test-in-007',
    name: '7. [Tricky] Vague Deadline ("early next week")',
    sender: 'E-Cell Student Council <ecell@dtu.ac.in>',
    subject: 'Pitch Deck Draft Submissions Due Early Next Week',
    received_at: BASE_DATE,
    body: `Hello Founders,\n\nPlease have your 5-slide startup pitch deck ready early next week for mentor review. The exact room and schedule will be announced soon.\n\nBest,\nE-Cell Team`,
    expected: {
      category: 'Clubs',
      priority: 'Medium',
      hasDeadline: true,
      deadlineConfidence: 'uncertain',
      requiredAction: 'Complete required student deliverable or verification.',
    },
  },

  // 8. Tricky Extra 2: Email with Two Dates (Event date vs Registration Cutoff)
  {
    id: 'test-in-008',
    name: '8. [Tricky] Two Dates (Event on Nov 25th, but Registration Closes Nov 20th)',
    sender: 'IEEE Student Branch <ieee@manipal.edu>',
    subject: 'Hands-on Generative AI Hackathon on Nov 25th (Registration Closes Nov 20th)',
    received_at: BASE_DATE,
    body: `Dear Engineering Students,\n\nIEEE is proud to host a 24-hour Generative AI Hackathon on November 25, 2026 at the Innovation Centre.\n\nHowever, team registration closes strictly on November 20, 2026. Teams registering after November 20th will not be accepted.\n\nRegister before the deadline to book your lab terminal.\n\nIEEE Student Chair`,
    expected: {
      category: 'Events',
      priority: 'High',
      hasDeadline: true,
      deadlineConfidence: 'confirmed',
      targetDeadlineDay: 20, // Must pick Nov 20th, NOT Nov 25th!
      requiredAction: 'Complete registration on the T&P portal before the deadline.',
    },
  },

  // 9. Tricky Extra 3: Relative Date ("by this Friday at 5:00 PM")
  {
    id: 'test-in-009',
    name: '9. [Tricky] Relative Date ("by this Friday at 5:00 PM")',
    sender: 'Prof. K. Verma <kverma@iiit.ac.in>',
    subject: 'MANDATORY: Submit your Mini-Project Synopsis by this Friday at 5:00 PM',
    received_at: BASE_DATE, // Tuesday, Nov 10, 2026 -> this Friday is Nov 13, 2026
    body: `Hello Class,\n\nAll project teams must submit their one-page mini-project synopsis and supervisor consent form by this Friday at 5:00 PM.\n\nLate submissions will not be evaluated for internal marks.\n\nProf. Verma`,
    expected: {
      category: 'Academics',
      priority: 'High',
      hasDeadline: true,
      deadlineConfidence: 'confirmed',
      targetDeadlineDay: 13, // Nov 13, 2026
      requiredAction: 'Submit assignment PDF to the course portal.',
    },
  },
];

export default realisticCollegeEmails;

