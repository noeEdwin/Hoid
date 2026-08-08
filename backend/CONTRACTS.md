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

Returns active scenarios only. Built-in and user-created scenarios have identical behavior.

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
      "example_prompt": "你好，欢迎光临！",
      "created_at": "2026-07-19T10:00:00",
      "updated_at": "2026-07-19T10:00:00",
      "archived_at": null
    }
  ]
}
```

---

### `GET /api/roleplay/scenarios/{scenario_id}`

Returns one active scenario using the same object shape as the list item above. Missing or archived scenarios return `404` with `{"detail":"Scenario not found"}`.

---

### `POST /api/roleplay/scenarios`

Creates a scenario and returns the scenario object with `201 Created`.

```json
{
  "title": "买火车票",
  "description": "在车站购买车票并确认出发时间。",
  "difficulty": "intermediate",
  "target_grammar": ["车票", "出发", "几点"],
  "example_prompt": "您好，请问您要去哪里？"
}
```

`difficulty` must be `beginner`, `intermediate`, or `advanced`. `title` is 1-80 characters, `description` is 1-1000, and `example_prompt` is optional with a maximum of 300. `target_grammar` must contain 1-10 targets of at most 40 characters. Strings are trimmed; blank targets are removed and duplicates are removed in first-seen order. A normalized active-title collision returns `409`. An archived title may be reused.

---

### `PUT /api/roleplay/scenarios/{scenario_id}`

Replaces all editable fields. The request and response match `POST /api/roleplay/scenarios`. Archived scenarios return `404`; normalized active-title collisions return `409`.

---

### `DELETE /api/roleplay/scenarios/{scenario_id}`

Archives a scenario without deleting roleplay sessions or history. Archived scenarios disappear from list/detail and cannot be updated or archived again.

```json
{
  "status": "archived",
  "scenario_id": "444e4567-e89b-12d3-a456-426614174000"
}
```

---

### `POST /api/roleplay/scenarios/recommendations`

Returns up to five reviewed/difficult existing cards selected for an unsaved scenario and up to five new LLM suggestions. New suggestions exclude words already present in any flashcard. This endpoint never writes scenario, flashcard, or SRS data. If new suggestion generation fails, `suggested_new` is empty while valid existing-card recommendations are retained.

```json
{
  "title": "买火车票",
  "description": "在车站购买车票。",
  "difficulty": "intermediate",
  "selected_targets": ["出发"]
}
```

`selected_targets` is optional and defaults to `[]`.

```json
{
  "existing_cards": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "word": "车票",
      "pinyin": "chē piào",
      "sentence": "我想买一张___。",
      "difficulty_score": 0.86
    }
  ],
  "suggested_new": [
    {
      "word": "售票处",
      "pinyin": "shòu piào chù",
      "reason": "适合询问购票地点",
      "suggested_structure": "去 + 售票处 + 买票"
    }
  ]
}
```

---

### `POST /api/roleplay/scenarios/card-draft`

Generates a validated cloze-card draft without writing to the database.

```json
{
  "scenario_title": "买火车票",
  "scenario_description": "在车站购买车票。",
  "word": "车票",
  "pinyin": "chē piào"
}
```

`pinyin` is optional.

```json
{
  "answer": "车票",
  "answer_pinyin": "chē piào",
  "sentence": "我想买一张___。",
  "sentence_pinyin": "wǒ xiǎng mǎi yì zhāng chē piào",
  "context": "在车站买票。",
  "context_pinyin": "zài chē zhàn mǎi piào"
}
```

The returned `answer` always matches the requested word and `sentence` contains exactly one literal `___` marker. Generation, JSON parsing, or validation failures return `502` with `{"detail":"Unable to generate a valid card draft"}`.

---

## Module 6: Roleplay Engine (REST + WebSocket)

Roleplay reads flashcard SRS state for targeting but never modifies it. Attempts, hints, outcomes, and production difficulty are stored in roleplay-owned tables.

### `POST /api/roleplay/targets`

Selects up to three scenario-relevant focus words. Eligible flashcards have at least one review and either `difficulty_score >= 0.5` or `consecutive_failures > 0`. Any remaining slots are filled from the scenario's target words.

**Request Body**

```json
{
  "scenario_id": "444e4567-e89b-12d3-a456-426614174000"
}
```

**Response Body (200 OK)**

```json
{
  "focus_words": [
    {
      "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
      "word": "咖啡",
      "pinyin": "kā fēi",
      "sentence": "我想喝___。",
      "source": "flashcard"
    },
    {
      "flashcard_id": null,
      "word": "请",
      "pinyin": null,
      "sentence": null,
      "source": "scenario"
    }
  ]
}
```

---

### `POST /api/roleplay/start`

Starts a new roleplay session. Pulls high-difficulty tokens, selects scenario constraints, generates initial greeting.

* **HTTP Method:** `POST`
* **URL Endpoint:** `/api/roleplay/start`

**Request Body**

```json
{
  "scenario_id": "444e4567-e89b-12d3-a456-426614174000",
  "target_flashcard_ids": ["123e4567-e89b-12d3-a456-426614174000"],
  "scenario_target_words": ["请"]
}
```

`target_flashcard_ids` and `scenario_target_words` are optional arrays with at most three entries each. Omit both for server-side selection. Flashcard IDs must satisfy roleplay eligibility; scenario words must occur in the selected scenario's `target_grammar`, otherwise the server returns `422`.

**Response Body (200 OK)**

```json
{
  "session_id": "987fcdeb-51a2-43d7-9012-345678901234",
  "websocket_url": "ws://127.0.0.1:8000/api/roleplay/stream/987fcdeb-51a2-43d7-9012-345678901234",
  "scenario": {
    "id": "444e4567-e89b-12d3-a456-426614174000",
    "title": "在咖啡店",
    "description": "你在咖啡店点饮料，店员会询问杯型、温度和其他偏好。",
    "difficulty": "beginner",
    "target_grammar": ["咖啡", "要", "请"],
    "example_prompt": "你好，欢迎光临！",
    "created_at": "2026-07-19T10:00:00",
    "updated_at": "2026-07-19T10:00:00",
    "archived_at": null
  },
  "forced_tokens": ["咖啡", "要", "请"],
  "initial_greeting": {
    "text": "你好！欢迎光临。这是菜单，你想吃点什么？",
    "pinyin": "nǐ hǎo! huān yíng guāng lín...",
    "audio_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA..."
  }
}
```

---

### `WS /api/roleplay/stream/{session_id}`

Bidirectional, utterance-based conversational tunnel for an active roleplay session. The client sends one complete recording per turn; incremental audio streaming is not currently supported.

**Inbound Events (Client → Server)**

```json
{
  "event_type": "user_speech",
  "audio_chunk_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA...",
  "audio_mime_type": "audio/mp4"
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
  "ai_pinyin": "hǎo de, gěi nǐ cài dān.",
  "ai_audio_b64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA...",
  "difficulty_adjusted": null
}
```

```json
{
  "event_type": "hint_response",
  "hint_text": "试试使用“把”来造句。",
  "suggested_structure": "把 + 宾语 + 动词 + 补语"
}
```

```json
{
  "event_type": "error",
  "message": "没有听清楚，请再说一次。",
  "recoverable": true,
  "error_code": "INVALID_AUDIO"
}
```

---

### `POST /api/roleplay/end`

Closes the session, records its end time, returns the target summary, and frees in-memory resources.

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
  "message": "Session closed. 4 turns logged.",
  "session_summary": {
    "total_turns": 4,
    "tokens_forced": ["咖啡", "要", "请"],
    "tokens_passed": ["要", "请"],
    "tokens_failed": ["咖啡"],
    "targets": [
      {
        "id": "777e4567-e89b-12d3-a456-426614174000",
        "flashcard_id": "123e4567-e89b-12d3-a456-426614174000",
        "word": "咖啡",
        "source": "flashcard",
        "status": "failed",
        "attempts": 3,
        "hints_used": 1
      }
    ]
  }
}
```

Target statuses are `passed`, `failed`, or `unattempted` after end. A pending target with attempts becomes `failed`; a pending target with no attempts becomes `unattempted`. `tokens_forced`, `tokens_passed`, and `tokens_failed` remain for compatibility.

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
