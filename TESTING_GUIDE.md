# 🧪 VocabApp Backend - Quick Testing Guide

Server running at: `http://localhost:3000`

---

## 1️⃣ Register New User

**Request**
```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "name": "Phạm Thanh",
  "email": "phamthanh@example.com",
  "password": "password123",
  "passwordConfirm": "password123"
}
```

**Expected Response (201)**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully.",
  "data": {
    "user": {
      "id": "user_id_here",
      "name": "Phạm Thanh",
      "email": "phamthanh@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

💾 **Save the token for next requests**

---

## 2️⃣ Login User

**Request**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "phamthanh@example.com",
  "password": "password123"
}
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged in successfully.",
  "data": {
    "user": {
      "id": "user_id_here",
      "name": "Phạm Thanh",
      "email": "phamthanh@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 3️⃣ Get Current User Profile

**Request**
```
GET http://localhost:3000/api/auth/me
Authorization: Bearer <your_token>
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User fetched successfully",
  "data": {
    "user": {
      "_id": "user_id",
      "name": "Phạm Thanh",
      "email": "phamthanh@example.com",
      "role": "user",
      "avatar": null,
      "isActive": true,
      "createdAt": "2024-05-27T08:50:00.000Z",
      "updatedAt": "2024-05-27T08:50:00.000Z"
    }
  }
}
```

---

## 4️⃣ Get All Vocabularies (Public)

**Request**
```
GET http://localhost:3000/api/vocabularies?page=1&limit=10
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Vocabularies fetched successfully",
  "data": {
    "vocabularies": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "pages": 0
    }
  }
}
```

---

## 5️⃣ Create Vocabulary (Admin Only)

**First: Promote User to Admin in MongoDB**

Connect to MongoDB:
```bash
mongo
use vocabapp
db.users.updateOne({email: "phamthanh@example.com"}, {$set: {role: "admin"}})
```

**Then: Create Vocabulary**

**Request**
```
POST http://localhost:3000/api/vocabularies
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "germanWord": "Haus",
  "vietnameseMeaning": "Nhà",
  "exampleSentence": {
    "german": "Das Haus ist groß.",
    "vietnamese": "Ngôi nhà rất lớn."
  },
  "topic": "Living",
  "difficultyLevel": "beginner",
  "pronunciation": "HOUS",
  "partOfSpeech": "noun"
}
```

**Expected Response (201)**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully.",
  "data": {
    "vocabulary": {
      "_id": "vocab_id",
      "germanWord": "Haus",
      "vietnameseMeaning": "Nhà",
      "topic": "Living",
      "difficultyLevel": "beginner",
      "createdBy": "user_id",
      "createdAt": "2024-05-27T08:52:00.000Z"
    }
  }
}
```

---

## 6️⃣ Search Vocabularies

**Request**
```
GET http://localhost:3000/api/vocabularies/search/Haus
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Search results",
  "data": {
    "vocabularies": [
      {
        "_id": "vocab_id",
        "germanWord": "Haus",
        "vietnameseMeaning": "Nhà",
        "topic": "Living"
      }
    ]
  }
}
```

---

## 7️⃣ Get Vocabulary by ID

**Request**
```
GET http://localhost:3000/api/vocabularies/vocab_id
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Vocabulary fetched successfully",
  "data": {
    "vocabulary": {
      "_id": "vocab_id",
      "germanWord": "Haus",
      "vietnameseMeaning": "Nhà",
      "topic": "Living",
      "difficultyLevel": "beginner",
      "createdBy": {
        "_id": "user_id",
        "name": "Phạm Thanh",
        "email": "phamthanh@example.com"
      }
    }
  }
}
```

---

## 8️⃣ Create Quiz (Admin Only)

**Request**
```
POST http://localhost:3000/api/quizzes
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "Greetings Quiz",
  "description": "Basic German greetings",
  "topic": "Greetings",
  "difficultyLevel": "beginner",
  "questions": [
    {
      "questionText": "How do you say hello in German?",
      "type": "multipleChoice",
      "options": [
        { "text": "Guten Tag", "isCorrect": true },
        { "text": "Auf Wiedersehen", "isCorrect": false },
        { "text": "Bitte", "isCorrect": false }
      ],
      "correctAnswer": "Guten Tag",
      "explanation": "Guten Tag means Good day"
    }
  ],
  "timeLimit": 60,
  "passingScore": 70
}
```

**Expected Response (201)**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Resource created successfully.",
  "data": {
    "quiz": {
      "_id": "quiz_id",
      "title": "Greetings Quiz",
      "topic": "Greetings",
      "totalQuestions": 1,
      "isPublished": false,
      "createdAt": "2024-05-27T08:54:00.000Z"
    }
  }
}
```

---

## 9️⃣ Get All Quizzes (Public - Only Published)

**Request**
```
GET http://localhost:3000/api/quizzes?page=1&limit=10
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Quizzes fetched successfully",
  "data": {
    "quizzes": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "pages": 0
    }
  }
}
```

---

## 🔟 Publish Quiz (Admin Only)

**Request**
```
PATCH http://localhost:3000/api/quizzes/quiz_id/publish
Authorization: Bearer <admin_token>
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Quiz published successfully",
  "data": {
    "quiz": {
      "_id": "quiz_id",
      "title": "Greetings Quiz",
      "isPublished": true
    }
  }
}
```

---

## 1️⃣1️⃣ Update User Profile

**Request**
```
PUT http://localhost:3000/api/users/profile
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "name": "Phạm Thanh Mới",
  "avatar": "https://example.com/avatar.jpg"
}
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile updated successfully.",
  "data": {
    "user": {
      "_id": "user_id",
      "name": "Phạm Thanh Mới",
      "avatar": "https://example.com/avatar.jpg"
    }
  }
}
```

---

## 1️⃣2️⃣ Change Password

**Request**
```
PUT http://localhost:3000/api/users/change-password
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "currentPassword": "password123",
  "newPassword": "newpassword456",
  "passwordConfirm": "newpassword456"
}
```

**Expected Response (200)**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password updated successfully.",
  "data": {}
}
```

---

## Admin Endpoints (Admin Only)

### Get All Users
```
GET http://localhost:3000/api/admin/users?page=1&limit=10
Authorization: Bearer <admin_token>
```

### Get Statistics
```
GET http://localhost:3000/api/admin/statistics
Authorization: Bearer <admin_token>
```

### Update User Role
```
PUT http://localhost:3000/api/admin/users/user_id/role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "admin"
}
```

### Delete User
```
DELETE http://localhost:3000/api/admin/users/user_id
Authorization: Bearer <admin_token>
```

### Toggle User Status
```
PATCH http://localhost:3000/api/admin/users/user_id/toggle-status
Authorization: Bearer <admin_token>
```

---

## 📝 Testing Tips

1. **Save Token**: In Postman/Thunder Client, save token as environment variable
   - In Thunder Client: Set `token` variable
   - In Postman: Set `pm_token` in environment

2. **Use Variables**: 
   - `Authorization: Bearer {{token}}`
   - `{{baseUrl}}/api/vocabularies`

3. **Check MongoDB**:
   ```bash
   mongo
   use vocabapp
   db.users.find()
   db.vocabularies.find()
   db.quizzes.find()
   ```

4. **Common Errors**:
   - `401 Unauthorized`: Invalid/expired token
   - `403 Forbidden`: Need admin role
   - `404 Not Found`: Resource doesn't exist
   - `409 Conflict`: Email already exists

---

## 🚀 Next Steps

1. ✅ Test all endpoints with Postman/Thunder Client
2. ✅ Verify data in MongoDB
3. ✅ Create frontend to consume these APIs
4. ✅ Deploy backend to production (Render, Railway, Heroku, etc.)

---

**Happy Testing! 🎉**
