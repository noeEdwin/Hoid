# Tars - Chinese Language Learning App

## Project Overview

Tars is an immersive Chinese language learning application that combines SRS flashcards, voice-driven roleplay, and precision shadowing drills. The core loop: learn vocabulary via flashcards, then practice them in AI-generated roleplay scenarios that force usage of difficult words/grammar, with real-time tone feedback.

## Architecture

**Monorepo** with two independent applications:

```
tars/
├── AGENTS.md                 # This file - project context
├── opencode.json             # opencode configuration
├── README.md                 # Project readme
├── pyproject.toml            # Python project config
├── .gitignore
├── .python-version
├── uv.lock
├── app/
│   └── api/
│       └── CONTRACTS.md      # API endpoint contracts
├── backend/
│   ├── app/                  # FastAPI Python server (future)
│   ├── seed_data/            # HSK starter deck data (future)
│   └── tests/                # pytest tests (future)
├── mobile/                   # React Native Expo app (future)
├── shared/
│   └── assets/
│       └── audio/            # Reference audio for shadowing (future)
└── tests/                    # Integration tests (future)
```

## System Components

| Component | Location | Role |
|-----------|----------|------|
| **Frontend UI** | `mobile/` | React Native Expo. Handles mic input, audio playback, flashcard rendering |
| **Pipeline Controller** | `backend/app/` | Core backend router. Orchestrates data flow, decides module states (dormant/pre-warmed), coordinates AI workers |
| **Audio Analytics Module** | `backend/app/` | pYIN pitch extraction + DTW alignment for shadowing evaluation |
| **Sync Engine** | `backend/app/` + `mobile/` | Manages bidirectional data sync between local and backend SQLite databases |
| **External AI Services** | Cloud APIs | STT (Groq), LLM (DeepSeek-V3), TTS (Edge-TTS/Deepgram) |
| **Local Audio Engine** | `mobile/` | Silero VAD for silence detection, audio recording buffers |
| **Database** | `mobile/` (primary) + `backend/` (mirror) | SQLite via SQLModel. Flashcard review is local-only |

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React Native + Expo | Cross-platform mobile UI |
| State | Zustand | Client-side state management |
| Backend | FastAPI (Python 3.14+) | API server, pipeline controller |
| Database | SQLite via SQLModel | SRS data, flashcards, session logs |
| STT | Groq Whisper | Speech-to-text transcription |
| LLM | DeepSeek-V3 | Roleplay engine, grammar validation |
| TTS | Edge-TTS (primary) / Deepgram (fallback) | Mandarin audio generation |
| Local Audio | Silero VAD + Librosa | Voice detection + pitch analysis |
| Package Mgr | uv (Python) / npm (mobile) | Dependency management |
| Testing | pytest (backend) / Jest (mobile) | Minimal test coverage |

## Key Design Decisions

### Single-User Mode
- No login system. Hardcoded default user profile.
- All data belongs to one local user. No multi-tenancy.

### Hybrid Local/Backend Split
- **Flashcard review is local-only** - runs entirely on device, no backend needed
- **Backend mirrors flashcard DB** - for sync/backup and roleplay/shadowing features
- **Roleplay + Shadowing require backend** - LLM, TTS, and audio analysis run server-side

### Database Sync Strategy
- Two SQLite databases: one on mobile (primary), one on backend (mirror)
- **Mobile-wins conflict resolution** - local changes always overwrite backend
- **Sync timing**: on session end + on app open
- SyncLog tracks what's been synced between devices

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
- Native reference audio files bundled in both mobile and backend (`shared/assets/audio/`)
- Pre-calculated pitch contours cached in database on ingestion
- Files referenced by path string, not binary blobs

### Hint Delivery
- Hints delivered via WebSocket events during active roleplay sessions
- Client sends `{"event_type": "request_hint"}`, server responds with `hint_response`

### Scenario Source
- Pre-defined roleplay scenarios stored in database
- User selects from list, not AI-generated on the fly

## Database Schema (SQLModel)

### Entity 1: Flashcard (Core Vocabulary Repository)

Primary lexicon deck. Holds core dictionary definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `character` | VARCHAR | indexed | Chinese hanzi (e.g., "得", "咖啡") |
| `pinyin` | VARCHAR | | Dictionary pronunciation (e.g., "de", "kāfēi") |
| `meaning` | TEXT | | English translation or grammatical definition |
| `grammar_type` | VARCHAR | indexed | Category: "particle", "verb", "noun", "adjective", etc. |
| `created_at` | TIMESTAMP | | Creation timestamp |

### Entity 2: User_Vocabulary_State (Mastery Tracker)

Known Vocabulary Profile and Difficulty Matrix. Tracks personal computational memory loop per card.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `flashcard_id` | UUID | FK -> Flashcard.id, unique, indexed | One state per card |
| `srs_interval` | INTEGER | default 0 | Days until next review |
| `ease_factor` | FLOAT | default 2.5 | Internal SRS spacing modifier |
| `total_reviews` | INTEGER | default 0 | Total interactions with this card |
| `total_failures` | INTEGER | default 0 | Total misses or failed constraints |
| `difficulty_score` | FLOAT | default 0.0, indexed | 0.0-1.0 difficulty rating |

### Entity 3: Scenario (Roleplay Contexts)

Pre-defined roleplay scenario templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `title` | VARCHAR | indexed | Scenario name (e.g., "Ordering Food") |
| `description` | TEXT | | Scene context for LLM |
| `difficulty` | VARCHAR | indexed | "beginner", "intermediate", "advanced" |
| `target_grammar` | TEXT | | JSON array of grammar tokens (e.g., '["把", "了", "要"]') |
| `example_prompt` | VARCHAR | optional | Opening line for the scenario |
| `created_at` | TIMESTAMP | | Creation timestamp |

### Entity 4: Roleplay_Session (Conversation Hub)

Tracks every roleplay session instance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `scenario_id` | UUID | FK -> Scenario.id, indexed | Linked scenario |
| `started_at` | TIMESTAMP | | Session start time |
| `ended_at` | TIMESTAMP | nullable | Session end time |

### Entity 5: Chat_Log (Interaction Feed)

Line-by-line message saves. Crash-resilient session memory.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `session_id` | UUID | FK -> Roleplay_Session.id, indexed | Parent session |
| `timestamp` | TIMESTAMP | | Message timestamp |
| `sender` | VARCHAR | | "user" or "tars" |
| `text_content` | TEXT | | Chinese message string |

### Entity 6: Turn_Evaluation (Grammar Validation Log)

Per-turn validation analytics for grammar constraint checking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `chat_log_id` | UUID | FK -> Chat_Log.id, indexed | Parent chat message |
| `target_flashcard_id` | UUID | FK -> Flashcard.id, indexed | Forced token for this turn |
| `grammar_passed` | BOOLEAN | | Did user use target structure correctly? |

### Entity 7: Shadowing_Media (Reference Audio)

Native reference audio paths and cached pitch contours.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `flashcard_id` | UUID | FK -> Flashcard.id, indexed | Linked vocabulary card |
| `audio_file_path` | VARCHAR | | Path to native audio file |
| `native_pitch_contour` | TEXT | | JSON array of pre-calculated pitch floats |

### Entity 8: Shadowing_Attempt (Phonetic Score Log)

User's pitch match scores over time using DTW alignment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `shadowing_media_id` | UUID | FK -> Shadowing_Media.id, indexed | Reference audio |
| `pitch_match_score` | FLOAT | | 0.0-1.0 similarity score |
| `user_pitch_curve` | TEXT | nullable | JSON array of user's pitch values |
| `completed_at` | TIMESTAMP | | Attempt timestamp |

### Entity 9: SyncLog (Sync Tracker)

Tracks synchronization between mobile and backend databases.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |
| `direction` | VARCHAR | | "push" or "pull" |
| `synced_at` | TIMESTAMP | | Sync timestamp |
| `flashcards_upserted` | INTEGER | default 0 | Number of flashcards synced |
| `states_upserted` | INTEGER | default 0 | Number of vocabulary states synced |
| `last_sync_at` | TIMESTAMP | nullable | Client's timestamp before this sync |

### Entity Relationships

```
Flashcard 1:1 User_Vocabulary_State
Flashcard 1:N Shadowing_Media
Flashcard 1:N Turn_Evaluation (via target_flashcard_id)

Roleplay_Session 1:N Chat_Log
Roleplay_Session N:1 Scenario

Chat_Log 1:N Turn_Evaluation

Shadowing_Media 1:N Shadowing_Attempt
```

### SRS Algorithm

- **Custom difficulty-score-driven** algorithm (not SM-2 or FSRS)
- Difficulty score (0.0-1.0) calculated from: correct/incorrect ratio, response time, consecutive failures
- Top N high-difficulty tokens pulled for roleplay injection
- Progressive introduction rate controlled by `i+1` theory

## Workflows

### Workflow A: Flashcard Review (Local, Data-Intensive)

```mermaid
flowchart TD
    UI[Frontend UI] -->|User answers card| PC[Pipeline Controller]
    PC -->|Run SRS Algorithm| DB[(Local Database)]
    DB -->|Update Difficulty + Known Vocab Matrix| DB
    DB -->|Return next card| UI
```

1. User marks card as "easy", "good", or "hard" on Frontend UI
2. Pipeline Controller calculates new interval and difficulty metrics locally
3. Metrics written immediately to Local Database (crash resilience)
4. Next scheduled card pulled from database, screen updates
5. Entire process takes < 10ms

### Workflow B.1: Roleplay Session (Fluency + Grammar)

```mermaid
flowchart TD
    UI[Frontend UI] -->|Start session| PC[Pipeline Controller]
    PC -->|Pull top N difficult tokens| DB[(Local Database)]
    PC -->|Generate scenario + constraints| LLM[DeepSeek-V3]
    LLM -->|Initial greeting + TTS| TTS[Edge-TTS]
    TTS -->|Audio + text| UI
    UI -->|User speaks| VAD[Silero VAD - local]
    VAD -->|Audio chunk| STT[Groq Whisper]
    STT -->|Transcription| PC
    PC -->|Validate grammar + generate reply| LLM
    LLM -->|Reply + TTS| UI
```

1. Client sends start request with scenario_id
2. Pipeline Controller pulls top N high-difficulty flashcards from DB
3. LLM generates scenario context with forced vocabulary constraints
4. TTS generates initial greeting audio
5. User speaks -> VAD detects end of speech locally
6. Audio sent to Groq for STT transcription
7. Transcription + constraints sent to DeepSeek for grammar validation + reply
8. If grammar fails: in-character correction (FR-4.5)
9. If repeated failures: difficulty downgraded in real-time (FR-5.3)
10. User can request hint via WebSocket event (FR-4.6)
11. On session end: batched analytics committed to DB

### Workflow B.2: Shadowing Drill (Phonetic Precision)

```mermaid
flowchart TD
    UI[Frontend UI] -->|Select drill| PC[Pipeline Controller]
    PC -->|Query high-difficulty cards + media| DB[(Local Database)]
    DB -->|Return reference audio path| UI
    UI -->|Play native audio| UI
    UI -->|Record user audio| Audio[Audio Analytics Module]
    Audio -->|pYIN + DTW analysis| DB
    DB -->|Return pitch curves + score| UI
    UI -->|Visual pitch overlay| UI
```

1. UI shows recommendations: high-difficulty cards mapped to shadowing media
2. User selects a drill, native reference audio plays
3. User records their attempt
4. Audio Analytics Module runs pYIN pitch extraction + DTW alignment on backend
5. Pitch match score (0.0-1.0) and both curves returned
6. UI renders visual overlay comparing user vs native pitch contour

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

## Functional Requirements Summary

| ID | Requirement | Module |
|----|-------------|--------|
| FR-2.1 | CRUD vocabulary deck | Flashcards |
| FR-2.2 | Difficulty Analytics Engine | SRS |
| FR-2.3 | Identify top N failing tokens | SRS |
| FR-3.1 | Speech-to-Text (Groq Whisper) | Voice |
| FR-3.2 | Text-to-Speech (Edge-TTS/Deepgram) | Voice |
| FR-4.1 | Targeted injection of difficult tokens | Roleplay |
| FR-4.2 | Pre-defined scenario generation | Roleplay |
| FR-4.3 | Mandarin-only enforcement | Roleplay |
| FR-4.4 | Grammar constraint validation | Roleplay |
| FR-4.5 | In-character correction | Roleplay |
| FR-4.6 | Proactive scaffolding hints (WebSocket) | Roleplay |
| FR-4.7 | Adaptive scenario scaling | Roleplay |
| FR-5.1 | Known-Vocabulary Ceiling | Progression |
| FR-5.2 | Progressive comprehensible input (i+1) | Progression |
| FR-5.3 | Dynamic correction handling | Progression |
| FR-6.1 | Asset path management (file pointers) | Shadowing |
| FR-6.2 | Pre-calculated reference contours | Shadowing |
| FR-6.3 | Phonetic drill selection | Shadowing |
| FR-6.4 | DTW alignment (Librosa) | Shadowing |
| FR-6.5 | Visual pitch feedback | Shadowing |

## Non-Functional Requirements Summary

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | Voice loop latency | < 2.5s end-to-end |
| NFR-1.2 | Local shadowing analysis | < 300ms |
| NFR-2.1 | Monolingual lock (Mandarin only) | Active sessions |
| NFR-2.2 | Prompt isolation | All LLM calls |
| NFR-3.1 | Immediate chat log writes | Crash resilience |
| NFR-3.1 | Batched SRS analytics | End session only |
| NFR-3.2 | Voice mode pre-warming | Before mic engage |
| NFR-3.3 | Offline fallback | Flashcard-only mode |

## Code Conventions

### Backend (Python)
- Python 3.14+
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

- **Voice loop latency**: < 2.5s end-to-end (STT -> LLM -> TTS)
- **Local shadowing analysis**: < 300ms after recording ends
- **Chat log persistence**: Immediate write to DB (crash resilience)
- **SRS analytics**: Batched commit on "End Session" only
- **Flashcard review**: < 10ms per card (local only)

## Development Commands

### Backend (Python + uv)
- Initialize virtual environment: `uv venv`
- Install dependencies: `uv sync`
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
