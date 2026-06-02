# VocabApp Backend - Professional Architecture

A production-ready backend for a German vocabulary learning application built with **Node.js, Express, MongoDB, Mongoose, and JWT Authentication**.

## 🚀 Features

✅ **User Management**
- User registration and login with bcrypt password hashing
- JWT-based authentication
- Role-based access control (User/Admin)
- User profile management

✅ **Vocabulary Management**
- CRUD operations for German vocabulary
- Topic-based organization
- Difficulty level classification
- Search functionality
- Admin-only creation/modification

✅ **Quiz Management**
- Quiz creation with multiple question types
- Published/Unpublished state management
- Difficulty levels and time limits
- Admin dashboard for quiz management

✅ **Admin Dashboard**
- User management (view, delete, role assignment, activate/deactivate)
- Statistics dashboard (total users, vocabularies, quizzes)
- System analytics

✅ **Architecture**
- MVC pattern with clean separation of concerns
- Centralized error handling
- Async error wrapper for controllers
- ES Modules for modern JavaScript
- CORS enabled
- Pagination support

## 📁 Project Structure

```
src/
├── config/
│   └── db.js                    # MongoDB connection
├── controllers/
│   ├── authController.js        # Authentication logic
│   ├── userController.js        # User profile management
│   ├── vocabularyController.js  # Vocabulary CRUD
│   ├── quizController.js        # Quiz management
│   └── adminController.js       # Admin operations
├── middlewares/
│   ├── authMiddleware.js        # JWT verification
│   ├── adminMiddleware.js       # Admin authorization
│   └── errorMiddleware.js       # Centralized error handling
├── models/
│   ├── User.js                  # User schema
│   ├── Vocabulary.js            # Vocabulary schema
│   └── Quiz.js                  # Quiz schema
├── routes/
│   ├── authRoutes.js            # Auth endpoints
│   ├── userRoutes.js            # User endpoints
│   ├── vocabularyRoutes.js      # Vocabulary endpoints
│   ├── quizRoutes.js            # Quiz endpoints
│   └── adminRoutes.js           # Admin endpoints
├── utils/
│   ├── asyncHandler.js          # Async error wrapper
│   ├── errorHandler.js          # Error utilities
│   ├── responseHandler.js       # Response formatter
│   └── constants.js             # App constants
├── app.js                       # Express app setup
└── server.js                    # Server entry point

.env.example                      # Environment variables template
package.json                      # Dependencies and scripts
```

## 🛠️ Installation

### Prerequisites
- Node.js v16+ 
- MongoDB locally or MongoDB Atlas connection string

### Setup

1. **Clone and install dependencies**
```bash
npm install
```

2. **Create `.env` file** (copy from `.env.example`)
```bash
cp .env.example .env
```

3. **Configure environment variables**
```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/vocabapp
JWT_SECRET=your_secure_jwt_secret_key
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
OPENAI_API_KEY=your_openai_key (optional)
```

4. **Start the server**
```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:3000`

## 📚 API Documentation

### Health Check
```
GET / - Server status
GET /health - Health status
```

---

### 🔐 Authentication Endpoints

#### Register
```
POST /api/auth/register

Body:
{
  "name": "Thang Nguyen",
  "email": "user@example.com",
  "password": "password123",
  "passwordConfirm": "password123"
}

Response (201):
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "user": {
      "id": "user_id",
      "name": "Thang Nguyen",
      "email": "user@example.com",
      "role": "user"
    },
    "token": "jwt_token"
  }
}
```

#### Login
```
POST /api/auth/login

Body:
{
  "email": "user@example.com",
  "password": "password123"
}

Response (200):
{
  "success": true,
  "message": "Logged in successfully.",
  "data": {
    "user": {
      "id": "user_id",
      "name": "Thang Nguyen",
      "email": "user@example.com",
      "role": "user"
    },
    "token": "jwt_token"
  }
}
```

#### Get Current User
```
GET /api/auth/me

Headers:
{
  "Authorization": "Bearer jwt_token"
}

Response (200): User object
```

---

### 👤 User Endpoints

#### Get Profile
```
GET /api/users/profile

Headers:
{
  "Authorization": "Bearer jwt_token"
}

Response (200): User profile
```

#### Update Profile
```
PUT /api/users/profile

Headers:
{
  "Authorization": "Bearer jwt_token"
}

Body:
{
  "name": "New Name",
  "avatar": "url_to_avatar"
}

Response (200): Updated user
```

#### Change Password
```
PUT /api/users/change-password

Headers:
{
  "Authorization": "Bearer jwt_token"
}

Body:
{
  "currentPassword": "old_password",
  "newPassword": "new_password",
  "passwordConfirm": "new_password"
}

Response (200): Success message
```

---

### 📖 Vocabulary Endpoints

#### Get All Vocabularies
```
GET /api/vocabularies?page=1&limit=10

Response (200):
{
  "success": true,
  "message": "Vocabularies fetched successfully",
  "data": {
    "vocabularies": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

#### Get Vocabulary by ID
```
GET /api/vocabularies/:id

Response (200): Vocabulary object
```

#### Search Vocabularies
```
GET /api/vocabularies/search/:query

Example: /api/vocabularies/search/haus

Response (200): Array of matching vocabularies
```

#### Create Vocabulary (Admin Only)
```
POST /api/vocabularies

Headers:
{
  "Authorization": "Bearer admin_token"
}

Body:
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

Response (201): Created vocabulary
```

#### Update Vocabulary (Admin Only)
```
PUT /api/vocabularies/:id

Headers:
{
  "Authorization": "Bearer admin_token"
}

Body: (any fields to update)

Response (200): Updated vocabulary
```

#### Delete Vocabulary (Admin Only)
```
DELETE /api/vocabularies/:id

Headers:
{
  "Authorization": "Bearer admin_token"
}

Response (200): Success message
```

---

### 🎯 Quiz Endpoints

#### Get All Quizzes
```
GET /api/quizzes?page=1&limit=10

Response (200): Array of published quizzes with pagination
```

#### Get Quiz by ID
```
GET /api/quizzes/:id

Response (200): Quiz object with questions
```

#### Create Quiz (Admin Only)
```
POST /api/quizzes

Headers:
{
  "Authorization": "Bearer admin_token"
}

Body:
{
  "title": "German Greetings",
  "description": "Basic German greetings quiz",
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
      "explanation": "Guten Tag means Good day in German"
    }
  ],
  "timeLimit": 60,
  "passingScore": 70
}

Response (201): Created quiz
```

#### Update Quiz (Admin Only)
```
PUT /api/quizzes/:id

Headers:
{
  "Authorization": "Bearer admin_token"
}

Body: (any fields to update)

Response (200): Updated quiz
```

#### Delete Quiz (Admin Only)
```
DELETE /api/quizzes/:id

Headers:
{
  "Authorization": "Bearer admin_token"
}

Response (200): Success message
```

#### Publish/Unpublish Quiz (Admin Only)
```
PATCH /api/quizzes/:id/publish

Headers:
{
  "Authorization": "Bearer admin_token"
}

Response (200): Quiz object with updated status
```

---

### 👨‍💼 Admin Endpoints (Admin Only)

All admin endpoints require `Authorization: Bearer admin_token`

#### Get All Users
```
GET /api/admin/users?page=1&limit=10

Response (200): Array of users with pagination
```

#### Get User by ID
```
GET /api/admin/users/:id

Response (200): User object
```

#### Update User Role
```
PUT /api/admin/users/:id/role

Body:
{
  "role": "admin" // or "user"
}

Response (200): Updated user
```

#### Delete User
```
DELETE /api/admin/users/:id

Response (200): Success message
```

#### Toggle User Status
```
PATCH /api/admin/users/:id/toggle-status

Response (200): User with updated status
```

#### Get Statistics
```
GET /api/admin/statistics

Response (200):
{
  "success": true,
  "message": "Statistics fetched successfully",
  "data": {
    "totalUsers": 150,
    "totalAdmins": 5,
    "totalRegularUsers": 145,
    "totalVocabularies": 500,
    "totalQuizzes": 50,
    "publishedQuizzes": 35,
    "recentUsers": [...]
  }
}
```

---

## 🔑 Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

The token is returned on successful login/registration and is valid for 7 days (configurable via `JWT_EXPIRES_IN`).

---

## 🛡️ Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error description"
}
```

### Common Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden (Admin required)
- `404` - Not Found
- `409` - Conflict (Email already exists)
- `500` - Internal Server Error

---

## 📝 Models

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: "user" | "admin",
  avatar: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Vocabulary Model
```javascript
{
  germanWord: String (unique),
  vietnameseMeaning: String,
  exampleSentence: {
    german: String,
    vietnamese: String
  },
  topic: String,
  difficultyLevel: "beginner" | "intermediate" | "advanced",
  partOfSpeech: "noun" | "verb" | "adjective" | "adverb" | "other",
  pronunciation: String,
  createdBy: ObjectId (User),
  createdAt: Date,
  updatedAt: Date
}
```

### Quiz Model
```javascript
{
  title: String,
  description: String,
  topic: String,
  difficultyLevel: "beginner" | "intermediate" | "advanced",
  questions: [
    {
      questionText: String,
      type: "multipleChoice" | "shortAnswer" | "matching",
      options: [{ text: String, isCorrect: Boolean }],
      correctAnswer: String,
      explanation: String
    }
  ],
  totalQuestions: Number,
  timeLimit: Number (seconds),
  passingScore: Number (percentage),
  createdBy: ObjectId (User),
  isPublished: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🧪 Testing with Postman/Thunder Client

### 1. Register User
- Method: POST
- URL: `http://localhost:3000/api/auth/register`
- Body:
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123",
  "passwordConfirm": "password123"
}
```

### 2. Login
- Method: POST
- URL: `http://localhost:3000/api/auth/login`
- Body:
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```
- Copy the `token` from response

### 3. Get Current User
- Method: GET
- URL: `http://localhost:3000/api/auth/me`
- Headers:
```
Authorization: Bearer <token_from_login>
```

### 4. Create Vocabulary (Admin)
- First make the user an admin via MongoDB or promote via API
- Method: POST
- URL: `http://localhost:3000/api/vocabularies`
- Headers:
```
Authorization: Bearer <admin_token>
```
- Body:
```json
{
  "germanWord": "Apfel",
  "vietnameseMeaning": "Quả táo",
  "topic": "Food",
  "difficultyLevel": "beginner"
}
```

---

## 🚀 Deployment

### Environment Setup
Update `.env` for production:
```
NODE_ENV=production
PORT=3000
MONGO_URI=your_mongodb_atlas_url
JWT_SECRET=use_a_secure_random_string
JWT_EXPIRES_IN=7d
CORS_ORIGIN=your_frontend_url
```

### Build & Run
```bash
npm start
```

---

## 📚 Best Practices Implemented

✅ **Security**
- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Input validation

✅ **Code Quality**
- Clean MVC architecture
- Async error handling
- Centralized error middleware
- ES Modules for modern code

✅ **Performance**
- Pagination support
- Indexed MongoDB queries
- Connection pooling
- CORS enabled

✅ **Maintainability**
- Clear file organization
- Reusable utilities
- Consistent naming conventions
- Comprehensive documentation

---

## 📧 Support

For issues or questions, please contact the development team or check the documentation.

---

**Built with ❤️ for German Language Learners**
