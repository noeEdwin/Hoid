# Tars API Contracts

All endpoints are prefixed with `/api`. UUIDs used throughout are v4.

---

## Module 0: Deck CRUD (REST)

### `GET /api/decks`

Returns all decks for the user.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/decks`

**Response Body (200 OK)**

```json
{
  "decks": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Starter Deck",
      "description": "Initial cloze deletion cards",
      "created_at": "2026-06-19T10:00:00Z"
    }
  ]
}
```

---

### `POST /api/decks`

Creates a new deck.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/decks`

**Request Body**

```json
{
  "name": "HSK 1",
  "description": "Basic vocabulary"
}
```

**Response Body (201 Created)**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "HSK 1",
  "description": "Basic vocabulary",
  "created_at": "2026-06-19T10:00:00Z"
}
```

---

### `PUT /api/decks/{deck_id}`

Updates a deck's name and/or description.

* **HTTP Method:** `PUT`
* **URL Endpoint:** `/api/decks/{deck_id}`

**Request Body**

```json
{
  "name": "HSK 1 Updated",
  "description": "Updated description"
}
```

**Response Body (200 OK)**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "HSK 1 Updated",
  "description": "Updated description",
  "created_at": "2026-06-19T10:00:00Z"
}
```

---

### `DELETE /api/decks/{deck_id}`

Deletes a deck and all its flashcards.

* **HTTP Method:** `DELETE`
* **URL Endpoint:** `/api/decks/{deck_id}`

**Response Body (200 OK)**

```json
{
  "status": "deleted",
  "deck_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

---

## Module 1: Flashcard CRUD (REST)

### `GET /api/decks/{deck_id}/flashcards`

Returns all flashcards in a deck.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/decks/{deck_id}/flashcards`

**Response Body (200 OK)**

```json
{
  "flashcards": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "deck_id": "123e4567-e89b-12d3-a456-426614174001",
      "card_type": "cloze_deletion",
      "sentence": "我___你",
      "sentence_pinyin": "wǒ ài nǐ",
      "answer": "爱",
      "answer_pinyin": "ài",
      "context": "A simple declaration of love.",
      "context_pinyin": null,
      "image_path": null,
      "audio_path": null,
      "created_at": "2026-06-19T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### `POST /api/flashcards`

Creates a new flashcard.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/flashcards`

**Request Body**

```json
{
  "deck_id": "123e4567-e89b-12d3-a456-426614174000",
  "card_type": "cloze_deletion",
  "sentence": "今天天气很___",
  "sentence_pinyin": "jīntiān tiānqì hěn hǎo",
  "answer": "好",
  "answer_pinyin": "hǎo",
  "context": "Talking about weather.",
  "context_pinyin": null
}
```

**Response Body (201 Created)**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "deck_id": "123e4567-e89b-12d3-a456-426614174000",
  "card_type": "cloze_deletion",
  "sentence": "今天天气很___",
  "sentence_pinyin": "jīntiān tiānqì hěn hǎo",
  "answer": "好",
  "answer_pinyin": "hǎo",
  "context": "Talking about weather.",
  "context_pinyin": null,
  "image_path": null,
  "audio_path": null,
  "created_at": "2026-06-19T10:00:00Z"
}
```

---

### `PUT /api/flashcards/{flashcard_id}`

Updates an existing flashcard.

* **HTTP Method:** `PUT`
* **URL Endpoint:** `/api/flashcards/{flashcard_id}`

**Request Body** (all fields optional)

```json
{
  "sentence": "今天天气很好___",
  "sentence_pinyin": "jīntiān tiānqì hěn hǎo a"
}
```

**Response Body (200 OK)**

Returns updated flashcard.

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

---

## Module 2: SRS Review (REST)

### `GET /api/decks/{deck_id}/review`

Fetches the current queue of flashcards ready for spaced repetition review. Sorted by difficulty_score descending (hardest first). On mobile, cards are shuffled using a weighted algorithm (70% difficulty + 30% random) to prevent pattern memorization. Failed cards are re-inserted at end of queue with max 3 attempts per card per session.

* **HTTP Method:** `GET`
* **URL Endpoint:** `/api/decks/{deck_id}/review`

**Query Parameters**
- `limit` (optional, integer, default 20): Max cards to return

**Response Body (200 OK)**

```json
{
  "queue": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "sentence": "我___你",
      "sentence_pinyin": "wǒ ài nǐ",
      "answer": "爱",
      "answer_pinyin": "ài",
      "card_type": "cloze_deletion",
      "srs_interval": 2,
      "ease_factor": 2.5,
      "difficulty_score": 0.85,
      "total_reviews": 5,
      "total_failures": 3,
      "consecutive_failures": 1,
      "consecutive_correct": 0
    }
  ],
  "total_pending": 12
}
```

---

### `POST /api/flashcards/{flashcard_id}/review`

Updates flashcard metrics after a user completes a review. Uses auto-rating: correct → "good", incorrect → "hard".

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/flashcards/{flashcard_id}/review`

**Request Body**

```json
{
  "is_correct": true,
  "response_time_ms": 3200
}
```

**Response Body (200 OK)**

```json
{
  "status": "success",
  "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
  "new_srs_interval": 4,
  "new_difficulty_score": 0.72
}
```

---

## Module 3: Vocabulary Analytics (REST)

### `GET /api/vocabulary/difficulty`

Returns the user's top N highest-difficulty tokens, sorted by difficulty_score descending.

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
      "sentence": "我___你",
      "answer": "爱",
      "answer_pinyin": "ài",
      "difficulty_score": 0.95,
      "total_reviews": 12,
      "total_failures": 9,
      "consecutive_failures": 3
    }
  ]
}
```

---

### `GET /api/vocabulary/profile`

Returns the user's known vocabulary profile — all cards with difficulty_score below a threshold.

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
      "sentence": "他是我的___",
      "answer": "朋友",
      "answer_pinyin": "péngyǒu",
      "difficulty_score": 0.25
    }
  ],
  "total_known": 180,
  "total_cards": 500
}
```

---

## Module 4: Sync (REST)

### `POST /api/sync/push`

Pushes local mobile changes to the backend. Last-write-wins conflict resolution.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/sync/push`

**Request Body**

```json
{
  "last_sync_at": "2026-06-19T08:00:00Z",
  "decks": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "HSK 1",
      "description": "Basic vocabulary",
      "created_at": "2026-06-18T10:00:00Z"
    }
  ],
  "flashcards": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "deck_id": "123e4567-e89b-12d3-a456-426614174000",
      "card_type": "cloze_deletion",
      "sentence": "我___你",
      "sentence_pinyin": "wǒ ài nǐ",
      "answer": "爱",
      "answer_pinyin": "ài",
      "context": "A simple declaration of love.",
      "context_pinyin": null,
      "image_path": null,
      "audio_path": null,
      "created_at": "2026-06-18T10:00:00Z"
    }
  ],
  "vocabulary_states": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174001",
      "srs_interval": 2,
      "ease_factor": 2.5,
      "total_reviews": 5,
      "total_failures": 3,
      "consecutive_failures": 1,
      "consecutive_correct": 2,
      "difficulty_score": 0.85
    }
  ],
  "pending_reviews": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174001",
      "is_correct": true,
      "response_time_ms": 3200,
      "created_at": "2026-06-19T08:30:00Z"
    }
  ]
}
```

**Response Body (200 OK)**

```json
{
  "status": "synced",
  "synced_at": "2026-06-19T10:30:00Z",
  "decks_upserted": 1,
  "flashcards_upserted": 1,
  "states_upserted": 1,
  "reviews_upserted": 1
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
  "synced_at": "2026-06-19T10:30:00Z",
  "decks": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Starter Deck",
      "description": "Initial cloze deletion cards",
      "created_at": "2026-06-19T10:00:00Z"
    }
  ],
  "flashcards": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "deck_id": "123e4567-e89b-12d3-a456-426614174000",
      "card_type": "cloze_deletion",
      "sentence": "我___你",
      "sentence_pinyin": "wǒ ài nǐ",
      "answer": "爱",
      "answer_pinyin": "ài",
      "context": "A simple declaration of love.",
      "context_pinyin": null,
      "image_path": null,
      "audio_path": null,
      "created_at": "2026-06-19T10:00:00Z"
    }
  ],
  "vocabulary_states": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174001",
      "srs_interval": 2,
      "ease_factor": 2.5,
      "total_reviews": 5,
      "total_failures": 3,
      "consecutive_failures": 1,
      "consecutive_correct": 2,
      "difficulty_score": 0.85
    }
  ]
}
```

---

## Module 5: Scenarios (REST)

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
      "title": "在咖啡店",
      "description": "你是一位咖啡店的店员，正在为客人点单。",
      "difficulty": "beginner",
      "target_grammar": ["咖啡", "要", "请"],
      "example_prompt": "你好，欢迎光临！"
    }
  ]
}
```

---

## Module 6: Roleplay Engine (REST + WebSocket)

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
    "title": "在咖啡店",
    "difficulty": "beginner"
  },
  "forced_tokens": ["咖啡", "要", "请"],
  "initial_greeting": {
    "text": "你好！欢迎光临。这是菜单，你想吃点什么？",
    "audio_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA..."
  }
}
```

---

### `WS /api/roleplay/stream/{session_id}`

Real-time bidirectional conversational tunnel for an active roleplay session.

**Inbound Events (Client → Server)**

```json
{
  "event_type": "user_speech",
  "audio_chunk_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA..."
}
```

```json
{
  "event_type": "request_hint"
}
```

**Outbound Events (Server → Client)**

```json
{
  "event_type": "tars_response",
  "transcribed_user_text": "我要一个菜单",
  "grammar_evaluations": [
    {
      "target_token": "菜单",
      "passed": true,
      "feedback_explanation": null
    }
  ],
  "ai_text_reply": "好的，给你菜单。",
  "ai_audio_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA...",
  "difficulty_adjusted": null
}
```

```json
{
  "event_type": "hint_response",
  "hint_text": "Try using 把 to move the object.",
  "suggested_structure": "把 + object + verb + complement"
}
```

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
    "tokens_forced": ["咖啡", "要", "请"],
    "tokens_passed": ["要", "请"],
    "tokens_failed": ["咖啡"]
  }
}
```

---

## Module 7: Shadowing (REST)

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
      "sentence": "我___你",
      "answer": "爱",
      "difficulty_score": 0.85,
      "audio_file_path": "assets/audio/ai4.wav",
      "best_score_ever": 0.72
    }
  ]
}
```

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

---

### `GET /api/shadowing/attempts/{shadowing_media_id}`

Returns historical pitch match scores for a specific shadowing media asset.

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
      "completed_at": "2026-06-19T10:15:00Z"
    }
  ],
  "total_attempts": 2,
  "best_score": 0.875,
  "average_score": 0.763
}
```

---

## Module 8: TTS (REST)

### `POST /api/tts`

Generates MP3 audio for a given Chinese text string. Used on flashcard creation to pre-generate audio.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/tts`

**Request Body**

```json
{
  "text": "我爱ni"
}
```

**Response Body (200 OK)**

* **Content-Type:** `audio/mpeg`
* **Body:** Binary MP3 audio data

**Error Responses**

* **400 Bad Request** — Empty text
* **500 Internal Server Error** — TTS generation failed

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
- `DECK_NOT_FOUND` — Invalid deck ID
- `FLASHCARD_NOT_FOUND` — Invalid flashcard ID
- `SESSION_NOT_FOUND` — Invalid session ID
- `SCENARIO_NOT_FOUND` — Invalid scenario ID
- `MEDIA_NOT_FOUND` — Audio file missing
- `INVALID_AUDIO` — Corrupted or unparseable audio data
- `SERVICE_UNAVAILABLE` — External API timeout
- `VALIDATION_ERROR` — Request body validation failed
