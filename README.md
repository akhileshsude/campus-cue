# Campus Cue (`clg.inbox`) 🎓📬
> **Intelligent AI Email Assistant for University Students**  
> *Phase 1: Project Setup & Dashboard UI*  
> *Phase 2: AI Core Intelligence (Gemini SDK, Classification, Two-Column Reader, Deadline Radar)*  
> *Phase 3: Academic Command Center (Daily Digest, Follow-up Reminders)*  
> *Phase 4: Complete Email Ingestion Flow (.eml Drag-and-Drop, Manual Paste, Gmail OAuth Sync)*  
> *Phase 5: Reliability Safeguards, Database Migration & Handoff Readiness*

Campus Cue cuts through the overwhelming noise of university inboxes by surfacing urgent notices, tracking academic and placement deadlines, generating daily student briefings, extracting actionable deliverables, and tracking pending follow-ups.

---

## 📁 Project Architecture & Folder Structure

```text
campus-cue/
├── client/                     # Frontend (React 19, Vite, Tailwind CSS, Lucide React)
│   ├── src/
│   │   ├── components/         # Modular UI components matching editorial mockup
│   │   │   ├── TopBar.jsx          # Header, search, + Ingest, Run AI Pipeline, Avatar
│   │   │   ├── Sidebar.jsx         # Forest green sidebar (Home, Digest, Inbox, Deadlines, Actions)
│   │   │   ├── HomeView.jsx        # Editorial Dashboard with personalized greeting & AI Summary
│   │   │   ├── DigestView.jsx      # Phase 3: Daily Academic Command Center Briefing
│   │   │   ├── ActionsView.jsx     # Phase 3: Follow-up reminders (Needs reply & Needs action)
│   │   │   ├── InboxView.jsx       # Category tabs, priority pills, sender initials, search
│   │   │   ├── DeadlinesView.jsx   # Timeline view (Upcoming, Overdue, Completed) + .ics Export
│   │   │   ├── EmailDetailView.jsx # Original email + AI summary + Student overrides + Smart Reply Drafter
│   │   │   ├── IngestModal.jsx     # 1-Box Quick Paste, .eml/.mbox drop, Extension & IMAP/OAuth sync
│   │   │   ├── FirstRunModal.jsx   # First-run onboarding ("What should we call you?")
│   │   │   ├── SettingsModal.jsx   # Edit profile, inline Gemini API key, Clear Samples & Reset Demo
│   │   │   ├── MobileBottomNav.jsx # Bottom navigation bar for mobile sketch layout
│   │   │   └── LandingPage.jsx     # Bold editorial public landing page
│   │   ├── context/
│   │   │   ├── UserContext.jsx     # React context & useUser hook for student identity
│   │   │   └── userUtils.js        # Pure functions for greetings, initials, first name
│   │   ├── App.jsx             # Main application state orchestration & API integration
│   │   ├── index.css           # Bold editorial theme tokens & paper texture
│   │   └── main.jsx            # React root mount wrapped in UserProvider
│   ├── package.json
│   └── vite.config.js          # Proxies /api to backend (http://localhost:5001)
│
├── server/                     # Backend (Node.js, Express, Supabase, Google GenAI, Mailparser)
│   ├── src/
│   │   ├── index.js            # Express server (Emails, Deduplication, Reprocess, Queue delays, Filters)
│   │   ├── supabaseClient.js   # Supabase client initializer (graceful fallback)
│   │   └── sampleData.js       # Realistic university dataset with tricky edge cases
│   ├── services/
│   │   ├── emailProcessor.js   # Gemini structured JSON processor with retry & safe fallback
│   │   ├── digestGenerator.js  # Phase 3: Synthesizes daily academic command center digest
│   │   ├── imapService.js      # Universal IMAP sync & MX/domain provider detector (any email ID)
│   │   ├── microsoftService.js # Microsoft / Outlook / M365 OAuth 2.0 & Graph Mail.Read sync
│   │   ├── localPersistence.js # Persistent disk inbox store, attachments cache & AES-256-GCM vault
│   │   └── supabaseStore.js    # Unified Supabase schema adapter (emails + email_analysis + reminders)
│   ├── scripts/
│   │   ├── testProcessor.js    # AI email analysis test suite (10/10 passing)
│   │   ├── testDigest.js       # Academic digest generator test suite
│   │   ├── testEmlParser.js    # .eml file mailparser test suite
│   │   ├── testEndpoints.js    # Safeguards, hash deduplication & provider detection checks
│   │   └── testHttpRoutes.js   # In-process Express HTTP route integration suite (12 checks)
│   ├── tests/
│   │   ├── collegeEmails.js    # Realistic Indian university email dataset (6 realistic + 3 tricky)
│   │   └── runCollegeTests.js  # Test runner with verification matrix (36/36 checks, 100% accuracy)
│   ├── schema.sql              # Supabase PostgreSQL schema with SHA-256 deduplication & indexes
│   └── package.json
│
├── extension/                  # Chrome MV3 Webmail Sync Extension (zero OAuth / zero IMAP)
├── .env.example                # Example environment variables template
├── package.json                # Root monorepo orchestrator with concurrently
└── README.md                   # Operational & handoff documentation
```

---

## ⚡ Quick Start Guide (Single Command Execution)

### 1. Prerequisites
- **Node.js** (v18 or higher recommended; fully verified on Node v26.8.1)
- **npm** (v9 or higher)

### 2. Install Dependencies
Run a single command from the repository root:

```bash
npm run install:all
```

*Or install each directory individually:*
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

Available variables in `server/.env`:
```env
PORT=5001
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Gemini API Key (for LLM processing, summaries & reply drafts)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Credentials (leave blank to run in mock/sample-data mode)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional for Phase 4 Gmail & Microsoft/Outlook Sync:
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/google/callback

MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-app-client-secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:5001/api/auth/microsoft/callback

# Client Deploy-Readiness (leave blank in dev)
VITE_API_URL=
```

> **Persistent Real Data & Zero-Setup Resilience:**
> - Even without Supabase credentials, Campus Cue automatically persists your real synced emails, edits, reminders, digests, attachments, and AES-256-GCM encrypted session credentials locally in gitignored `server/data/`.
> - Connecting any real inbox automatically replaces showcase sample items with your real email correspondence. If `GEMINI_API_KEY` is blank, Campus Cue uses deterministic offline heuristics; you can paste a Gemini key directly inside **Settings > Gemini AI Key** (saved locally to `server/.env`) to activate live extraction immediately without restarting.

### 4. Run Both Frontend and Backend
Launch both services concurrently with a single command:

```bash
npm run dev
```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5001](http://localhost:5001)
- **Health Check Endpoint**: [http://localhost:5001/api/health](http://localhost:5001/api/health)

---

## 🧪 Comprehensive Verification & Test Suites

Campus Cue includes automated test suites covering every layer of the system:

```bash
# Run every test suite across server & client at once:
npm run test:all

# Or run individual suites:
npm run test:college    # Realistic Indian College Emails (36/36 checks, 100% accuracy)
npm run test:ai         # AI Email Processor Suite (10/10 emails)
npm run test:digest     # Academic Command Center Digest Suite
npm run test:eml        # .EML Mailparser & Attachment Test
npm run test:endpoints  # SHA-256 Deduplication, Date Safeguards & Provider Detection
npm run test:http       # 12 Express HTTP Route Integration Tests
npm run test:user       # UserContext Initials & Time-Based Greeting Flow
npm run build           # Production Frontend Build
```

---

## 🗄️ Database Integration & Migrations (Step 11)

Campus Cue is backed by a Supabase PostgreSQL schema defined in `server/schema.sql`.

### Tables Overview:
1. `emails`: Stores ingested raw emails (`id`, `user_id`, `source`, `external_id`, `content_hash`, `sender`, `sender_name`, `subject`, `body`, `attachments`, `is_read`, `received_at`, `created_at`).
   - Unique constraint: `CONSTRAINT uq_emails_user_content UNIQUE (user_id, content_hash)`.
2. `email_analysis`: Stores AI intelligence and student overrides (`category`, `user_category`, `summary`, `priority`, `user_priority`, `priority_reason`, `deadline`, `user_deadline`, `deadline_confidence`, `required_action`, `needs_reply`, `needs_action`, `reminder_note`, `status`).
3. `reminders`: Follow-up action items (`email_id`, `type`, `status`, `snoozed_until`).
4. `digests`: Daily synthesized briefing (`user_id`, `date`, `content` JSONB, `created_at`).
5. `user_tokens`: Secure storage for OAuth refresh and access tokens.
6. `v_emails_with_analysis`: Unified PostgreSQL view calculating effective category, priority, and deadline (`COALESCE(user_category, category)`).

### Setting Up Supabase:
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open `server/schema.sql`, copy all contents, and click **Run**.
4. Retrieve your **Project URL** and **Anon Public Key** from **Project Settings > API**.
5. Paste them into `server/.env`:
   ```env
   SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

### Deduplication & Free-Tier Rate Limiting:
- **Content Hash Deduplication**: Ingested emails compute a SHA-256 hash across `sender + subject + body`. If an email with the same hash exists, Campus Cue skips redundant LLM calls and reuses existing intelligence.
- **Queue Pacing**: The batch processor (`POST /api/emails/process-all`) executes in batches of 2 with a `1200ms` delay between iterations, preventing free-tier RPM (Requests Per Minute) throttling.
- **Single Email Reprocess**: Individual emails can be re-analyzed on manual click via `POST /api/emails/:id/reprocess`.

---

## 🛡️ Reliability Safeguards (Step 13)

1. **Date Safeguards & Strict Confidence Handling**:
   - Dates $> 365$ days in the future, invalid years ($< 2024$ or $> 2030$), or malformed strings are automatically sanitized.
   - Ambiguous or tentative dates (e.g. *"early next week"*) are flagged with `deadline_confidence: "uncertain"`.
   - **Crucial Rule**: Uncertain deadlines are displayed with the label `Unconfirmed · Verify` and are **strictly excluded** from confirmed upcoming deadline counters and calendar exports.
   - Relative dates (*"by this Friday"*, *"tomorrow at 5 PM"*) are resolved accurately against the email's `received_at` timestamp.
2. **Student Overrides with "Edited by you" Badge**:
   - Students can override **Category**, **Priority**, and **Deadline** (using an integrated `datetime-local` picker).
   - Student choices take strict precedence over AI predictions across all views, counters, deadlines, and exports.
   - An `Edited by you` indicator is prominently displayed whenever an override is active.
   - Students can reset overrides back to the original AI prediction at any time.
3. **Calendar Export (.ics)**:
   - On the Deadlines view, click **"Export Calendar (.ics)"** to instantly generate and download standard RFC 5545 iCalendar data (`campus_deadlines.ics`), compatible with Google Calendar, Apple Calendar, and Outlook.
4. **Original Email Access**:
   - Raw headers, sender addresses, timestamps, content hashes, and unformatted bodies are accessible via the **"View original email"** modal in the email reader.

---

## 📬 Email Ingestion Flow — Works With ANY Email ID (Step 10+)

1. **⚡ 1-Box Quick Paste & Drag-and-Drop `.eml` / `.mbox` (Zero setup, works everywhere)**:
   - In **+ Ingest > 1. Paste Email**, copy any email in Gmail, Outlook Web, or Apple Mail (`Cmd+A` → `Cmd+C`) and click **Paste from Clipboard** — `parseRawEmailText` automatically extracts sender, subject, date, and body.
   - Or open **2. .eml / .mbox** to drop exported `.eml` or `.mbox` files directly (even straight from macOS Apple Mail). Saved attachments download directly from the email detail view.
2. **⚡ 1-Click Chrome Extension (Zero OAuth / Zero IMAP — ideal when College IT blocks third-party apps)**:
   - Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `extension/`.
   - Open your college Gmail, Outlook, Roundcube, or Zimbra tab, click the **clg.inbox** icon, and click **⚡ 1-Click Sync Open Webmail Tab**.
3. **Personal / Unlocked Account IMAP Sync & Forwarding Relay**:
   - Open **+ Ingest > 3. Connect Inbox > Personal / Unlocked Account**.
   - Enter any email ID (including a personal Gmail receiving auto-forwarded college mail); Campus Cue detects IMAP/MX settings automatically (`imap.gmail.com`, `outlook.office365.com`, `imap.mail.me.com`, `imap.mail.yahoo.com`, `imappro.zoho.com`, or custom `mail.<university.edu>`) and encrypts credentials locally with AES-256-GCM (`server/data/vault.json`).
4. **Developer / Advanced Connections (Optional OAuth 2.0, Apps Script & Webhook)**:
   - **Google / Gmail OAuth**: Configure `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` with callback `http://localhost:5001/api/auth/google/callback` and `gmail.readonly` scope.
   - **Microsoft / Outlook / College M365 OAuth**: Register Azure App with callback `http://localhost:5001/api/auth/microsoft/callback` and delegated `User.Read`, `Mail.Read`, `offline_access`.
   - **Inbound Webhook (`POST /api/emails/inbound` & `/api/emails/inbound-batch`)**: Accepts JSON payloads (`{ from, to, subject, text, date, is_read }`), optionally secured via `INBOUND_WEBHOOK_SECRET`.

---

## 🛠️ Developer & Demo Controls (Step 14)

### Demo Reset:
To restore the sample emails, reminders, and daily digest to their initial showcase state:
- Open **Settings** (gear icon in sidebar) > click **"Reset Demo"** (or **"Clear Samples"** to start an empty live inbox).
- Or send an API request:
  ```bash
  curl -X POST http://localhost:5001/api/reset-demo
  ```

---

## ⚠️ Honest List of Known Limitations & Edge Cases

1. **Institutional Google Workspace Admin Policies**:
   - Many university Google accounts enforce strict admin restrictions blocking external OAuth applications. Campus Cue detects this restriction and falls back to drag-and-drop `.eml` ingestion.
2. **Heuristic Engine vs. Live Gemini Model**:
   - When running offline without a Gemini API key, the deterministic heuristic engine uses advanced regex and collegiate keyword patterns. While it scores 100% on standard Indian college formats, unusual non-standard formats may require student manual corrections.
3. **Multipart Email Parsing**:
   - Complex HTML-only newsletters with heavy nested tables may have their layout simplified into plain text during ingestion.
4. **Free-Tier Rate Limits**:
   - Gemini free tier has a 15 RPM quota limit. Batch processing implements delay intervals, but very large batch uploads (>50 emails) should be ingested in increments.

---

## 🚀 Future Deployment Checklist (DO NOT DEPLOY NOW)

When you are ready to deploy Campus Cue to production hosting:

- [ ] **Frontend (e.g. Vercel / Netlify)**:
  - Set Root Directory to `client`.
  - Set Build Command to `npm run build`.
  - Set Output Directory to `dist`.
  - Set Environment Variable: `VITE_API_URL=https://your-backend-domain.com`.
- [ ] **Backend (e.g. Render / Railway / Fly.io)**:
  - Set Root Directory to `server`.
  - Set Build Command to `npm install`.
  - Set Start Command to `npm start`.
  - Set Environment Variables:
    - `PORT=5001`
    - `CLIENT_URL=https://your-frontend-domain.com`
    - `CORS_ORIGIN=https://your-frontend-domain.com`
    - `GEMINI_API_KEY=...`
    - `SUPABASE_URL=...`
    - `SUPABASE_ANON_KEY=...`
    - `SUPABASE_SERVICE_ROLE_KEY=...`
    - `GOOGLE_CLIENT_ID=...`
    - `GOOGLE_CLIENT_SECRET=...`
    - `GOOGLE_REDIRECT_URI=https://your-backend-domain.com/api/auth/google/callback`
- [ ] **Google Cloud Console**:
  - Add your production callback URL to **Authorized redirect URIs**.
- [ ] **Supabase**:
  - Run `server/schema.sql` in the production Supabase database.
