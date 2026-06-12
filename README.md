# Tars

An immersive Chinese language learning app that combines SRS flashcards, voice-driven roleplay, and precision shadowing drills.

## Core Loop

Learn vocabulary via flashcards, then practice them in AI-generated roleplay scenarios that force usage of difficult words and grammar, with real-time tone feedback.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo |
| State | Zustand |
| Backend | FastAPI (Python 3.14+) |
| Database | SQLite via SQLModel |
| STT | Groq Whisper |
| LLM | DeepSeek-V3 |
| TTS | Edge-TTS / Deepgram |
| Local Audio | Silero VAD + Librosa |

## Project Structure

```
tars/
├── AGENTS.md                 # Full project context, schema, workflows
├── opencode.json             # opencode configuration
├── app/api/CONTRACTS.md      # API endpoint contracts
├── backend/                  # FastAPI server (future)
├── mobile/                   # React Native Expo app (future)
├── shared/assets/audio/      # Shadowing reference audio
└── tests/                    # Integration tests
```

## Getting Started

### Backend

```bash
uv sync
uv run uvicorn app.main:app --reload
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Documentation

- **[AGENTS.md](./AGENTS.md)** - Architecture, database schema (9 entities), workflows, FRs/NFRs, code conventions
- **[CONTRACTS.md](./app/api/CONTRACTS.md)** - Full API endpoint contracts (REST + WebSocket)
