# VocabApp Backend API Documentation

## 📋 Mục Lục
- [Cấu hình cơ bản](#cấu-hình-cơ-bản)
- [Các Endpoint API](#các-endpoint-api)
  - [Levels](#levels)
  - [Lektions](#lektions)
  - [Vocabulary](#vocabulary)
- [Response Format](#response-format)
- [Ví dụ Sử Dụng](#ví-dụ-sử-dụng)

---

## 🚀 Cấu hình cơ bản

**Base URL:** `http://localhost:3001/api`

**Headers (cho tất cả request):**
```
Content-Type: application/json
```

---

## 📚 Các Endpoint API

### Levels

#### 1. Lấy tất cả Level
```http
GET /api/levels
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "level_name": "Beginner",
      "description": "Cấp độ bắt đầu",
      "order": 1,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "level_name": "Intermediate",
      "description": "Cấp độ trung bình",
      "order": 2,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 2. Lấy Level theo ID
```http
GET /api/levels/:id
```

**Parameters:**
- `id` (string) - MongoDB ID của Level

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "level_name": "Beginner",
    "description": "Cấp độ bắt đầu",
    "order": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Level not found"
}
```

#### 3. Lấy Level theo tên
```http
GET /api/levels/name/:name
```

**Parameters:**
- `name` (string) - Tên của Level (exact match)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "level_name": "Beginner",
    "description": "Cấp độ bắt đầu",
    "order": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Lektions

#### 1. Lấy tất cả Lektion
```http
GET /api/lektions
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439021",
      "level_id": {
        "_id": "507f1f77bcf86cd799439011",
        "level_name": "Beginner"
      },
      "lekttion_name": "Hello and Greetings",
      "description": "Học cách chào hỏi",
      "order": 1,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 2. Lấy Lektion theo ID
```http
GET /api/lektions/:id
```

**Parameters:**
- `id` (string) - MongoDB ID của Lektion

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439021",
    "level_id": {
      "_id": "507f1f77bcf86cd799439011",
      "level_name": "Beginner"
    },
    "lekttion_name": "Hello and Greetings",
    "description": "Học cách chào hỏi",
    "order": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### 3. Lấy Lektion theo Level ID
```http
GET /api/lektions/level/:levelId
```

**Parameters:**
- `levelId` (string) - MongoDB ID của Level

**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439021",
      "level_id": {
        "_id": "507f1f77bcf86cd799439011",
        "level_name": "Beginner"
      },
      "lekttion_name": "Hello and Greetings",
      "description": "Học cách chào hỏi",
      "order": 1,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### Vocabulary

#### 1. Lấy tất cả từ vựng
```http
GET /api/vocabulary
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439031",
      "lektionId": {
        "_id": "507f1f77bcf86cd799439021",
        "lekttion_name": "Hello and Greetings"
      },
      "word": "Hello",
      "type": "noun",
      "meaning": "Lời chào",
      "example": "Hello, how are you?",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 2. Lấy từ vựng theo ID
```http
GET /api/vocabulary/:id
```

**Parameters:**
- `id` (string) - MongoDB ID của từ vựng

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439031",
    "lektionId": {
      "_id": "507f1f77bcf86cd799439021",
      "lekttion_name": "Hello and Greetings"
    },
    "word": "Hello",
    "type": "noun",
    "meaning": "Lời chào",
    "example": "Hello, how are you?",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### 3. Lấy từ vựng theo Lektion ID
```http
GET /api/vocabulary/lektion/:lektionId
```

**Parameters:**
- `lektionId` (string) - MongoDB ID của Lektion

**Response (200 OK):**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439031",
      "lektionId": {
        "_id": "507f1f77bcf86cd799439021",
        "lekttion_name": "Hello and Greetings"
      },
      "word": "Hello",
      "type": "noun",
      "meaning": "Lời chào",
      "example": "Hello, how are you?",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 4. Tìm kiếm từ vựng
```http
GET /api/vocabulary/search?q=hello
```

**Query Parameters:**
- `q` (string) - Từ khóa tìm kiếm (tìm trong word và meaning)

**Response (200 OK):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439031",
      "word": "Hello",
      "type": "noun",
      "meaning": "Lời chào",
      "lektionId": {
        "_id": "507f1f77bcf86cd799439021",
        "lekttion_name": "Hello and Greetings"
      }
    }
  ]
}
```

#### 5. Lấy từ vựng theo loại (type)
```http
GET /api/vocabulary/type/:type
```

**Parameters:**
- `type` (string) - Loại từ: `noun`, `verb`, `adjective`, `adverb`, `other`

**Response (200 OK):**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439031",
      "word": "Hello",
      "type": "noun",
      "meaning": "Lời chào",
      "lektionId": {
        "_id": "507f1f77bcf86cd799439021",
        "lekttion_name": "Hello and Greetings"
      }
    }
  ]
}
```

---

## 📤 Response Format

### Success Response
```json
{
  "success": true,
  "count": <number>,      // (optional) số lượng kết quả
  "data": <object|array>  // dữ liệu trả về
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

**HTTP Status Codes:**
- `200 OK` - Request thành công
- `404 Not Found` - Không tìm thấy resource
- `500 Internal Server Error` - Lỗi server

---

## 💻 Ví dụ Sử Dụng

### JavaScript/Fetch

#### Lấy tất cả Level
```javascript
fetch('http://localhost:3001/api/levels')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

#### Lấy Lektion theo Level ID
```javascript
const levelId = '507f1f77bcf86cd799439011';
fetch(`http://localhost:3001/api/lektions/level/${levelId}`)
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

#### Tìm kiếm từ vựng
```javascript
const keyword = 'hello';
fetch(`http://localhost:3001/api/vocabulary/search?q=${keyword}`)
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

### React Example

```javascript
import { useState, useEffect } from 'react';

function LevelList() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/levels');
        const result = await response.json();
        if (result.success) {
          setLevels(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLevels();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Levels</h1>
      <ul>
        {levels.map(level => (
          <li key={level._id}>{level.level_name}</li>
        ))}
      </ul>
    </div>
  );
}

export default LevelList;
```

### Axios Example

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// Lấy tất cả vocabularies
async function getAllVocabularies() {
  try {
    const response = await axios.get(`${API_BASE_URL}/vocabulary`);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

// Lấy vocabulary theo Lektion ID
async function getVocabulariesByLektion(lektionId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/vocabulary/lektion/${lektionId}`
    );
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

// Tìm kiếm vocabulary
async function searchVocabularies(keyword) {
  try {
    const response = await axios.get(`${API_BASE_URL}/vocabulary/search`, {
      params: { q: keyword }
    });
    return response.data;
  } catch (error) {
    console.error(error);
  }
}
```

---

## ⚠️ Ghi Chú Quan Trọng

1. **CORS**: Nếu frontend chạy trên domain khác, cần cấu hình CORS trong backend
2. **Pagination**: Hiện tại không hỗ trợ, có thể thêm sau
3. **Authentication**: Các API hiện đang mở, nên thêm auth nếu cần bảo mật
4. **Rate Limiting**: Nên thêm rate limiting cho production

---

## 🔧 Cách Bắt Đầu

### Backend
```bash
# Cài đặt dependencies
npm install

# Chạy development server
npm run dev

# hoặc chạy production
npm start
```

Backend sẽ chạy trên: `http://localhost:3001`

### Testing API
Sử dụng Postman hoặc Insomnia để test các endpoint. Import collection từ file hoặc tạo mới.

---

Nếu có câu hỏi hoặc muốn thêm/sửa đổi API, vui lòng liên hệ!
