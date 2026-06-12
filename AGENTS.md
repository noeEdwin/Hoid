# Tars - Chinese Language Learning App

## Project Overview

Tars is an immersive Chinese language learning application that combines SRS flashcards, voice-driven roleplay, and precision shadowing drills. The core loop: learn vocabulary via flashcards, then practice them in AI-generated roleplay scenarios that force usage of difficult words/grammar, with real-time tone feedback.

## Architecture

**Monorepo** with two independent applications:

```
tars/
├── backend/          # FastAPI Python server
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── core/         # Config, auth, database setup
│   │   ├── models/       # SQLModel ORM models
│   │   ├── services/     # Business logic (SRS, roleplay, audio)
│   │   └── middleware/    # CORS, logging, etc.
│   └── tests/            # pytest tests
├── mobile/           # React Native Expo app
│   ├── app/              # Expo Router screens
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand state stores
│   └── services/         # API client, audio utils
├── shared/           # Shared assets
│   └── assets/audio/     # Reference audio files for shadowing
├── AGENTS.md         # This file
└── opencode.json     # opencode configuration
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React Native + Expo | Cross-platform mobile UI |
| State | Zustand | Client-side state management |
| Backend | FastAPI (Python) | API server, pipeline controller |
| Database | SQLite via SQLModel | SRS data, flashcards, session logs |
| STT | Groq Whisper | Speech-to-text transcription |
| LLM | DeepSeek-V3 | Roleplay engine, grammar validation |
| TTS | Edge-TTS (primary) / Deepgram (fallback) | Mandarin audio generation |
| Local Audio | Silero VAD + Librosa | Voice detection + pitch analysis |
| Package Mgr | uv (Python) / npm (mobile) | Dependency management |
| Testing | pytest (backend) / Jest (mobile) | Minimal test coverage |

## Key Design Decisions

### Authentication
- **Single-user mode**: No login system. Hardcoded default user profile.
- All data belongs to one local user. No multi-tenancy.

### Audio Pipeline (Hybrid Split)
- **Local (on-device)**: Silero VAD (silence detection), audio recording buffers
- **Backend**: pYIN pitch extraction, DTW alignment, tone scoring
- **Cloud**: STT (Groq), TTS (Edge-TTS/Deepgram), LLM (DeepSeek)

### Offline Strategy
- When network drops: flashcard-only mode with local SRS
- Roleplay and voice features require network
- Graceful degradation, no crashes

### TTS Fallback
- Edge-TTS is default (free, fast, good Mandarin)
- Deepgram as premium fallback (higher quality)
- Backend selects provider based on config/availability

### Shadowing Audio Assets
- Native reference audio files bundled in the app (`shared/assets/audio/`)
- Pre-calculated pitch contours cached in database on ingestion
- Files referenced by path string, not binary blobs

## Database Schema (SQLModel)

### Core Entities

1. **Flashcard** - Vocabulary deck (character, pinyin, meaning, grammar_type)
2. **User_Vocabulary_State** - SRS tracking per card (interval, ease_factor, difficulty_score, failures)
3. **Roleplay_Session** - Conversation session metadata
4. **Chat_Log** - Individual messages (sender, text, timestamp)
5. **Turn_Evaluation** - Per-turn grammar validation results
6. **Shadowing_Media** - Reference audio paths + cached pitch contours
7. **Shadowing_Attempt** - User's pitch match scores over time

### Key Relationships
- Flashcard 1:1 User_Vocabulary_State
- Roleplay_Session 1:N Chat_Log
- Chat_Log 1:N Turn_Evaluation
- Flashcard 1:N Shadowing_Media
- Shadowing_Media 1:N Shadowing_Attempt

### SRS Algorithm
- **Custom difficulty-score-driven** algorithm (not SM-2 or FSRS)
- Difficulty score (0.0-1.0) calculated from: correct/incorrect ratio, response time, consecutive failures
- Top N high-difficulty tokens pulled for roleplay injection
- Progressive introduction rate controlled by `i+1` theory

## Roleplay Engine Pipeline

1. **Select targets**: Pull user's top N high-difficulty flashcards
2. **Generate scenario**: Create context that forces target vocabulary
3. **Enforce constraints**: LLM prompt includes mandatory vocabulary/grammar
4. **Validate response**: Check if user used target structures correctly
5. **Correct in-character**: If validation fails, provide natural correction without breaking immersion
6. **Adaptive scaling**: Adjust scenario complexity based on real-time difficulty metrics

### LLM Prompt Isolation (NFR-2.2)
- System instructions separated from user inputs
- User transcriptions treated as data, never as instructions
- Pipeline controller sanitizes all inputs before LLM calls

## Code Conventions

### Backend (Python)
- Python 3.11+
- Type hints everywhere
- SQLModel for ORM (Pydantic + SQLAlchemy hybrid)
- Async/await for all FastAPI endpoints
- Services layer contains business logic, not route handlers
- No print statements - use `logging` module
- Config via environment variables (pydantic-settings)

### Frontend (React Native)
- TypeScript strict mode
- Expo Router for navigation
- Zustand stores for state (one store per feature domain)
- Components are functional with hooks only
- No class components
- Styles use StyleSheet.create or NativeWind

### General
- No comments unless explaining non-obvious business logic
- Variable/function names must be self-documenting
- Keep functions small and focused (< 50 lines ideal)
- Error handling: explicit try/catch, no silent failures
- All user-facing text in Chinese during active sessions (NFR-2.1)

## Performance Targets

- **Voice loop latency**: < 2.5s end-to-end (STT → LLM → TTS)
- **Local shadowing analysis**: < 300ms after recording ends
- **Chat log persistence**: Immediate write to DB (crash resilience)
- **SRS analytics**: Batched commit on "End Session" only

## Development Commands

### Backend (Python + uv)
- Initialize virtual environment: `uv venv`
- Install dependencies: `uv pip install -r pyproject.toml` o `uv sync`
- Run local server: `uv run uvicorn app.main:app --reload`
- Run backend tests: `uv run pytest`

### Mobile (React Native + Expo)
- Install dependencies: `npm install`
- Start development server: `npx expo start`
- Run iOS emulator: `npm run ios`
- Run Android emulator: `npm run android`
- Run frontend tests: `npm run test`

## Testing Strategy

- **Minimal approach**: Focus on integration tests
- **Backend**: pytest for API endpoints and SRS logic
- **Mobile**: Jest for critical user flows
- No 100% coverage requirement - test what matters
