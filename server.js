import 'dotenv/config';
import http from 'http';
import app from './src/app.js';
import { initSocket } from './src/realtime/socketHandler.js';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.IO real-time server
initSocket(server);

server.listen(PORT, () => {
  console.log(`
    ╔══════════════════════════════════════════╗
    ║     🎓 VocabApp Server Started 🎓      ║
    ║     Server running on port ${PORT}       ║
    ║     Environment: ${process.env.NODE_ENV || 'development'}         ║
    ║     Real-time: Socket.IO initialized     ║
    ╚══════════════════════════════════════════╝
  `);
});

