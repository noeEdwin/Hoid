# Tars API Contracts

All endpoints are prefixed with `/api`. UUIDs used throughout are v4.

---

## Module 0: Flashcard CRUD (REST)

### `GET /api/flashcards`

Returns all flashcards in the user's vocabulary deck.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/flashcards`

**Query Parameters**
- `grammar_type` (optional, string): Filter by type (`"noun"`, `"verb"`, `"particle"`, `"adjective"`, etc.)
- `search` (optional, string): Search by character or meaning

**Response Body (200 OK)**

```json
{
  "flashcards": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "character": "朋友",
      "pinyin": "péng you",
      "meaning": "friend",
      "grammar_type": "noun",
      "created_at": "2026-06-11T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### `POST /api/flashcards`

Creates a new flashcard in the vocabulary deck.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/flashcards`

**Request Body**

```json
{
  "character": "咖啡",
  "pinyin": "kā fēi",
  "meaning": "coffee",
  "grammar_type": "noun"
}
```

**Response Body (201 Created)**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "character": "咖啡",
  "pinyin": "kā fēi",
  "meaning": "coffee",
  "grammar_type": "noun",
  "created_at": "2026-06-11T10:00:00Z"
}
```

**Potential Error States**
* **422 Unprocessable Entity:** Missing required fields or invalid data.

---

### `PUT /api/flashcards/{flashcard_id}`

Updates an existing flashcard.

* **HTTP Method:** `PUT`
* **URL Endpoint:** `/api/flashcards/{flashcard_id}`

**Request Body** (all fields optional, only provided fields are updated)

```json
{
  "character": "咖啡",
  "pinyin": "kā fēi",
  "meaning": "coffee (noun)",
  "grammar_type": "noun"
}
```

**Response Body (200 OK)**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "character": "咖啡",
  "pinyin": "kā fēi",
  "meaning": "coffee (noun)",
  "grammar_type": "noun",
  "created_at": "2026-06-11T10:00:00Z"
}
```

**Potential Error States**
* **404 Not Found:** Invalid `flashcard_id`.

---

### `DELETE /api/flashcards/{flashcard_id}`

Deletes a flashcard and its associated vocabulary state.

* **HTTP Method:** `DELETE`
* **URL Endpoint:** `/api/flashcards/{flashcard_id}`

**Response Body (200 OK)**

```json
{
  "status": "deleted",
  "flashcard_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Potential Error States**
* **404 Not Found:** Invalid `flashcard_id`.

---

## Module 0.5: SRS Review (REST)

### `GET /api/flashcards/review`

Fetches the current queue of flashcards ready for spaced repetition review.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/flashcards/review`

**Query Parameters**
- `limit` (optional, integer, default 20): Max cards to return

**Response Body (200 OK)**

```json
{
  "queue": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "character": "朋友",
      "pinyin": "péng you",
      "meaning": "friend",
      "grammar_type": "noun",
      "srs_interval": 2,
      "ease_factor": 2.5,
      "difficulty_score": 0.85,
      "total_reviews": 5,
      "total_failures": 3
    }
  ],
  "total_pending": 12
}
```

**Potential Error States**
* **404 Not Found:** No cards due for review or deck is empty.

---

### `POST /api/flashcards/review/submit`

Updates flashcard metrics after a user completes a review.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/flashcards/review/submit`

**Request Body**

```json
{
  "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
  "review_rating": "hard",
  "response_time_ms": 3200
}
```

**`review_rating` enum:**
- `"easy"` — Knew it instantly. Interval doubles.
- `"good"` — Remembered with effort. Interval increases normally.
- `"hard"` — Failed / didn't know. Resets interval, increases difficulty_score.

**Response Body (200 OK)**

```json
{
  "status": "success",
  "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
  "new_srs_interval": 0,
  "new_difficulty_score": 0.92
}
```

**Potential Error States**
* **404 Not Found:** Invalid `flashcard_id`.
* **422 Unprocessable Entity:** Missing fields or invalid `review_rating`.

---

## Module 1: Vocabulary Analytics (REST)

### `GET /api/vocabulary/difficulty`

Returns the user's top N highest-difficulty tokens, sorted by difficulty_score descending. Used by the roleplay engine to select injection targets.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/vocabulary/difficulty`

**Query Parameters**
- `n` (optional, integer, default 10): Number of top difficult tokens to return

**Response Body (200 OK)**

```json
{
  "difficult_tokens": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "character": "得",
      "pinyin": "de",
      "meaning": "(structural particle)",
      "grammar_type": "particle",
      "difficulty_score": 0.95,
      "total_reviews": 12,
      "total_failures": 9
    }
  ]
}
```

**Potential Error States**
* **404 Not Found:** No vocabulary data exists yet.

---

### `GET /api/vocabulary/profile`

Returns the user's known vocabulary profile — all cards with difficulty_score below a threshold. Used by the roleplay engine to restrict AI output to known words (FR-5.1).

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/vocabulary/profile`

**Query Parameters**
- `threshold` (optional, float, default 0.5): Max difficulty_score to consider "known"

**Response Body (200 OK)**

```json
{
  "known_words": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "character": "朋友",
      "pinyin": "péng you",
      "meaning": "friend",
      "difficulty_score": 0.25
    }
  ],
  "total_known": 180,
  "total_cards": 500
}
```

**Potential Error States**
* **404 Not Found:** No vocabulary data exists yet.

---

## Module 2: Sync (REST)

### `POST /api/sync/push`

Pushes local mobile changes to the backend. Mobile-wins conflict resolution — all provided data overwrites backend state.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/sync/push`

**Request Body**

```json
{
  "last_sync_at": "2026-06-11T08:00:00Z",
  "flashcards": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "character": "朋友",
      "pinyin": "péng you",
      "meaning": "friend",
      "grammar_type": "noun",
      "created_at": "2026-06-10T10:00:00Z"
    }
  ],
  "vocabulary_states": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "srs_interval": 2,
      "ease_factor": 2.5,
      "total_reviews": 5,
      "total_failures": 3,
      "difficulty_score": 0.85
    }
  ]
}
```

**Response Body (200 OK)**

```json
{
  "status": "synced",
  "synced_at": "2026-06-11T10:30:00Z",
  "flashcards_upserted": 1,
  "states_upserted": 1
}
```

---

### `GET /api/sync/pull`

Returns all backend data modified since the client's last sync timestamp.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/sync/pull`

**Query Parameters**
- `since` (optional, ISO 8601 timestamp): Client's last sync time. If omitted, returns all data.

**Response Body (200 OK)**

```json
{
  "synced_at": "2026-06-11T10:30:00Z",
  "flashcards": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "character": "朋友",
      "pinyin": "péng you",
      "meaning": "friend",
      "grammar_type": "noun",
      "created_at": "2026-06-10T10:00:00Z"
    }
  ],
  "vocabulary_states": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "srs_interval": 2,
      "ease_factor": 2.5,
      "total_reviews": 5,
      "total_failures": 3,
      "difficulty_score": 0.85
    }
  ]
}
```

---

## Module 3: Scenarios (REST)

### `GET /api/roleplay/scenarios`

Returns all available pre-defined roleplay scenarios.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/roleplay/scenarios`

**Query Parameters**
- `difficulty` (optional, string): Filter by level (`"beginner"`, `"intermediate"`, `"advanced"`)

**Response Body (200 OK)**

```json
{
  "scenarios": [
    {
      "id": "444e4567-e89b-12d3-a456-426614174000",
      "title": "Ordering Food",
      "description": "You are at a restaurant in Beijing. The waiter approaches your table.",
      "difficulty": "beginner",
      "target_grammar": ["把", "了", "要"],
      "example_prompt": "你想吃点什么？"
    }
  ]
}
```

---

## Module 4: Roleplay Engine (REST + WebSocket)

### `POST /api/roleplay/start`

Starts a new roleplay session. Pulls high-difficulty tokens, selects scenario constraints, generates initial greeting.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/roleplay/start`

**Request Body**

```json
{
  "scenario_id": "444e4567-e89b-12d3-a456-426614174000"
}
```

**Response Body (200 OK)**

```json
{
  "session_id": "987fcdeb-51a2-43d7-9012-345678901234",
  "websocket_url": "ws://localhost:8000/api/roleplay/stream/987fcdeb-51a2-43d7-9012-345678901234",
  "scenario": {
    "title": "Ordering Food",
    "difficulty": "beginner"
  },
  "forced_tokens": ["把", "了", "要"],
  "initial_greeting": {
    "text": "你好！欢迎光临。这是菜单，你想吃点什么？",
    "audio_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA..."
  }
}
```

**Potential Error States**
* **404 Not Found:** Invalid `scenario_id`.
* **422 Unprocessable Entity:** Missing or malformed request body.
* **503 Service Unavailable:** LLM or TTS service timeout during initialization.

---

### `WS /api/roleplay/stream/{session_id}`

Real-time bidirectional conversational tunnel for an active roleplay session.

* **Protocol:** `WebSocket`
* **URL Endpoint:** `/api/roleplay/stream/{session_id}`

---

#### Inbound Events (Client → Server)

**`user_speech`** — Fired when user speech ends (local VAD cut).

```json
{
  "event_type": "user_speech",
  "audio_chunk_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA..."
}
```

**`request_hint`** — User requests a scaffolding hint mid-session.

```json
{
  "event_type": "request_hint"
}
```

---

#### Outbound Events (Server → Client)

**`tars_response`** — AI reply with grammar evaluation and audio.

```json
{
  "event_type": "tars_response",
  "transcribed_user_text": "我要一个菜单",
  "grammar_evaluations": [
    {
      "target_token": "菜单",
      "passed": true,
      "feedback_explanation": null
    },
    {
      "target_token": "因为",
      "passed": false,
      "feedback_explanation": "You did not use '因为' to explain why you wanted the menu."
    }
  ],
  "ai_text_reply": "好的，给你菜单。因为你看起来很饿，要不要先点个小菜？",
  "ai_audio_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA...",
  "difficulty_adjusted": null
}
```

**`difficulty_adjusted`** field values:
- `null` — No change
- `"downgraded"` — Scenario complexity reduced due to repeated failures (FR-5.3)
- `"upgraded"` — Complexity increased (user doing well)

**`hint_response`** — Scaffolding hint in response to `request_hint`.

```json
{
  "event_type": "hint_response",
  "hint_text": "Try using 把 to move the object. For example: 把菜单给我。",
  "suggested_structure": "把 + object + verb + complement"
}
```

**`error`** — Server-side error during streaming.

```json
{
  "event_type": "error",
  "message": "LLM service temporarily unavailable. Please try again.",
  "recoverable": true
}
```

---

#### Potential WebSocket Error States
* **404 Not Found:** Invalid `session_id` in URL path.
* **422 Unprocessable Entity:** Corrupted audio data or malformed JSON.
* **503 Service Unavailable:** Cloud API timeout (Groq/DeepSeek/Edge-TTS offline).

---

### `POST /api/roleplay/end`

Closes the session, commits batched analytics to DB, frees resources.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/roleplay/end`

**Request Body**

```json
{
  "session_id": "987fcdeb-51a2-43d7-9012-345678901234"
}
```

**Response Body (200 OK)**

```json
{
  "status": "success",
  "message": "Session closed. 4 turns logged, 2 turns evaluated.",
  "session_summary": {
    "total_turns": 4,
    "tokens_forced": ["把", "了", "要"],
    "tokens_passed": ["了", "要"],
    "tokens_failed": ["把"]
  }
}
```

**Potential Error States**
* **404 Not Found:** Invalid `session_id`.
* **422 Unprocessable Entity:** Broken JSON payload.

---

## Module 5: Shadowing (REST)

### `GET /api/shadowing/recommendations`

Returns top problem vocabulary words mapped to available shadowing audio assets.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/shadowing/recommendations`

**Query Parameters**
- `limit` (optional, integer, default 10): Max recommendations

**Response Body (200 OK)**

```json
{
  "recommendations": [
    {
      "shadowing_media_id": "555e4567-e89b-12d3-a456-426614174000",
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "character": "朋友",
      "pinyin": "péng you",
      "difficulty_score": 0.85,
      "audio_file_path": "assets/audio/peng2_you5.wav",
      "best_score_ever": 0.72
    }
  ]
}
```

**Potential Error States**
* **404 Not Found:** No high-difficulty cards found or no audio assets available.

---

### `POST /api/shadowing/evaluate`

Accepts a recorded user audio attempt, runs pYIN pitch extraction + DTW alignment against the cached native contour.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/shadowing/evaluate`

**Request Body**
* **Content-Type:** `multipart/form-data`
* **Form Fields:**
  - `flashcard_id` (Text): `"123e4567-e89b-12d3-a456-426614174000"`
  - `shadowing_media_id` (Text): `"555e4567-e89b-12d3-a456-426614174000"`
  - `user_audio` (File): Binary `.wav` vocal wave file

**Response Body (200 OK)**

```json
{
  "shadowing_attempt_id": "777e4567-e89b-12d3-a456-426614174000",
  "pitch_match_score": 0.875,
  "user_pitch_curve": [120.5, 122.1, 125.0, 130.2, 128.5, 115.0],
  "native_pitch_curve": [118.0, 120.0, 125.5, 131.0, 129.0, 114.5]
}
```

**`pitch_match_score`:** 0.0 to 1.0 (normalized). 1.0 = perfect match.

**Potential Error States**
* **404 Not Found:** Invalid `flashcard_id` or `shadowing_media_id`, or audio file missing.
* **422 Unprocessable Entity:** Invalid audio format or no detectable pitch in recording.

---

### `GET /api/shadowing/attempts/{shadowing_media_id}`

Returns historical pitch match scores for a specific shadowing media asset. Used to show progress over time.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/shadowing/attempts/{shadowing_media_id}`

**Response Body (200 OK)**

```json
{
  "attempts": [
    {
      "id": "777e4567-e89b-12d3-a456-426614174000",
      "pitch_match_score": 0.875,
      "user_pitch_curve": [120.5, 122.1, 125.0, 130.2, 128.5, 115.0],
      "completed_at": "2026-06-11T10:15:00Z"
    },
    {
      "id": "888e4567-e89b-12d3-a456-426614174000",
      "pitch_match_score": 0.650,
      "user_pitch_curve": [119.0, 121.5, 124.0, 128.0, 126.0, 113.0],
      "completed_at": "2026-06-11T09:45:00Z"
    }
  ],
  "total_attempts": 2,
  "best_score": 0.875,
  "average_score": 0.763
}
```

**Potential Error States**
* **404 Not Found:** Invalid `shadowing_media_id`.

---

## Error Response Format

All error responses follow this structure:

```json
{
  "detail": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE"
}
```

Common error codes:
- `FLASHCARD_NOT_FOUND` — Invalid flashcard ID
- `SESSION_NOT_FOUND` — Invalid session ID
- `SCENARIO_NOT_FOUND` — Invalid scenario ID
- `MEDIA_NOT_FOUND` — Audio file missing
- `INVALID_AUDIO` — Corrupted or unparseable audio data
- `SERVICE_UNAVAILABLE` — External API timeout
- `VALIDATION_ERROR` — Request body validation failed
