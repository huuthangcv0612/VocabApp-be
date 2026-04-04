const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const levelRoutes = require('./routes/levelRoutes');
const lektionRoutes = require('./routes/lektionRoutes');
const vocabularyRoutes = require('./routes/vocabularyRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// CORS configuration - Allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Connect to MongoDB
connectDB();

app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Hello from VocabApp' }));

// Test DB connection
app.get('/test-db', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    res.json({ status: 'Connected', collections: collections.map(c => c.name) });
  } catch (error) {
    res.status(500).json({ status: 'Error', error: error.message });
  }
});

// API Routes
app.use('/api/levels', levelRoutes);
app.use('/api/lektions', lektionRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/ai', aiRoutes); // Uncommented for AI functionality

// Test AI route - direct in app.js
app.get('/api/ai/test', (req, res) => {
  res.json({ message: 'AI routes are working!', timestamp: new Date() });
});

// Direct AI evaluation route - TEST VERSION (commented out to avoid conflict)
// app.post('/api/ai/evaluate-sentence', async (req, res) => {
//   console.log('AI evaluate-sentence called with:', req.body);
//   try {
//     const { sentence, vocabulary } = req.body;
//     res.json({
//       success: true,
//       message: 'AI evaluation endpoint working',
//       data: {
//         sentence,
//         vocabulary,
//         evaluation: {
//           score: 8,
//           accuracy: 'Good',
//           feedback: 'Test feedback'
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error in evaluate-sentence:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

console.log('AI Routes loaded at /api/ai');

module.exports = app;
