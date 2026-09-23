/**
 * Shared CORS Configuration
 */
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://vocab-app-fe-five.vercel.app',
];

const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

export const corsOriginDelegate = (origin, callback) => {
  // Allow requests with no origin (like curl, mobile apps, or server-to-server webhooks)
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(null, false);
};

export const corsOptions = {
  origin: corsOriginDelegate,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept-Language',
    'x-webhook-secret',
    'x-api-key',
  ],
  credentials: true,
};

export default corsOptions;
