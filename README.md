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
| LLM | OpenAI (gpt-4o-mini) |
| TTS | Edge-TTS |
| Local Audio | Silero VAD + Librosa |

## Project Structure

```
tars/
├── AGENTS.md                 # Full project context, schema, workflows
├── opencode.json             # opencode configuration
├── app/api/CONTRACTS.md      # API endpoint contracts
├── backend/                  # FastAPI server
│   ├── app/
│   │   ├── core/             # Config, database
│   │   ├── models/           # SQLModel entities (9 tables)
│   │   ├── routers/          # API route handlers
│   │   ├── schemas/          # Pydantic request/response models
│   │   └── services/         # Business logic (SRS, STT, TTS)
│   ├── tests/                # pytest test suite
│   └── .env.example          # Config template
├── mobile/                   # React Native Expo app (future)
└── shared/assets/audio/      # Shadowing reference audio
```

## Getting Started

### Prerequisites

- Python 3.14+
- [uv](https://docs.astral.sh/uv/) package manager

### Backend Setup

```bash
# Install dependencies
uv sync

# Copy env and add your API keys
cp backend/.env.example .env

# Run the server
cd backend && uv run uvicorn app.main:app --reload
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Testing

All tests live in `backend/tests/`. Run from the project root:

```bash
# Run all unit tests (fast, no network)
uv run pytest -v

# Skip integration tests (default for CI)
uv run pytest -v -m "not integration"

# Run only integration tests (hits real APIs, requires network + API keys)
uv run pytest -v -m integration

# Run a specific test file
uv run pytest backend/tests/test_stt.py -v

# Run a specific test class
uv run pytest backend/tests/test_stt.py::TestTranscribeAudio -v

# Run with short traceback
uv run pytest -v --tb=short
```

# Android builds:
```
eas build --profile preview --platform android
eas build --profile development --platform android
```

### Test Categories

| Category | Marker | Requires | Description |
|----------|--------|----------|-------------|
| Unit | (none) | Nothing | Mocked, fast, deterministic |
| Integration | `@pytest.mark.integration` | Network + API keys | Hits real Groq/Edge-TTS APIs |

## Documentation

- **[AGENTS.md](./AGENTS.md)** - Architecture, database schema (9 entities), workflows, FRs/NFRs, code conventions
- **[CONTRACTS.md](./app/api/CONTRACTS.md)** - Full API endpoint contracts (REST + WebSocket)
