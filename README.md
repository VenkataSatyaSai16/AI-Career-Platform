<<<<<<< HEAD
# Floating Chatbot Chrome Extension

A Manifest V3 Chrome extension that injects a floating, draggable chatbot into webpages and answers questions using a Groq-backed backend proxy.

## Features

- Floating chatbot launcher on every page
- Draggable and resizable chat window
- Shadow DOM isolation to avoid page CSS conflicts
- Per-tab chat history with sliding context memory
- Page-aware answers using the current webpage content
- Coding responses with structured Markdown and code formatting
- Groq API key kept only in the backend proxy

## Project Structure

```text
project-root/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .gitignore
│   └── .env
├── background.js
├── content/
│   ├── content.js
│   └── content.css
├── manifest.json
├── .gitignore
└── README.md
```

## Setup

### 1. Backend
=======
# AI Interview Agent

A full-stack AI interview application with a separate `backend/` and `frontend/` workspace.

## Structure

```text
ai-interview-agent/
├── backend/
└── frontend/
```

## Features

- Admin login with session support
- Resume upload via pasted text or PDF
- Five-question interview chat flow
- Final report with score, strengths, weaknesses, roadmap, and trends
- Dashboard history for completed sessions

## Backend

The backend lives in [backend](/c:/Users/evenk/OneDrive/Desktop/AI-Interview/backend) and includes:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/resume/upload`
- `POST /api/interview/start`
- `POST /api/interview/next`
- `GET /api/interview/history/:userId`
- `GET /api/interview/report/:sessionId`

### Backend setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill in MongoDB and Gemini keys.
3. Run:
>>>>>>> c59beac (Initial Commit)

```bash
cd backend
npm install
<<<<<<< HEAD
```

Create `backend/.env`:

```env
GROQ_API_KEY=your_secret_key_here
PORT=3000
```

You can copy `backend/.env.example` as a starting point.

Run the proxy server:

```bash
npm start
```

### 2. Chrome Extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the project root folder

If you deploy the backend elsewhere, update `BACKEND_CHAT_URL` in `content/content.js`.

## Notes

- Do not commit API keys.
- Regenerate any Groq key that was previously exposed in the extension.
- Keep the backend proxy and extension in sync with the same message schema.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript
- Shadow DOM
- Node.js
- Express
- Groq Chat Completions API

## Screenshots

Add screenshots here after final UI review.
=======
npm run dev
```

The backend runs on `http://localhost:5000`.

Set `FRONTEND_URL=http://localhost:5173` in `backend/.env` if you are using the default Vite port.

## Frontend

The frontend lives in [frontend](/c:/Users/evenk/OneDrive/Desktop/AI-Interview/frontend) and uses React, React Router, Axios, Tailwind CSS, and Vite.

### Frontend setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start the app:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

If needed, set `VITE_API_BASE_URL` to point at a different backend URL.

## Login

- Username: `admin`
- Password: `1234`

## Notes

- Resume uploads are stored in the server session and also persisted into each completed interview session.
- Completed interviews save the final report in MongoDB so dashboard history can reopen past sessions quickly.
- The backend currently uses MongoDB-backed session storage through `connect-mongo`.
>>>>>>> c59beac (Initial Commit)
