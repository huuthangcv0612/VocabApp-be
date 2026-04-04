# 📱 Hướng Dẫn Sử Dụng API cho Frontend

## 🎯 Mục Đích
Hướng dẫn này giúp Frontend developers hiểu cách sử dụng các API của VocabApp backend để xây dựng giao diện người dùng.

---

## 🌐 Base URL
```
http://localhost:3001/api
```

---

## 📋 Quick Reference

| Endpoint | Mô Tả | Method |
|----------|-------|--------|
| `/levels` | Lấy tất cả Level | GET |
| `/levels/:id` | Lấy Level theo ID | GET |
| `/levels/name/:name` | Lấy Level theo tên | GET |
| `/lektions` | Lấy tất cả Lektion | GET |
| `/lektions/:id` | Lấy Lektion theo ID | GET |
| `/lektions/level/:levelId` | Lấy Lektion của 1 Level | GET |
| `/vocabulary` | Lấy tất cả từ vựng | GET |
| `/vocabulary/:id` | Lấy từ vựng theo ID | GET |
| `/vocabulary/lektion/:lektionId` | Lấy từ vựng của 1 Lektion | GET |
| `/vocabulary/search?q=keyword` | Tìm kiếm từ vựng | GET |
| `/vocabulary/type/:type` | Lấy từ vựng theo loại | GET |

---

## 🚀 Use Cases Thông Dụng

### 1️⃣ Hiển thị danh sách tất cả Level

**Khi nào dùng:** Trang chủ, màn hình chọn cấp độ

**API Call:**
```javascript
GET /api/levels
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "level_name": "Beginner",
      "description": "Cấp độ bắt đầu",
      "order": 1
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "level_name": "Intermediate",
      "description": "Cấp độ trung bình",
      "order": 2
    }
  ]
}
```

**Component Example (React):**
```javascript
import { useEffect, useState } from 'react';

export function LevelSelector() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/levels');
        const result = await res.json();
        
        if (result.success) {
          setLevels(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch levels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLevels();
  }, []);

  if (loading) return <p>Đang tải...</p>;

  return (
    <div className="level-selector">
      {levels.map(level => (
        <div key={level._id} className="level-card">
          <h3>{level.level_name}</h3>
          <p>{level.description}</p>
        </div>
      ))}
    </div>
  );
}
```

---

### 2️⃣ Hiển thị bài học của một Level

**Khi nào dùng:** Sau khi chọn Level, hiển thị danh sách bài học

**API Call:**
```javascript
GET /api/lektions/level/{levelId}
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439021",
      "lekttion_name": "Hello and Greetings",
      "description": "Học cách chào hỏi",
      "order": 1,
      "level_id": {
        "_id": "507f1f77bcf86cd799439011",
        "level_name": "Beginner"
      }
    }
  ]
}
```

**Component Example (React):**
```javascript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export function LektionList() {
  const { levelId } = useParams();
  const [lektions, setLektions] = useState([]);

  useEffect(() => {
    const fetchLektions = async () => {
      const res = await fetch(
        `http://localhost:3001/api/lektions/level/${levelId}`
      );
      const result = await res.json();
      
      if (result.success) {
        setLektions(result.data);
      }
    };

    if (levelId) {
      fetchLektions();
    }
  }, [levelId]);

  return (
    <div className="lektion-list">
      {lektions.map(lektion => (
        <div key={lektion._id} className="lektion-card">
          <h4>{lektion.lekttion_name}</h4>
          <p>{lektion.description}</p>
          <a href={`/lektion/${lektion._id}`}>Học bài</a>
        </div>
      ))}
    </div>
  );
}
```

---

### 3️⃣ Hiển thị từ vựng của một Lektion

**Khi nào dùng:** Trang học từ vựng của bài học

**API Call:**
```javascript
GET /api/vocabulary/lektion/{lektionId}
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439031",
      "word": "Hello",
      "type": "noun",
      "meaning": "Lời chào",
      "example": "Hello, how are you?",
      "lektionId": {
        "_id": "507f1f77bcf86cd799439021",
        "lekttion_name": "Hello and Greetings"
      }
    }
  ]
}
```

**Component Example (React):**
```javascript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export function VocabularyLesson() {
  const { lektionId } = useParams();
  const [vocabularies, setVocabularies] = useState([]);

  useEffect(() => {
    const fetchVocab = async () => {
      const res = await fetch(
        `http://localhost:3001/api/vocabulary/lektion/${lektionId}`
      );
      const result = await res.json();
      
      if (result.success) {
        setVocabularies(result.data);
      }
    };

    if (lektionId) {
      fetchVocab();
    }
  }, [lektionId]);

  return (
    <div className="vocabulary-lesson">
      {vocabularies.map(vocab => (
        <div key={vocab._id} className="vocab-card">
          <h3>{vocab.word}</h3>
          <p><strong>Loại:</strong> {vocab.type}</p>
          <p><strong>Nghĩa:</strong> {vocab.meaning}</p>
          {vocab.example && <p><strong>Ví dụ:</strong> {vocab.example}</p>}
        </div>
      ))}
    </div>
  );
}
```

---

### 4️⃣ Tìm kiếm từ vựng

**Khi nào dùng:** Trang tìm kiếm, thanh search

**API Call:**
```javascript
GET /api/vocabulary/search?q=hello
```

**Response:**
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

**Component Example (React):**
```javascript
import { useState } from 'react';

export function SearchVocabulary() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!keyword.trim()) return;

    const res = await fetch(
      `http://localhost:3001/api/vocabulary/search?q=${keyword}`
    );
    const result = await res.json();
    
    if (result.success) {
      setResults(result.data);
      setSearched(true);
    }
  };

  return (
    <div className="search-vocabulary">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Tìm kiếm từ vựng..."
        />
        <button type="submit">Tìm kiếm</button>
      </form>

      {searched && (
        <div className="search-results">
          <p>Tìm thấy {results.length} kết quả</p>
          {results.map(vocab => (
            <div key={vocab._id} className="result-item">
              <h4>{vocab.word}</h4>
              <p>{vocab.meaning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 5️⃣ API Service dengan Axios

**Khi nào dùng:** Tổ chức code tốt hơn, dễ bảo trì

**File: `services/api.js`**
```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Levels
export const levelAPI = {
  getAll: () => apiClient.get('/levels'),
  getById: (id) => apiClient.get(`/levels/${id}`),
  getByName: (name) => apiClient.get(`/levels/name/${name}`)
};

// Lektions
export const lektionAPI = {
  getAll: () => apiClient.get('/lektions'),
  getById: (id) => apiClient.get(`/lektions/${id}`),
  getByLevelId: (levelId) => apiClient.get(`/lektions/level/${levelId}`)
};

// Vocabularies
export const vocabularyAPI = {
  getAll: () => apiClient.get('/vocabulary'),
  getById: (id) => apiClient.get(`/vocabulary/${id}`),
  getByLektionId: (lektionId) => 
    apiClient.get(`/vocabulary/lektion/${lektionId}`),
  search: (keyword) => 
    apiClient.get(`/vocabulary/search?q=${keyword}`),
  getByType: (type) => 
    apiClient.get(`/vocabulary/type/${type}`)
};

export default apiClient;
```

**Sử dụng trong Component:**
```javascript
import { levelAPI, lektionAPI, vocabularyAPI } from './services/api';

// Lấy tất cả Level
const { data } = await levelAPI.getAll();

// Lấy Lektion của Level
const { data } = await lektionAPI.getByLevelId('507f1f77bcf86cd799439011');

// Tìm kiếm từ vựng
const { data } = await vocabularyAPI.search('hello');
```

---

## ⚙️ Cấu hình Environment

**File: `.env`** (Frontend)
```env
REACT_APP_API_BASE_URL=http://localhost:3001/api
```

**Sử dụng:**
```javascript
const API_BASE = process.env.REACT_APP_API_BASE_URL;

const res = await fetch(`${API_BASE}/levels`);
```

---

## 🔄 Error Handling

**Tất cả API có thể trả về error:**
```json
{
  "success": false,
  "error": "Level not found"
}
```

**Best Practice Error Handling:**
```javascript
async function fetchData(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    // Kiểm tra success flag
    if (!data.success) {
      throw new Error(data.error);
    }
    
    return data.data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}
```

---

## 📝 Data Types

### Level
```javascript
{
  _id: string,              // MongoDB ID
  level_name: string,       // Tên level
  description: string,      // Mô tả
  order: number,           // Thứ tự
  createdAt: ISO8601,      // Thời gian tạo
  updatedAt: ISO8601       // Thời gian cập nhật
}
```

### Lektion
```javascript
{
  _id: string,              // MongoDB ID
  level_id: ObjectRef,      // Reference tới Level
  lekttion_name: string,    // Tên bài học
  description: string,      // Mô tả
  order: number,           // Thứ tự
  createdAt: ISO8601,
  updatedAt: ISO8601
}
```

### Vocabulary
```javascript
{
  _id: string,              // MongoDB ID
  lektionId: ObjectRef,     // Reference tới Lektion
  word: string,            // Từ tiếng Anh
  type: enum,              // noun, verb, adjective, adverb, other
  meaning: string,         // Nghĩa tiếng Việt
  example: string|null,    // Ví dụ (optional)
  createdAt: ISO8601,
  updatedAt: ISO8601
}
```

---

## 🧪 Testing API

### Postman Collection Template

```json
{
  "info": {
    "name": "VocabApp API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get All Levels",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/levels"
      }
    },
    {
      "name": "Get Lektions by Level",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/lektions/level/{{levelId}}"
      }
    },
    {
      "name": "Search Vocabulary",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/vocabulary/search?q=hello"
      }
    }
  ]
}
```

---

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra Backend đang chạy trên `http://localhost:3001`
2. Xem logs trong terminal backend
3. Kiểm tra response status code
4. Kiểm tra format request/response

---

**Happy Coding! 🎉**
