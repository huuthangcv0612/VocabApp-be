# VocabApp Backend API Contract Document

> **Architecture Flow**: `LEVEL → LESSON → EXERCISE`  
> **Base URL**: `http://localhost:3001/api` (Local) / `https://<your-domain>/api` (Production)  
> **Content-Type**: `application/json`

---

## 1. Data Architecture Summary

```text
USER FLOW:
Level  ──>  Lesson  ──>  Exercise

DATA MODEL RELATIONSHIPS:
Level
 ├── Vocabulary (level_id)
 │
 └── Lesson (level_id)
       │
       ├── Unit (unit_id)
       │     └── Topic (topic_id)
       │
       └── Exercise (lesson_id)
              └── Vocabulary (vocabulary_id)
```

---

## 2. Standard Response & Error Format

### ✅ Success Response Structure
```json
{
  "success": true,
  "message": "Lessons fetched successfully",
  "data": { ... }
}
```

### ❌ Error Response Structure
```json
{
  "success": false,
  "message": "Error message description",
  "errors": []
}
```

### ⚠️ Common Error Codes
- **400 Bad Request**: Invalid ID format (e.g. `"Invalid Level ID"`, `"Invalid Lesson ID"`).
- **401 Unauthorized**: Missing or invalid Auth Token.
- **403 Forbidden**: Resource requires Admin role.
- **404 Not Found**: Resource not found (e.g. `"Level not found"`, `"Lesson not found"`).
- **500 Internal Server Error**: Server processing error.

---

## 3. API Endpoints Specification

### 🟢 LEVEL API (`/api/levels`)

#### 1. Get All Levels
- **Method**: `GET`
- **Path**: `/api/levels`
- **Access**: Public
- **Response**:
```json
{
  "success": true,
  "message": "Levels fetched successfully",
  "data": {
    "levels": [
      {
        "_id": "65a000000000000000000001",
        "level_name": "A1.1",
        "description": "Beginner Level 1",
        "order": 1,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

#### 2. Get Level Details by ID or Name
- **Method**: `GET`
- **Path**: `/api/levels/:id`
- **Access**: Public
- **Params**: `:id` (Level ObjectId or level_name, e.g. `A1.1`)
- **Response**:
```json
{
  "success": true,
  "message": "Level fetched successfully",
  "data": {
    "level": {
      "_id": "65a000000000000000000001",
      "level_name": "A1.1",
      "description": "Beginner Level 1",
      "order": 1
    }
  }
}
```

---

### 🟢 LESSON API (`/api/lessons`)

#### 1. Get Lessons by Level (Primary User Flow)
- **Method**: `GET`
- **Path**: `/api/lessons`
- **Access**: Public
- **Query Parameters**:
  - `level_id` *(optional, ObjectId)*: Filter lessons belonging to level. (Alias: `levelId`)
  - `unit_id` *(optional, ObjectId)*: Filter lessons belonging to unit.
  - `status` *(optional, string)*: `'published'` or `'draft'`
- **Example Request**: `GET /api/lessons?level_id=65a000000000000000000001`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Lessons fetched successfully",
  "data": {
    "lessons": [
      {
        "_id": "65a000000000000000000010",
        "level_id": {
          "_id": "65a000000000000000000001",
          "level_name": "A1.1",
          "description": "Beginner Level 1",
          "order": 1
        },
        "unit_id": {
          "_id": "65a000000000000000000005",
          "title": "Begrüßung & Vorstellung",
          "slug": "begrussung-vorstellung"
        },
        "title": "Familienmitglieder",
        "slug": "familienmitglieder",
        "description": "Học về các thành viên trong gia đình",
        "order": 1,
        "status": "published",
        "estimated_minutes": 5,
        "xp": 20,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```
- **Error Responses**:
  - **400 Bad Request** (Invalid `level_id` ObjectId):
    ```json
    {
      "success": false,
      "message": "Invalid Level ID",
      "errors": []
    }
    ```
  - **404 Not Found** (Level does not exist):
    ```json
    {
      "success": false,
      "message": "Level not found",
      "errors": []
    }
    ```

#### 2. Get Lesson Details (Includes Vocabularies & Exercises Preview)
- **Method**: `GET`
- **Path**: `/api/lessons/:id`
- **Access**: Public
- **Params**: `:id` (Lesson ObjectId or `slug`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Lesson fetched successfully",
  "data": {
    "lesson": {
      "_id": "65a000000000000000000010",
      "level_id": {
        "_id": "65a000000000000000000001",
        "level_name": "A1.1"
      },
      "unit_id": {
        "_id": "65a000000000000000000005",
        "title": "Begrüßung"
      },
      "title": "Familienmitglieder",
      "slug": "familienmitglieder",
      "description": "Học từ vựng gia đình",
      "order": 1,
      "status": "published",
      "estimated_minutes": 5,
      "xp": 20
    },
    "preview": {
      "vocabularies": [
        {
          "_id": "65a000000000000000000020",
          "word": "die Mutter",
          "meaning": "mẹ",
          "part_of_speech": "noun",
          "order": 1,
          "is_new": true
        }
      ]
    },
    "exercises": [
      {
        "_id": "65a000000000000000000030",
        "lesson_id": "65a000000000000000000010",
        "type": "multiple_choice",
        "order": 1,
        "content": {
          "question": "Nghĩa của 'die Mutter' là gì?",
          "options": ["mẹ", "bố", "anh trai"]
        },
        "xp": 2
      }
    ]
  }
}
```

#### 3. Create Lesson (Admin)
- **Method**: `POST`
- **Path**: `/api/lessons`
- **Access**: Private / Admin (`Authorization: Bearer <admin-token>`)
- **Request Body**:
```json
{
  "level_id": "65a000000000000000000001",
  "unit_id": "65a000000000000000000005",
  "title": "Familienmitglieder",
  "slug": "familienmitglieder",
  "description": "Mô tả bài học",
  "order": 1,
  "status": "published",
  "estimated_minutes": 5,
  "xp": 20
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Lesson created successfully",
  "data": {
    "lesson": {
      "_id": "65a000000000000000000010",
      "level_id": "65a000000000000000000001",
      "unit_id": "65a000000000000000000005",
      "title": "Familienmitglieder",
      "order": 1
    }
  }
}
```

#### 4. Update Lesson (Admin)
- **Method**: `PUT`
- **Path**: `/api/lessons/:id`
- **Access**: Private / Admin
- **Request Body**:
```json
{
  "level_id": "65a000000000000000000001",
  "title": "Familienmitglieder (Updated)",
  "order": 2
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Lesson updated successfully",
  "data": {
    "lesson": {
      "_id": "65a000000000000000000010",
      "level_id": "65a000000000000000000001",
      "title": "Familienmitglieder (Updated)",
      "order": 2
    }
  }
}
```

#### 5. Delete Lesson (Admin)
- **Method**: `DELETE`
- **Path**: `/api/lessons/:id`
- **Access**: Private / Admin
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Lesson deleted successfully",
  "data": {
    "deletedId": "65a000000000000000000010"
  }
}
```

---

### 🟢 EXERCISE API (`/api/exercises`)

#### 1. Get Exercises by Lesson ID
- **Method**: `GET`
- **Path**: `/api/exercises` (hoặc `/api/exercises/lesson/:lessonId`)
- **Access**: Public
- **Query Parameters**: `lesson_id` *(ObjectId)*
- **Example Request**: `GET /api/exercises?lesson_id=65a000000000000000000010`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Exercises fetched successfully",
  "data": {
    "exercises": [
      {
        "_id": "65a000000000000000000030",
        "lesson_id": "65a000000000000000000010",
        "type": "multiple_choice",
        "order": 1,
        "content": {
          "question": "Nghĩa của 'die Mutter' là gì?",
          "options": ["mẹ", "bố", "anh trai"]
        },
        "vocabulary_id": {
          "_id": "65a000000000000000000020",
          "word": "die Mutter",
          "meaning": "mẹ"
        },
        "xp": 2
      }
    ],
    "count": 1
  }
}
```
- **Error Responses**:
  - **400 Bad Request** (Invalid `lesson_id` ObjectId):
    ```json
    {
      "success": false,
      "message": "Invalid Lesson ID",
      "errors": []
    }
    ```

---

### 🟢 VOCABULARY API (`/api/vocabularies`)

#### 1. Get Vocabularies by Level / Query Filters
- **Method**: `GET`
- **Path**: `/api/vocabularies`
- **Access**: Public
- **Query Parameters**:
  - `level_id` *(optional, ObjectId)*: Filter by Level.
  - `difficultyLevel` *(optional, string)*: `'A1'`, `'A2'`, `'B1'`.
  - `type` *(optional, string)*: `'noun'`, `'verb'`, `'adjective'`.
  - `search` *(optional, string)*: Keyword search across word, meaning, example.
  - `page` *(optional, number, default: 1)*
  - `limit` *(optional, number, default: 20)*
- **Example Request**: `GET /api/vocabularies?level_id=65a000000000000000000001&page=1&limit=20`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Vocabularies fetched successfully",
  "data": {
    "vocabularies": [
      {
        "_id": "65a000000000000000000020",
        "word": "die Mutter",
        "article": "die",
        "plural": "die Mütter",
        "type": "noun",
        "part_of_speech": "noun",
        "meaning": "mẹ",
        "pronunciation": "/ˈmʊtɐ/",
        "example": "Das ist meine Mutter.",
        "translation": "Đó là mẹ của tôi.",
        "level_id": "65a000000000000000000001",
        "difficultyLevel": "A1",
        "level": "A1"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

### 🟢 USER PROGRESS & TRACKING API (`/api/progress`)

> 🔒 **Requires Header**: `Authorization: Bearer <user-jwt-token>`

#### 1. Get Progress Overview
- **Method**: `GET`
- **Path**: `/api/progress`
- **Access**: Private (User)
- **Response**:
```json
{
  "success": true,
  "message": "User progress fetched successfully",
  "data": {
    "lessonProgresses": [
      {
        "_id": "65a000000000000000000040",
        "user_id": "65a000000000000000000099",
        "lesson_id": {
          "_id": "65a000000000000000000010",
          "title": "Familienmitglieder",
          "level_id": {
            "_id": "65a000000000000000000001",
            "level_name": "A1.1"
          }
        },
        "status": "in_progress",
        "progress": 50,
        "xp_earned": 10,
        "started_at": "2026-08-26T10:00:00.000Z"
      }
    ],
    "stats": {
      "completedLessonsCount": 0,
      "totalLearnedWordsCount": 5
    }
  }
}
```

#### 2. Get Single Lesson Progress Tracking
- **Method**: `GET`
- **Path**: `/api/progress/lessons/:lessonId`
- **Access**: Private (User)
- **Params**: `:lessonId` (Lesson ObjectId)
- **Response**:
```json
{
  "success": true,
  "message": "Lesson progress fetched successfully",
  "data": {
    "lessonProgress": {
      "user_id": "65a000000000000000000099",
      "lesson_id": "65a000000000000000000010",
      "status": "in_progress",
      "progress": 50,
      "xp_earned": 4,
      "started_at": "2026-08-26T10:00:00.000Z"
    },
    "exerciseProgresses": [
      {
        "_id": "65a000000000000000000050",
        "exercise_id": "65a000000000000000000030",
        "lesson_id": "65a000000000000000000010",
        "is_correct": true,
        "attempts": 1
      }
    ]
  }
}
```

#### 3. Start Learning a Lesson
- **Method**: `POST`
- **Path**: `/api/progress/lessons/:lessonId/start`
- **Access**: Private (User)
- **Response**:
```json
{
  "success": true,
  "message": "Lesson learning started",
  "data": {
    "lessonProgress": {
      "user_id": "65a000000000000000000099",
      "lesson_id": "65a000000000000000000010",
      "status": "in_progress",
      "progress": 0,
      "started_at": "2026-08-26T10:00:00.000Z"
    }
  }
}
```

#### 4. Submit Exercise & Auto-Update Lesson Progress
- **Method**: `POST`
- **Path**: `/api/progress/lessons/:lessonId/submit-exercise`
- **Access**: Private (User)
- **Request Body**:
```json
{
  "exercise_id": "65a000000000000000000030",
  "answer": "mẹ"
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Exercise answer evaluated and progress updated",
  "data": {
    "is_correct": true,
    "xp_earned": 2,
    "exerciseProgress": {
      "_id": "65a000000000000000000050",
      "exercise_id": "65a000000000000000000030",
      "lesson_id": "65a000000000000000000010",
      "is_correct": true,
      "attempts": 1
    },
    "lessonProgress": {
      "user_id": "65a000000000000000000099",
      "lesson_id": "65a000000000000000000010",
      "status": "in_progress",
      "progress": 50,
      "xp_earned": 2
    }
  }
}
```

#### 5. Complete Lesson Progress & Unlock Next Lesson
- **Method**: `POST`
- **Path**: `/api/progress/lessons/:lessonId/complete`
- **Access**: Private (User)
- **Response**:
```json
{
  "success": true,
  "message": "Lesson marked as completed",
  "data": {
    "lessonProgress": {
      "user_id": "65a000000000000000000099",
      "lesson_id": "65a000000000000000000010",
      "status": "completed",
      "progress": 100,
      "xp_earned": 20,
      "completed_at": "2026-08-26T10:05:00.000Z"
    },
    "nextLesson": {
      "_id": "65a000000000000000000011",
      "title": "Berufe (Nghề nghiệp)",
      "order": 2,
      "level_id": "65a000000000000000000001"
    }
  }
}
```
