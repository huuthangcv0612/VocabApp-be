# VocabApp Backend API Documentation

## 📋 Mục Lục
- [Cấu trúc 3 Tầng & Schema](#cấu-trúc-3-tầng--schema)
- [Các Endpoint API](#các-endpoint-api)
  - [1. Levels](#1-levels)
  - [2. Topics](#2-topics)
  - [3. Lektions](#3-lektions)
  - [4. Vocabularies](#4-vocabularies)
  - [5. User Progress (Tiến Trình Học)](#5-user-progress-tiến-trình-học)
- [Response Format](#response-format)
- [Ví dụ Sử Dụng](#ví-dụ-sử-dụng)

---

## 🏗️ Cấu trúc 3 Tầng & Schema

Hệ thống quản lý theo 3 tầng độc lập:

1. **Tầng 1 — Curriculum (Nội dung học dùng chung)**:
   - `levels`: Level cấp độ học (A1.1, A1.2, A2.1, B1,...).
   - `topics`: Chủ đề học (Familie, Essen, Reisen, Arbeit,...).
   - `lektions`: Bài học cụ thể. Thuộc 1 Level + 1 Topic (`level_id` + `topic_id`).
   - `vocabularies`: Danh sách từ vựng thực tế, thuộc một Lektion (`lektion_id`).

2. **Tầng 2 — Learning (Hoạt động học)**:
   - Flashcard / Quiz / Review theo Lektion (10–15 vocabularies).

3. **Tầng 3 — User Progress (Tiến trình của từng User)**:
   - `user_progress`: Lưu trạng thái học riêng biệt cho từng user (`user_id`, `lektion_id`, `status`, `progress`, `learned_vocabularies`).

---

## 📚 Các Endpoint API

### 1. Levels

#### GET `/api/levels`
Lấy tất cả các Level.

#### GET `/api/levels/:id`
Lấy thông tin Level theo ID hoặc tên cấp độ (ví dụ: `GET /api/levels/A1.1`).

#### GET `/api/levels/:levelId/topics`
Lấy danh sách các Topic thuộc một Level cụ thể (Ví dụ: `A1.1` có `Familie`, `Essen`, `Wohnen`).

---

### 2. Topics

#### GET `/api/topics`
Lấy tất cả các Topic.

#### GET `/api/topics/:id`
Lấy thông tin chi tiết một Topic theo ID.

#### GET `/api/topics/:topicId/lektions`
Lấy danh sách các Lektion thuộc Topic (có thể truyền thêm query parameter `levelId` / `level_id`).
- Hỗ trợ trả về trạng thái mở khóa bài học kiểu Duolingo (`isUnlocked`).

---

### 3. Lektions

#### GET `/api/lektions`
Lấy tất cả Lektion (Hỗ trợ query filter: `?levelId=...&topicId=...`).

#### GET `/api/lektions/:id`
Lấy Lektion theo ID.

#### GET `/api/lektions/level/:levelId`
Lấy danh sách Lektion theo Level ID.

#### GET `/api/lektions/topic/:topicId`
Lấy danh sách Lektion theo Topic ID.

---

### 4. Vocabularies

#### GET `/api/vocabularies/lektion/:lektionId`
Lấy danh sách 10–15 từ vựng của một Lektion.

#### GET `/api/vocabularies`
Lấy danh sách từ vựng (Hỗ trợ phân trang và tìm kiếm: `page`, `limit`, `lektionId`, `difficultyLevel`, `type`, `search`).

#### GET `/api/vocabularies/:id`
Lấy thông tin từ vựng theo ID.

---

### 5. User Progress (Tiến Trình Học)

*Yêu cầu Header:* `Authorization: Bearer <token>`

#### GET `/api/progress`
Lấy tổng quan tiến trình học của user trên toàn bộ hệ thống.

#### GET `/api/progress/lektion/:lektionId`
Lấy chi tiết tiến trình học của user đối với bài học `lektionId`.

#### POST `/api/progress/lektion/:lektionId/learn-word`
Đánh dấu một từ vựng đã học.
- **Body:** `{ "vocabulary_id": "<vocab_objectId>" }`

#### POST `/api/progress/lektion/:lektionId/complete`
Đánh dấu hoàn thành Lektion (Chuyển `status = "completed"`, `progress = 100%` và tự động mở khóa Lektion tiếp theo).

---

## 📤 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operated successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description"
}
```
