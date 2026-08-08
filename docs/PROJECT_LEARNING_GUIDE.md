# Tars Project Learning Guide

This document is a map of the project as it exists on August 1, 2026, plus a curriculum for learning to own it. It intentionally describes the current working tree, including the roleplay and scenario code that is not yet committed. It does not treat `README.md` or `AGENTS.md` as proof that a feature exists.

Your goal is not to memorize every file. Your goal is to be able to answer four questions whenever you change Tars:

1. Where does the data originate?
2. Which layer owns each decision?
3. What is persisted, and what disappears after a restart?
4. How will you prove the behavior works?

## 1. What Tars Is

Tars is a single-user Chinese learning application with three intended learning modes:

- **Flashcards:** local-first cloze-deletion cards with spaced repetition.
- **Roleplay:** spoken conversations that select difficult vocabulary and ask the learner to produce it.
- **Shadowing:** pronunciation practice against a native pitch contour.

Only the first two are currently usable. Shadowing has backend database models and a mobile placeholder, but no analysis pipeline, API, or working screen.

The central product loop is intended to be:

```text
Learn a card locally
        |
        v
Record review performance
        |
        v
Sync difficulty to backend
        |
        v
Select difficult words for roleplay
        |
        v
Measure production failures
        |
        v
Practice pronunciation through shadowing (not implemented)
```

## 2. Reality Check

### Working or substantially implemented

- Local mobile deck and flashcard CRUD
- JSON card import
- Local SQLite persistence through Drizzle
- Local SRS review and practice-only review
- Drill/relearning mode and resumable review sessions
- Pending review queue for offline use
- Manual bidirectional synchronization
- Backend deck, flashcard, review, and vocabulary APIs
- Edge-TTS generation and mobile speech fallback
- Scenario listing, authoring, editing, archiving, and recommendations
- Roleplay target selection
- Voice recording, Groq transcription, OpenAI response generation, and Edge-TTS playback
- Roleplay hints, turn logs, evaluations, and session summaries
- Backend pytest and mobile Jest suites

### Partially implemented or different from the vision

- Sync exists, but app-open and review-completion sync triggers do not.
- Sync uses last-write-wins timestamps, but deletion is not synchronized.
- Roleplay uses WebSockets, but each recording and response is processed as a complete unit.
- Roleplay target validation is mostly substring matching, not grammar validation.
- Roleplay runtime state is held in one process's memory.
- OpenAI is used instead of the DeepSeek model mentioned in older documentation.
- Edge-TTS works, but the configured provider switch and Deepgram fallback do not.
- Review audio plays after answering or on request, not automatically when a card first appears.
- Database migrations exist, but they are hand-written startup migrations rather than a migration framework.

### Not implemented

- Shadowing API and mobile experience
- pYIN pitch extraction
- Pitch normalization and Dynamic Time Warping scoring
- Pitch comparison graph
- Silero voice activity detection
- Incremental STT, LLM, and TTS streaming
- Recoverable roleplay sessions after a backend restart
- Deletion tombstones for sync
- CI, linting, formal type-check scripts, and automated contract-drift checks

## 3. Repository Map

```text
tars/
├── AGENTS.md                         Product vision and conventions; partly stale
├── README.md                         Setup summary; substantially stale
├── PROJECT_LEARNING_GUIDE.md         This document
├── pyproject.toml                    Python dependencies and pytest configuration
├── uv.lock                           Locked Python dependencies
├── backend/
│   ├── CONTRACTS.md                  API contract; partly stale
│   ├── tars.db                       Current development database
│   ├── app/
│   │   ├── main.py                   FastAPI construction and startup
│   │   ├── core/                     Configuration and database setup
│   │   ├── models/                   SQLModel database tables
│   │   ├── schemas/                  API request and response types
│   │   ├── routers/                  HTTP and WebSocket transport layer
│   │   ├── services/                 Business logic and external integrations
│   │   └── templates/                Browser roleplay test page
│   ├── seed_data/                    Starter and HSK JSON data
│   ├── scripts/                      Data cleanup utilities
│   └── tests/                        Backend tests
└── mobile/
    ├── app/                          Expo Router screens and layouts
    ├── components/                   Reusable visual components
    ├── stores/                       Zustand feature stores
    ├── lib/                          DB, API, sync, SRS, socket, and audio code
    ├── assets/                       Mobile static assets
    ├── package.json                  JavaScript dependencies and commands
    └── app.config.js                 Expo and API configuration
```

### Files to learn first

| File | Why it matters |
|---|---|
| `mobile/app/_layout.tsx` | Defines the root navigation stack and startup settings load. |
| `mobile/app/(tabs)/index.tsx` | Dashboard and manual sync entry point. |
| `mobile/app/deck/[id].tsx` | Deck management and review launch flow. |
| `mobile/app/review.tsx` | Review UI and answer handling. |
| `mobile/stores/useReviewStore.ts` | Review state machine and local scheduling orchestration. |
| `mobile/lib/database.ts` | Local database initialization, migrations, CRUD, and review queries. |
| `mobile/lib/srs.ts` | Mobile scheduling calculations. |
| `mobile/lib/sync.ts` | Mobile push/pull orchestration. |
| `mobile/lib/api.ts` | REST API boundary and data shapes. |
| `backend/app/main.py` | Backend startup and router registration. |
| `backend/app/models/flashcard.py` | Server-side flashcard and SRS persistence. |
| `backend/app/routers/flashcards.py` | Deck, card, and review HTTP endpoints. |
| `backend/app/routers/sync.py` | Server-side sync conflict and idempotency behavior. |
| `backend/app/services/srs.py` | Backend scheduling policy. |
| `backend/app/routers/roleplay.py` | Scenario REST APIs and roleplay WebSocket flow. |
| `backend/app/services/roleplay_targets.py` | Difficult-word selection. |
| `backend/app/services/session_store.py` | Volatile active-session state. |

## 4. Architectural Boundaries

### Mobile application

The mobile app is the primary owner of flashcard data and review behavior. It must continue working when the backend is unavailable.

The mobile layers are currently pragmatic rather than strict:

```text
Expo Router screen
      |
      v
Zustand store
      |
      +-------------> Expo SQLite / filesystem
      |
      +-------------> REST API / WebSocket
```

Screens render UI and invoke store actions. Stores often coordinate database calls, API calls, filesystem operations, and state changes directly. `mobile/lib/` contains reusable infrastructure and policy functions.

This means a store is more than a state container in Tars. It is often the feature's application-service layer. Do not add another abstraction automatically; introduce one only when it creates a clear boundary or removes real duplication.

### Backend application

The intended backend dependency direction is:

```text
Router -> Schema -> Service -> Model/database
                     |
                     v
              External provider
```

- **Routers** translate HTTP or WebSocket input into application calls and responses.
- **Schemas** validate transport data.
- **Services** contain scheduling, target selection, AI, STT, and TTS logic.
- **Models** define persisted SQLModel tables.
- **Core** initializes settings and database connections.

Some route handlers still contain significant orchestration and database work. Treat the diagram as a design direction, not a perfectly enforced fact.

### Persistence boundaries

| Data | Primary location | Mirror or secondary location | Offline? |
|---|---|---|---|
| Decks and flashcards | Mobile SQLite | Backend SQLite | Yes |
| SRS vocabulary state | Mobile SQLite | Backend SQLite | Yes |
| Pending reviews | Mobile SQLite | Applied and deduplicated by backend | Yes |
| Settings and daily history | Mobile JSON files | None | Yes |
| Resumable review sessions | Mobile JSON files | None | Yes |
| Card audio | Mobile filesystem | Path string may be synced | Playback is local |
| Scenarios | Backend SQLite | None on mobile | No |
| Roleplay sessions and chat | Backend SQLite | UI state on mobile | No |
| Active roleplay runtime state | Backend process memory | None | No; lost on restart |
| Shadowing attempts | Backend models only | Not used | No feature yet |

## 5. Core Data Model

### Mobile tables

The mobile app has four tables in `mobile/lib/schema.ts`:

- `deck`
- `flashcard`
- `user_vocabulary_state`
- `pending_review`

Every locally created flashcard also gets a vocabulary-state row. This matters because due-card queries use an inner join: a card without a state can disappear from review selection.

### Backend tables

The backend contains these domains:

- Flashcards: `Deck`, `Flashcard`, `UserVocabularyState`
- Sync: `SyncLog`, `ProcessedReview`
- Scenarios: `Scenario`
- Roleplay: `RoleplaySession`, `RoleplaySessionTarget`, `RoleplayVocabularyState`, `ChatLog`, `TurnEvaluation`
- Shadowing: `ShadowingMedia`, `ShadowingAttempt`

The backend does not persist a `PendingReview` table. It receives events from mobile, applies them, and records their IDs in `ProcessedReview` so retries do not apply the same event twice.

### Two kinds of difficulty

Tars has two related but separate ideas:

- **Recognition difficulty:** stored in `UserVocabularyState`, based on flashcard review.
- **Production difficulty:** stored in `RoleplayVocabularyState`, based on using words in conversation.

Roleplay target selection combines these signals. Roleplay performance intentionally does not directly reschedule flashcard reviews.

## 6. Trace the Main Flows

### Flow A: App startup

1. Expo Router enters `mobile/app/_layout.tsx`.
2. `useSettingsStore.loadSettings()` starts in an effect.
3. The root stack renders immediately; it does not wait for settings hydration.
4. SQLite is initialized lazily when the first database function calls `getDb()`.
5. The dashboard loads local data when focused.
6. No automatic startup sync runs.

Important consequence: an early screen can briefly use default settings before persisted settings finish loading.

### Flow B: Create a flashcard

1. The user opens `mobile/app/modal/create-flashcard.tsx`.
2. `useDeckDetailStore` creates the card in local SQLite.
3. `createFlashcard()` also creates its vocabulary-state row.
4. The store requests audio from `POST /api/tts` when possible.
5. MP3 bytes are saved under the device document directory.
6. The local card's `audioPath` is updated.
7. If TTS fails, the card remains usable through `expo-speech` fallback.

Important consequence: editing sentence content does not currently regenerate or invalidate old audio.

### Flow C: Review a card offline

1. A deck screen navigates to `/review` with a deck ID and mode.
2. `useReviewStore.loadQueue()` reads the remaining daily limit.
3. `getDueCards()` queries local SQLite.
4. The store applies a difficulty-biased shuffle.
5. The user enters the missing Hanzi.
6. The review screen normalizes and compares the answer.
7. `submitAnswer()` updates the local vocabulary state.
8. A `pending_review` event is inserted.
9. Retry, drill, or completion behavior updates the Zustand queue.
10. The session is saved to a JSON file so it can be resumed.

The backend is not involved in this loop. That is intentional.

### Flow D: Synchronize

1. The dashboard or a roleplay preparation action calls `syncAll()`.
2. The mobile client deduplicates local records.
3. It pushes changed decks, cards, vocabulary states, and pending reviews.
4. The backend uses timestamps for last-write-wins updates.
5. The backend maps duplicate card IDs to canonical IDs.
6. Pending reviews are applied once using `ProcessedReview` IDs.
7. Mobile removes only acknowledged pending-review IDs.
8. Mobile pulls records changed since its last synchronization timestamp.
9. Pulled decks are applied before cards, then vocabulary states.
10. The new server timestamp is saved in mobile settings.

Important consequence: deleting a local row produces no event. A backend copy can survive and return on a later pull.

### Flow E: Complete one roleplay turn

1. Mobile pushes learning state so target selection sees recent data.
2. The backend selects up to three difficult or scenario-relevant targets.
3. `POST /api/roleplay/start` persists a session and target snapshots.
4. Runtime conversation state is added to the in-memory session store.
5. OpenAI generates the greeting and Edge-TTS generates its audio.
6. Mobile enters the session screen and opens a WebSocket.
7. The user manually starts and stops a complete recording.
8. Mobile sends base64 audio in a JSON WebSocket event.
9. Groq Whisper returns a complete transcript.
10. The user chat log is saved immediately.
11. Target use is checked, mainly with substring membership.
12. OpenAI produces the complete reply.
13. The Tars chat log is saved and Edge-TTS produces complete audio.
14. One response event returns text, pinyin, evaluation, and base64 audio.
15. Mobile updates Zustand, renders chat, and plays the audio.

This is WebSocket transport, but not incremental streaming.

## 7. Known Risks Worth Learning From

These are not reasons to rewrite the project. They are opportunities to understand tradeoffs and practice targeted improvements.

1. **Deletion does not sync.** A local delete is not represented as durable data.
2. **Audio paths are not portable.** A `file://` path valid on one phone is meaningless elsewhere.
3. **SRS policy is duplicated.** Mobile schedules reviews immediately; backend replays pending reviews with related but not guaranteed identical logic.
4. **Migrations are fragile.** Both applications use hand-written migration paths.
5. **Roleplay state is volatile.** A restart or multiple workers can lose or split active sessions.
6. **Roleplay latency is serial.** Full upload, STT, LLM, and TTS happen one after another.
7. **Grammar validation is overstated.** Token occurrence is not grammatical correctness.
8. **Settings hydration is not gated.** UI can initially use defaults.
9. **Review metrics are misleading.** Retries can make progress exceed 100% and distort accuracy.
10. **Documentation is stale.** Planned architecture and actual behavior disagree.
11. **Runtime artifacts are tracked.** Databases, backups, and generated audio complicate reproducibility and Git history.
12. **Shadowing is only a skeleton.** Models alone do not make a feature.

## 8. How to Run and Inspect Tars

### Backend

From the repository root:

```bash
uv sync
cp backend/.env.example .env
```

Add API keys to `.env` when testing AI features. Then run from `backend/` because the default SQLite path is working-directory-sensitive:

```bash
uv run python run.py --reload
```

The backend is local-only in this phase: it binds to `127.0.0.1` by default
and rejects all non-loopback `HOST` values. Remote access and private
authenticated infrastructure are deferred to a separate task.

Useful endpoints:

- `http://localhost:8000/health`
- `http://localhost:8000/docs`
- `http://localhost:8000/test`

Run unit tests from the repository root:

```bash
uv run pytest -v -m "not integration"
```

### Mobile

From `mobile/`:

```bash
npm install
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 npm start
```

Physical-device backend access is deferred until private authenticated
infrastructure is implemented.

Run mobile tests:

```bash
npm test -- --runInBand
```

Do not run integration tests that call paid or external services until you know which environment variables they require.

## 9. Learning Contract

The curriculum is optimized for independent ownership, not for producing the maximum amount of code.

### Rules for using AI

For each challenge:

1. Read the relevant files yourself.
2. Write a short prediction of the current behavior.
3. Describe your proposed change before editing.
4. Make one honest implementation attempt.
5. Run the narrowest useful tests.
6. Ask AI for Socratic questions or Hint 1 only.
7. Request stronger hints only after recording what blocked you.
8. Ask for generated code only after you can explain your failed attempt.

Use this prompt when asking for help:

```text
Do not write the solution yet. Ask me questions that reveal whether I understand
the data flow, ownership boundary, edge cases, and test strategy. Then give only
the smallest next hint.
```

### Challenge journal

Keep one entry per challenge. It can be a private file outside Git.

```markdown
## Challenge name

### Prediction
What I think the code currently does.

### Trace
The files and functions involved, in execution order.

### Design
What I will change and what I will deliberately not change.

### Failure
What surprised me or failed.

### Proof
Tests, manual checks, and observed output.

### Explanation
How I would teach this feature to another developer.
```

### Definition of done

A challenge is complete only when all are true:

- The requested behavior works.
- Existing behavior is not unintentionally changed.
- Relevant tests pass.
- A regression test exists when practical.
- You can trace the behavior from input to persistence and back to UI.
- You can explain why the change belongs in the chosen layer.
- You can name at least one rejected alternative and its tradeoff.

## 10. Twelve-Week Curriculum

Spend 2-4 hours per week. If a challenge takes longer, continue it the next week. The calendar is guidance, not a deadline.

### Week 1: Build a runtime map

**Objective:** Run both applications and replace vague familiarity with an observed system map.

**Starting files:**

- `README.md`
- `mobile/app/_layout.tsx`
- `mobile/app/(tabs)/_layout.tsx`
- `backend/app/main.py`
- `backend/app/core/config.py`

**Task:**

Run the backend, open `/docs`, run the mobile app, and navigate every reachable screen. Draw the route tree and list which screens still work when the backend is stopped.

**Acceptance criteria:**

- You can list every mobile route and how it is reached.
- You can list every backend router prefix.
- You identify local-only, network-required, and placeholder screens.
- You record at least three differences between documentation and reality.

**Tests:** No new automated test is required. Run both non-integration suites to establish a baseline.

**Explain before moving on:**

- Why does flashcard review work with the backend stopped?
- Why does the progress screen not have the same guarantee?
- When is mobile SQLite initialized?
- What does the FastAPI lifespan function do?

**Hints:**

1. Start with file-based routes under `mobile/app/`.
2. Search `app.include_router` to find backend registration.
3. Search for `api.` calls and `syncAll()` in screens and stores to classify network dependencies.

### Week 2: Trace one deck to the screen

**Objective:** Understand React Native data flow without making a large change.

**Starting files:**

- `mobile/lib/database.ts`
- `mobile/stores/useVocabularyStore.ts`
- `mobile/app/(tabs)/index.tsx`
- `mobile/components/DeckCarousel.tsx`
- `mobile/components/DeckCard.tsx`

**Task:**

Trace one deck row from SQLite to its rendered carousel card. Add a small, useful deck-card detail using data already available, such as a clear singular/plural card-count label or a visual indication for an empty deck.

**Constraints:**

- Do not add a new store.
- Do not add a backend request.
- Keep business decisions out of the presentation component when they depend on database state.

**Acceptance criteria:**

- The detail renders correctly for zero, one, and multiple cards.
- Existing navigation still works.
- A focused component or store test covers the behavior.

**Explain before moving on:**

- What causes the dashboard to reload after returning from a deck?
- Which state belongs to Zustand and which arrives through props?
- Why is this feature local-first?

**Hints:**

1. Find the type passed from `DeckCarousel` to `DeckCard`.
2. Check whether the needed value is already loaded before changing a query.
3. Prefer a pure rendering test if no data behavior changes.

### Week 3: Add a persisted presentation setting

**Objective:** Learn Zustand, filesystem persistence, hydration, and settings UI together.

**Starting files:**

- `mobile/stores/useSettingsStore.ts`
- `mobile/app/(tabs)/settings.tsx`
- `mobile/app/_layout.tsx`
- Settings store tests

**Task:**

Add a setting that hides or shows pinyin on flashcard review before the answer is submitted. Choose a sensible default and make the setting survive an app restart.

**Constraints:**

- Persist it in the existing settings file.
- Existing settings files without the field must still load.
- Do not put filesystem calls in the review screen.

**Acceptance criteria:**

- The setting can be changed from the settings screen.
- Review UI responds to it.
- The value is persisted and restored.
- Tests cover default, update, and loading an older settings object.

**Explain before moving on:**

- How does Zustand allow access both from React and outside React?
- What happens if the review screen renders before settings load?
- Why is a missing JSON field a compatibility concern?

**Hints:**

1. Follow `dailyReviewLimit` through initial state, loading, writing, and UI.
2. Match the existing store pattern rather than creating a second file.
3. If hydration causes visible incorrect state, first describe the smallest way to represent “not loaded.”

### Week 4: Repair review progress semantics

**Objective:** Modify a state machine safely and define product metrics precisely.

**Starting files:**

- `mobile/stores/useReviewStore.ts`
- `mobile/components/ProgressBar.tsx`
- `mobile/app/review.tsx`
- Review store and component tests

**Task:**

Prevent the progress bar from exceeding 100% during retries. Decide whether progress means unique cards resolved or answer presentations completed, document the decision in the test names, and make the completion statistics internally consistent.

**Constraints:**

- Do not merely clamp a misleading value unless you can justify that as the intended metric.
- Cover normal, failed, retry, and drill-mode paths.
- Keep practice mode behavior explicit.

**Acceptance criteria:**

- Progress is monotonic and between 0% and 100%.
- The numerator and denominator have clear meanings.
- Accuracy has a documented interpretation.
- Existing retry scheduling still works.

**Explain before moving on:**

- Why can `answeredCount` exceed the initial card count?
- Which collections represent queue state versus final outcomes?
- What invariants should hold when `isComplete` becomes true?

**Hints:**

1. Write examples on paper for two cards where one fails twice.
2. Inspect `getProgress()` after tracing every place that increments `answeredCount`.
3. Separate “session progress” from “attempt accuracy” if one formula cannot represent both.

### Week 5: Harden a backend endpoint

**Objective:** Practice the router-schema-model boundary with a small backend change.

**Starting files:**

- `backend/app/routers/flashcards.py`
- `backend/app/schemas/review.py`
- `backend/app/models/flashcard.py`
- `backend/tests/test_review.py`
- `backend/tests/test_flashcards.py`

**Task:**

Make review submission reject a missing flashcard cleanly and reject a request whose body `flashcard_id` does not match the path ID.

**Acceptance criteria:**

- Missing resources return a deliberate HTTP error, not a database exception.
- Path/body mismatch has a deterministic status and message.
- Successful review behavior is unchanged.
- Tests cover both failures and the happy path.

**Explain before moving on:**

- Why is the ID duplicated in the current API?
- What validation belongs to Pydantic and what requires a database query?
- When does the SQLModel session commit or roll back?

**Hints:**

1. Read the request schema before changing the router.
2. Validate cheap structural conditions before querying.
3. Follow existing `HTTPException` conventions unless deliberately standardizing all errors.

### Week 6: Reconcile the two SRS implementations

**Objective:** Understand why offline systems duplicate decisions and where divergence becomes dangerous.

**Starting files:**

- `mobile/lib/srs.ts`
- `mobile/stores/useReviewStore.ts`
- `backend/app/services/srs.py`
- `backend/app/routers/sync.py`
- SRS and sync tests on both sides

**Task:**

Create a comparison table for at least eight review cases: new/correct, mature/correct, fast/slow, and one/two/three failures. Identify actual divergences. Then choose one small divergence, define the desired behavior, and align both implementations with tests.

**Constraints:**

- Do not redesign the algorithm in this challenge.
- Freeze time or pass explicit timestamps where scheduling dates are asserted.
- Treat pending review replay as an idempotency problem as well as an SRS problem.

**Acceptance criteria:**

- The comparison table is committed to your challenge journal or a test comment only if useful.
- Both sides agree on the selected behavior.
- Existing schedules are not broadly changed by accident.

**Explain before moving on:**

- Why does mobile update SRS before the backend sees the review?
- Why might applying both a state snapshot and an event double-count progress?
- What does `ProcessedReview` protect against?
- Which system is authoritative when state and events disagree?

**Hints:**

1. Start from one concrete state object rather than reading formulas abstractly.
2. Trace the sync order: vocabulary snapshots and pending review events are not the same thing.
3. Look for parameters accepted by a function but not used in its calculation.

### Week 7: Add an automatic sync trigger safely

**Objective:** Build a small cross-cutting feature with lifecycle and offline behavior.

**Starting files:**

- `mobile/app/_layout.tsx`
- `mobile/app/review.tsx`
- `mobile/lib/sync.ts`
- `mobile/stores/useSettingsStore.ts`

**Task:**

Implement one documented missing trigger: sync on app open or sync after an SRS review session completes. Choose one, explain why, and make failure non-blocking.

**Constraints:**

- Do not start duplicate concurrent syncs.
- Do not prevent offline flashcard use.
- Do not show repeated intrusive errors during normal offline use.
- Preserve the manual sync action.

**Acceptance criteria:**

- The trigger runs once at the intended lifecycle point.
- Network failure does not crash or block navigation.
- Existing singleton sync suppression is respected.
- Tests prove invocation and failure handling at the narrowest practical layer.

**Explain before moving on:**

- What makes an effect safe or unsafe to rerun?
- Why does `syncAll()` suppress concurrent work?
- Which failures should be visible to the user?

**Hints:**

1. First define the exact event called “app open” or “session complete.”
2. Read the return type of `syncAll()` before designing UI handling.
3. Prefer an existing lifecycle boundary over adding a global event system.

### Week 8: Fix stale flashcard audio

**Objective:** Follow one value through UI, API, filesystem, database, and fallback behavior.

**Starting files:**

- `mobile/app/modal/create-flashcard.tsx`
- `mobile/stores/useDeckDetailStore.ts`
- `mobile/lib/database.ts`
- `mobile/app/review.tsx`
- `backend/app/routers/tts.py`

**Task:**

When speech-relevant flashcard content changes, prevent the old MP3 from being played. Decide whether to regenerate immediately, invalidate and regenerate lazily, or invalidate and use speech fallback.

**Constraints:**

- Do not delete the old file before you understand failure behavior.
- Editing metadata that does not affect speech should not trigger TTS.
- Offline editing must remain possible.

**Acceptance criteria:**

- Old audio is never presented as if it matches edited text.
- TTS failure leaves the card usable.
- Orphaned files are handled or explicitly documented.
- Tests cover speech-changing and metadata-only edits.

**Explain before moving on:**

- What exactly is the text sent to TTS?
- Is `audioPath` a database identity, a local cache reference, or portable content?
- What happens when that path is synchronized to another device?

**Hints:**

1. Write down which card fields influence spoken text.
2. Find the separate database functions for content update and audio-path update.
3. Design the failure path before the success path.

### Week 9: Trace and test the roleplay protocol

**Objective:** Understand a full-stack asynchronous feature before changing it.

**Starting files:**

- `mobile/stores/useRoleplayStore.ts`
- `mobile/lib/roleplaySocket.ts`
- `mobile/lib/useRoleplayAudio.ts`
- `mobile/app/roleplay/session.tsx`
- `backend/app/routers/roleplay.py`
- `backend/app/services/stt.py`
- `backend/app/services/llm.py`
- `backend/app/services/tts.py`

**Task:**

Write an event-sequence table for connection, greeting, speech turn, hint, error, disconnect, and end. Add one missing protocol-level test for an error or disconnect path without calling a real AI provider.

**Acceptance criteria:**

- Every event has sender, receiver, payload, state mutation, and persistence effect.
- The test isolates external providers.
- You identify which data survives mobile restart, backend restart, and socket reconnect.

**Explain before moving on:**

- Why is this not true streaming?
- Why is base64 more expensive than binary frames?
- When are user and Tars chat logs committed?
- What happens if STT succeeds but LLM generation fails?

**Hints:**

1. Start at the mic button and follow one function call at a time.
2. Separate REST start/end from WebSocket turn events.
3. Search backend tests for provider mocks before building new fixtures.

### Week 10: Make one roleplay failure recoverable

**Objective:** Own a bounded reliability improvement across mobile and backend.

**Starting files:**

- Files from Week 9
- `backend/app/services/session_store.py`
- Roleplay tests on both sides

**Task:**

Choose one failure: socket disconnect, duplicate end request, or response-generation failure after transcription. Define the state transition and implement predictable recovery.

**Constraints:**

- Choose one failure only.
- Do not redesign all session persistence.
- Avoid duplicate chat logs or target attempts.
- Give the user a clear retry or terminal state.

**Acceptance criteria:**

- The chosen failure has a documented state transition.
- Repeating the recovery action is safe where appropriate.
- Tests prove both failure and recovery.

**Explain before moving on:**

- Which action must be idempotent?
- Which state is currently only in process memory?
- What transaction boundary would prevent partial persistence?

**Hints:**

1. Reproduce the failure with mocks before fixing it.
2. List database writes in order and mark the point of failure.
3. Prefer one explicit state over several loosely related booleans.

### Week 11: Design the shadowing contract

**Objective:** Learn to design a feature before producing code.

**Starting files:**

- `backend/app/models/shadowing.py`
- Shadowing sections in `AGENTS.md`
- Shadowing sections in `backend/CONTRACTS.md`
- `mobile/app/(tabs)/practice.tsx`
- Existing roleplay audio code for comparison only

**Task:**

Write a short design inside your challenge journal covering:

- The smallest useful user story
- API inputs and outputs
- Supported audio format and duration limit
- Reference media ownership
- Pitch extraction result shape
- Score meaning
- Error cases
- Persistence transaction
- Mobile loading, recording, success, and failure states
- How to test without relying on microphone hardware

**Acceptance criteria:**

- The first slice can be completed without implementing a graph.
- The contract distinguishes media metadata from audio bytes.
- The design does not claim a score is a tone judgment unless the algorithm supports that claim.
- Performance can be measured.

**Explain before moving on:**

- Why precompute native pitch contours?
- Why must unvoiced frames be represented deliberately?
- What does DTW solve, and what does it not solve?
- Why is a single similarity number insufficient for useful feedback?

**Hints:**

1. Start with one reference clip and one user attempt, not a library screen.
2. Keep DSP as a pure service with arrays in and a result object out.
3. Design deterministic tests using generated or fixture audio before using a real recording.

### Week 12: Build the first shadowing vertical slice

**Objective:** Turn the design into the smallest end-to-end feature.

**Task:**

Implement a backend-only first slice that accepts or loads two already-extracted pitch contours, aligns them, returns a score and aligned points, and persists a `ShadowingAttempt`. Expose it through one API endpoint with deterministic tests.

This intentionally postpones real microphone recording and pYIN extraction. It proves the domain shape, alignment boundary, persistence, and client contract first.

**Constraints:**

- Keep alignment logic independent from FastAPI and SQLModel.
- Validate empty, very short, malformed, and unvoiced inputs.
- Define score range and direction explicitly.
- Do not hide all DSP behavior inside an external library call.

**Acceptance criteria:**

- Identical contours score better than clearly different contours.
- Time-stretched similar contours align reasonably.
- Invalid contours return useful errors.
- A successful attempt is persisted atomically.
- Tests use fixed arrays and do not require network or microphone access.

**Explain before moving on:**

- Why is the pure alignment service easier to test?
- How are pitch values normalized?
- How does path cost become a 0-1 score?
- What data will the mobile graph eventually need?

**Hints:**

1. Define typed input and result structures first.
2. Test normalization separately from alignment.
3. Start with a simple dynamic-programming DTW implementation before optimizing.

## 11. Shadowing Capstone Roadmap

Week 12 is the beginning, not the whole shadowing feature. Continue through these milestones at your own pace.

### Milestone 1: Pure contour scoring

- Normalize voiced pitch values relative to speaker range or median.
- Align native and user contours with DTW.
- Return overall score, path, and local differences.
- Benchmark representative contour lengths.

### Milestone 2: Reference-media ingestion

- Define where reference audio is stored.
- Extract and cache the native contour once.
- Create `ShadowingMedia` records deliberately rather than by manual DB edits.
- Validate file type, duration, and sample rate.

### Milestone 3: User audio analysis

- Add multipart or binary upload support.
- Decode audio to one internal format.
- Extract a user contour with pYIN.
- Handle silence, clipping, and insufficient voiced frames.
- Keep uploaded audio only if there is a product reason.

### Milestone 4: Attempt persistence

- Save score, user contour, and completion time in one transaction.
- Decide whether algorithm version and normalization metadata must be stored.
- Add attempt history and best/recent score queries.

### Milestone 5: Mobile recording flow

- Select one failing card with reference media.
- Play the reference clip.
- Record and upload one attempt.
- Render permission, recording, processing, success, retry, and network-error states.
- Prevent duplicate submissions.

### Milestone 6: Visual feedback

- Render native and aligned user contours on the same normalized axes.
- Distinguish unvoiced regions.
- Highlight local mismatch instead of showing only a score.
- Test small and large screens.

### Milestone 7: Product integration

- Select candidates based on review and roleplay difficulty.
- Explain how shadowing affects, or deliberately does not affect, SRS.
- Add offline behavior and cache rules.
- Measure analysis latency against the stated target.

### Capstone completion rubric

| Area | Basic | Strong |
|---|---|---|
| Architecture | Feature works end to end | Pure DSP, transport, persistence, and UI are cleanly separated |
| Correctness | Similar clips generally score higher | Edge cases and algorithm limitations are tested and documented |
| Reliability | Errors do not crash the app | Requests are retry-safe and partial writes cannot occur |
| UX | User can record and see a score | User receives actionable visual and textual feedback |
| Performance | Processing completes | Each pipeline stage is measured and bottlenecks are explained |
| Ownership | You can demo it | You can defend each major tradeoff and rejected alternative |

## 12. Optional Advanced Challenges

Do these after the foundation curriculum, not instead of it.

### Deletion-aware sync

Introduce deck and card tombstones, define conflict semantics, preserve referential ordering, and prove idempotency across repeated push/pull cycles.

### Durable roleplay sessions

Persist a roleplay state machine that can recover after app or backend restart. Add expiry, reconnect, message reconstruction, and idempotent finalization.

### Generated API client

Generate TypeScript types from FastAPI OpenAPI and add a drift check so mobile request and response types cannot silently diverge.

### Migration discipline

Introduce Alembic for the backend and a structured migration registry for mobile. Test upgrades from realistic old schemas and clean bootstrapping from an empty database.

### True voice streaming

Move from complete base64 utterances to incremental binary audio, partial transcription where supported, streamed LLM text, and chunked audio playback. Measure latency before and after.

### CI quality gates

Run backend unit tests, mobile tests, TypeScript checks, linting, clean database bootstrap, and API contract checks on every change.

## 13. Questions You Must Be Able to Answer

### Foundations

- Which process owns flashcard review?
- Which database is authoritative for flashcards?
- Why are there two SQLite databases?
- What makes a feature local-first?
- Which data is stored in JSON rather than SQLite, and why?

### Mobile

- How does Expo Router turn files into navigation?
- What is the difference between screen state, Zustand state, SQLite state, and filesystem state?
- Why can a Zustand store call another store with `getState()`?
- What causes a screen to refresh after navigation?
- What survives closing the review modal or killing the app?

### Backend

- What work belongs in a router, schema, service, and model?
- When does a request create, commit, or close a database session?
- Which external-provider calls are async?
- Why can synchronous database work inside an async WebSocket matter?
- How does FastAPI generate `/docs`?

### SRS and sync

- What happens from an offline answer to backend acknowledgement?
- What prevents one pending review from being processed twice?
- Why can a deleted card return?
- How does last-write-wins decide which edit survives?
- What happens when device clocks disagree?
- Why is syncing a local audio path suspicious?

### Roleplay

- How are target words selected?
- What is the distinction between recognition and production difficulty?
- Which session state is persisted and which is volatile?
- Why is substring matching not grammar validation?
- Why is the current WebSocket flow not true streaming?
- What partial data remains if response generation fails?

### Shadowing

- What is a pitch contour?
- Why should native contours be precomputed?
- Why normalize pitch before comparing two speakers?
- What does DTW align?
- Which failures should reject an attempt instead of returning a low score?
- What result data is required for visual feedback?

## 14. How to Approach Any Future Feature

Use this sequence before asking AI to implement it:

1. **State the user behavior.** Describe what the user does and observes without naming code.
2. **Name the source of truth.** Identify where the durable state belongs.
3. **Trace the current path.** List existing functions in execution order.
4. **Define invariants.** State what must always remain true.
5. **List failure points.** Include offline, restart, retry, malformed data, and partial success.
6. **Choose the smallest slice.** Deliver one complete path rather than many disconnected foundations.
7. **Write acceptance tests.** Make ambiguous product language concrete.
8. **Implement narrowly.** Avoid unrelated cleanup while learning the behavior.
9. **Verify at boundaries.** Test pure logic, persistence, transport, and UI at appropriate levels.
10. **Teach it back.** Explain the feature without reading the code line by line.

## 15. A Final Standard for Ownership

You own a section of Tars when you can:

- Locate its entry point without guessing.
- Trace its data through every layer.
- Predict normal and failure behavior before running it.
- Make a small change without rewriting unrelated code.
- Write a test that would have caught the old behavior.
- Diagnose a failure using evidence rather than repeated prompting.
- Explain what is persisted and what is temporary.
- Describe the tradeoffs in the current design without calling everything “bad.”
- Ask AI a narrow question instead of delegating the entire problem.
- Review AI-generated code and reject it when it violates the system's invariants.

The project does not need to become perfect before you understand it. Understanding comes from repeatedly tracing one behavior, predicting it, changing it, proving it, and explaining it.
