# Campus Cue 🎓📬
> **Intelligent AI Email Assistant for University Students**  
> *Phase 1: Project Setup & Dashboard UI*  
> *Phase 2: AI Core Intelligence (Gemini SDK, Smart Classification, Two-Column Reader, Deadline Radar)*

Campus Cue cuts through the noise of campus inboxes by surfacing urgent emails, tracking upcoming assignment and placement deadlines, generating daily academic summaries, extracting actionable student tasks, and reminding students of pending follow-ups.

---

## 📁 Project Architecture & Folder Structure

```text
campus-cue/
├── client/                     # Frontend (React 19, Vite, Tailwind CSS, Lucide React)
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # Modular UI components
│   │   │   ├── Navbar.jsx          # Header, brand, search bar, "Run AI Pipeline" button
│   │   │   ├── OverviewCards.jsx   # Total, Unread, High-Priority, Confirmed Deadline stats
│   │   │   ├── CategoryFilter.jsx  # Tabs for Academics, Placements, Clubs, Events, Announcements
│   │   │   ├── EmailCard.jsx       # Email card with priority reason, category dropdown & tags
│   │   │   ├── PriorityEmails.jsx  # Highlighted section for High-priority emails ranked by urgency
│   │   │   ├── DeadlineList.jsx    # Deadline Radar: Overdue, Today, This Week, Later timeline
│   │   │   ├── DigestCard.jsx      # Daily academic briefing & action items
│   │   │   ├── ReminderList.jsx    # Actionable emails requiring reply with "Mark done"
│   │   │   └── EmailModal.jsx      # Two-column reader (Original email on left, AI summary on right)
│   │   ├── App.jsx             # Main dashboard view & state orchestration
│   │   ├── index.css           # Tailwind CSS directives & theme styles
│   │   └── main.jsx            # React root mount
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js          # Proxies /api to backend (http://localhost:5001)
│
├── server/                     # Backend (Node.js, Express, Supabase, Google GenAI)
│   ├── src/
│   │   ├── index.js            # Express server (health-check, /api/emails, /api/emails/process)
│   │   ├── supabaseClient.js   # Supabase client initializer (graceful fallback)
│   │   └── sampleData.js       # Realistic student dataset with 10 tricky edge-case emails
│   ├── services/
│   │   └── emailProcessor.js   # Gemini structured JSON processor with retry & safe fallback
│   ├── scripts/
│   │   └── testProcessor.js    # Standalone CLI test suite for AI email analysis
│   ├── schema.sql              # Supabase PostgreSQL schema with AI columns & indexes
│   ├── package.json
│   └── .env                    # Server environment variables
│
├── .env.example                # Example environment variables template
├── .gitignore                  # Git ignore rules (.env, node_modules, etc.)
├── package.json                # Root monorepo orchestrator with concurrently
└── README.md                   # Setup & operational guide
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18 or higher recommended; verified on Node v26)
- **npm** (v9 or higher)

### 2. Install Dependencies
Run the following single command from the project root:

```bash
npm run install:all
```

Or manually install each directory:
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 3. Environment Configuration
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```

To enable live Gemini AI models:
- Set `GEMINI_API_KEY=your_gemini_api_key_here` in `server/.env`.
- If no key is set, the app and test suite automatically run in **smart deterministic heuristic mode** so development and tests never crash.

### 4. Run the AI Test Suite
Test the email processor across all 10 realistic sample emails (including relative dates, vague deadlines, multiple dates, newsletters, and urgent exam shifts):

```bash
npm run test:ai
```

### 5. Run Frontend and Backend Together
Run both services concurrently using one command:

```bash
npm run dev
```

- **Frontend Dashboard**: `http://localhost:5173`
- **Backend API**: `http://localhost:5001`
  - Health check: `http://localhost:5001/api/health`
  - Emails API: `http://localhost:5001/api/emails`
  - AI Process Email: `POST http://localhost:5001/api/emails/process`
  - AI Batch Process: `POST http://localhost:5001/api/emails/process-all`

---

## 🤖 Phase 2 AI Features

1. **Structured Gemini Email Processor (`server/services/emailProcessor.js`)**:
   - Uses the official Google Gen AI SDK (`@google/genai`) with Gemini's JSON mode (`responseSchema`).
   - Extracts: `category`, `summary`, `priority`, `priority_reason`, `deadline`, `deadline_confidence`, `required_action`, `needs_followup`.
   - Relative dates like *"this Friday"* or *"by tomorrow 5 PM"* are resolved against the email's `received_at` timestamp.
   - Resilient design: Single automatic retry, rate-limit backoff, and a safe default fallback that ensures the app never crashes on bad AI output.

2. **Smart Classification & Student Category Override**:
   - Automatically assigns incoming emails to `Academics`, `Placements`, `Clubs`, `Events`, or `Announcements`.
   - Interactive dropdown on each email card lets students correct any misclassification, saving it to `user_category` in the database. `user_category` always takes precedence over the AI category.

3. **Two-Column Email Reader View (`client/src/components/EmailModal.jsx`)**:
   - **Left Column**: Full unedited original email (sender, timestamps, headers, raw text).
   - **Right Column**: Clear `AI-generated` labeled intelligence panel with a 2–3 sentence executive summary, priority reasoning, deadline badge, and an actionable student checklist.

4. **Priority Detection**:
   - Visual priority badges (`High` = red, `Medium` = amber, `Low` = grey).
   - Models are prompt-tuned to flag urgent academic notices (exams, schedule shifts, project submissions) and high-value career opportunities (placement assessments, interview bookings) as `High`.
   - Explicit `priority_reason` (e.g. *"Marked high: mandatory exam schedule shift with severe penalty"*) is shown directly under the badge.

5. **Deadline Radar (`client/src/components/DeadlineList.jsx`)**:
   - Chronological timeline grouped into: **Overdue**, **Today**, **This week**, and **Later**.
   - **Strict Confidence Handling**: Vague dates (e.g. *"sometime late next month"*) or tentative dates are flagged as `uncertain`. They are rendered with a distinct dashed amber border and a clear `⚠️ Unconfirmed, check the email` badge, and are **strictly excluded** from "due soon" alerts and the overview count.
   - Every deadline links directly to its source email.
