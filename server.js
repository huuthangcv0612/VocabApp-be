import 'dotenv/config';
import app from './src/app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
    ╔══════════════════════════════════════════╗
    ║     🎓 VocabApp Server Started 🎓      ║
    ║     Server running on port ${PORT}       ║
    ║     Environment: ${process.env.NODE_ENV || 'development'}         ║
    ╚══════════════════════════════════════════╝
  `);
});

