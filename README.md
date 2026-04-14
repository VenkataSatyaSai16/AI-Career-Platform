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

```bash
cd backend
npm install
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
