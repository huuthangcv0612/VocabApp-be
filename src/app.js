import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import vocabularyRoutes from './routes/vocabularyRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import levelRoutes from './routes/levelRoutes.js';
import topicRoutes from './routes/topicRoutes.js';
import lektionRoutes from './routes/lektionRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import testRoutes from './routes/testRoutes.js';
import testResultRoutes from './routes/testResultRoutes.js';

// Import middlewares
import { errorMiddleware } from './middlewares/errorMiddleware.js';

const app = express();

// Connect to MongoDB (can be skipped during route inspection)
if (process.env.SKIP_DB_CONNECT !== 'true') {
  connectDB();
}

// Middleware
app.use(helmet());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  cors({
    origin: ['http://localhost:5173', 'https://vocab-app-fe-five.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Test endpoints
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'VocabApp Backend API',
    version: '1.0.0',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use(['/api/vocabularies', '/api/vocabulary'], vocabularyRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/levels', levelRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/lektions', lektionRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/test-results', testResultRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

export default app;
