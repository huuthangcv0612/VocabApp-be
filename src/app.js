import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import vocabularyRoutes from './routes/vocabularyRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import levelRoutes from './routes/levelRoutes.js';
import lektionRoutes from './routes/lektionRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

// Import middlewares
import { errorMiddleware } from './middlewares/errorMiddleware.js';

const app = express();

// Connect to MongoDB (can be skipped during route inspection)
if (process.env.SKIP_DB_CONNECT !== 'true') {
  connectDB();
}

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
app.use('/api/lektions', lektionRoutes);
app.use('/api/ai', aiRoutes);

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

