# AI Enquiry Tracker & Automation Hub

An intelligent, command-driven administrative enquiry tracking application designed for educational academies and training institutes. It provides a real-time console with Web Speech-to-Text and NLP intent parsing via Google Gemini 1.5, supported by a Supabase Postgres backend and Telegram automated alerts.

---

## 🚀 Key Features

*   **AI Command Box & CLI**: Type or dictate administrative instructions (using Web Speech API) to log, update, filter, or delete enquiries.
*   **Dual Mode Engine**: Supports full **Client-Side Simulation (Sandbox)** using `localStorage` and rule-based parsing, or **Supabase Live Mode** utilizing Gemini Edge Functions.
*   **Structured Resolution Checklist**: Enquiries remain active in reminder pipelines until all three statuses (*Interested*, *Follow-up*, *Reachable*) are set.
*   **Automated Telegram Reminders**: Consolidation cron jobs that find overdue leads, compile alert reports, and push notifications to administrators.
*   **Dynamic Courses Catalog & CRUD**: Configurable Tech/Academy catalog with tuition fee controls.

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), TypeScript, Lucide Icons, Glassmorphism CSS design system.
*   **Backend**: Supabase Database, Supabase Edge Functions (Deno), Supabase pg_cron.
*   **AI Core**: Google Gemini 1.5 Flash (via Function Calling/Tool Use).
*   **Alerts**: Telegram Bot API.

---

## 📂 Project Directory Structure

```text
├── src/
│   ├── components/
│   │   ├── CommandBox.tsx       # Text & speech CLI inputs, quick suggestion chips
│   │   ├── EnquiryCard.tsx      # Interactive checklist card for unresolved leads
│   │   ├── Header.tsx           # Digital clock, date, live/offline status indicator
│   │   ├── Sidebar.tsx          # Collapsible main menu & theme toggler
│   │   └── TerminalLog.tsx      # Retro-styled developer console detailing AI steps
│   ├── lib/
│   │   ├── assistant.ts         # Hybrid connection router (Simulation ⇄ Edge Function)
│   │   ├── geminiSim.ts         # Local NLP parser simulating Gemini function calling
│   │   ├── localDatabase.ts     # Offline browser memory database and seed data
│   │   └── supabaseClient.ts    # Safe initialization of Supabase client
│   ├── pages/
│   │   ├── Courses.tsx          # Read-only student-facing course catalog
│   │   ├── Dashboard.tsx        # Main desk: Command console, cron simulator, list boards
│   │   ├── ManageCourses.tsx    # Offerings manager (CRUD categories and courses)
│   │   └── Settings.tsx         # Modes selector, API keys config & database resets
│   ├── App.tsx                  # Global theme controls and routing
│   ├── index.css                # Custom glassmorphism, responsive styles
│   └── main.tsx
├── supabase/
│   ├── functions/
│   │   ├── assistant/           # Edge Function handling Gemini tool execution
│   │   ├── check-reminders/     # Cron scheduler searching due alerts
│   │   └── send-telegram/       # Helper endpoint to post alerts to Telegram
│   ├── schema.sql               # Database DDL initialization (Tables, triggers, RLS)
│   └── seed.sql                 # Seed scripts populating default course catalog
├── .env.example                 # Template for variables
└── README.md
```

---

## ⚙️ Local Setup Instructions

### 1. Frontend Setup
1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` (or `.env.local`):
   ```bash
   cp .env.example .env
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
*Note: By default, the application runs in **Sandbox Simulation Mode** using mock local storage data if Supabase keys are missing.*

### 2. Supabase Backend Setup
1. Create a free project at [supabase.com](https://supabase.com).
2. Execute the DDL script in `supabase/schema.sql` inside the **SQL Editor** of the Supabase dashboard.
3. Run the seed script in `supabase/seed.sql` to populate default courses.
4. Set up your `.env` file with your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### 3. Deploying Supabase Edge Functions
1. Install the Supabase CLI and log in.
2. Set your environment secrets in Supabase (needed by the functions):
   ```bash
   supabase secrets set GEMINI_API_KEY=your-gemini-key
   supabase secrets set TELEGRAM_BOT_TOKEN=your-bot-token
   supabase secrets set TELEGRAM_CHAT_ID=your-group-chat-id
   ```
3. Deploy the Edge Functions:
   ```bash
   supabase functions deploy assistant
   supabase functions deploy check-reminders
   supabase functions deploy send-telegram
   ```
4. *(Optional)* Schedule the reminder check via pg_cron in Supabase:
   ```sql
   select cron.schedule(
     'check-reminders-job',
     '0 */6 * * *', -- runs every 6 hours
     $$ select net.http_post(
          url := 'https://<your-project-id>.supabase.co/functions/v1/check-reminders',
          headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
        ) $$
   );
   ```

---

## 🤖 Telegram Bot Configuration

### 1. Create a Bot
1. Search for `@BotFather` on Telegram.
2. Send `/newbot` and follow the steps.
3. Save the **HTTP API Bot Token** provided (e.g. `5502391204:AAH...`).

### 2. Retrieve Chat ID
1. Create a Telegram group or channel and add your bot to it.
2. Add `@RawDataBot` to the same group.
3. Locate the `id` value under the `chat` object in the JSON payload returned (typically starts with `-100` for groups/channels).
4. Save the Chat ID (e.g. `-1001859382910`). You can now remove `@RawDataBot` from the group.

---

## 💬 CLI Prompt Examples

Test the AI interface by typing or saying:

*   **Create**:
    *   *“Add enquiry for Ramesh Babu, course Full Stack Developer, phone 9876543210, fee shared, notes wants morning batch”*
    *   *“Log a new Academy enquiry for Priya Sharma for NEET Coaching, parental contact”*
*   **Update**:
    *   *“Mark Ramesh as interested and follow up done”*
    *   *“Update Priya: unreachable”*
*   **Filter & Fetch**:
    *   *“Show all unresolved enquiries under Academy”*
    *   *“Get Technologies courses”*
*   **Delete**:
    *   *“Delete Ramesh's enquiry”*
