# Interview Agent — Admin Panel

Admin page for the Interview Agent: manage the question bank, review candidate
answers, and auto-score them with Claude before finalizing.

## What's included

```
interview-agent/
├── server/
│   ├── server.js          Express API + serves the admin page
│   ├── lib/
│   │   ├── store.js        JSON-file storage (questions.json, answers.json)
│   │   └── aiScore.js       Calls Claude to score an answer
│   ├── data/
│   │   ├── questions.json  Question bank (2 sample questions included)
│   │   └── answers.json    Submitted answers (2 sample answers included)
│   ├── .env.example
│   └── package.json
└── public/
    ├── login.html          Admin login + category picker
    └── admin.html          The admin panel itself (vanilla HTML/CSS/JS)
```

Storage is just JSON files on disk for now — no database setup needed to get
running. Swap `lib/store.js` for a real DB later without touching the routes
or the frontend.

## Setup

```bash
cd server
npm install
cp .env.example .env
# then edit .env: paste your Anthropic API key, and set ADMIN_EMAIL / ADMIN_PASSWORD
npm start
```

Open **http://localhost:4000/login.html**

## How it works

- **Login page** — enter the email/password set in `.env`, and pick a
  category (HTML, Java, Python, or whatever's in the question bank). That
  choice filters both tabs of the admin panel down to that subject. It can
  be changed anytime from the dropdown inside the admin panel without
  logging out. Sessions last 8 hours; **Log out** ends it immediately.
- **Questions tab** — add a question, its category, difficulty, and an
  optional "ideal answer / rubric" note. That rubric is fed to Claude when
  scoring, so the AI knows what a strong answer should cover.
- **Review Answers tab** — every submitted answer shows here linked to its
  question. Click **Run AI score** to have Claude score it 0–10 with
  feedback, strengths, and gaps. You can then edit the final score/notes and
  hit **Confirm review** to lock it in.

## Feeding answers in

The admin page only *reviews* answers — the interview-taking side of your
app should POST answers here as candidates submit them:

```
POST /api/answers
{ "questionId": 1, "candidateName": "Jane Doe", "answerText": "..." }
```

Two sample answers are pre-loaded in `data/answers.json` so you can try the
review flow immediately without wiring that up yet.

## API reference

| Method | Route                       | Purpose                          |
|--------|------------------------------|-----------------------------------|
| POST   | /api/login                    | Log in, returns a session token  |
| POST   | /api/logout                   | Invalidate the current token     |
| GET    | /api/categories                | List distinct question categories (public) |
| GET    | /api/questions               | List questions (requires auth)   |
| POST   | /api/questions                | Add a question                   |
| DELETE | /api/questions/:id            | Delete a question                |
| GET    | /api/answers                  | List answers (with question attached) |
| POST   | /api/answers                  | Submit a candidate answer        |
| POST   | /api/answers/:id/score        | Run AI scoring on an answer      |
| PUT    | /api/answers/:id/review       | Save admin's final score/notes   |

## Notes

- `ANTHROPIC_API_KEY` in `.env` is required for the "Run AI score" button —
  without it the endpoint returns a 500 with a clear error message.
- The model used is `claude-sonnet-5` — change it in `lib/aiScore.js` if you
  want a faster/cheaper option like `claude-haiku-4-5-20251001`.
- Auth is intentionally simple: one fixed admin account from `.env`,
  sessions kept in memory (cleared on server restart). That's fine for a
  personal/local tool, but isn't hardened for production — no password
  hashing, no rate-limiting on login attempts, no HTTPS enforcement. Add
  those before deploying this somewhere public.
