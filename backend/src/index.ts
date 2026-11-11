import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import savingsRoutes from './routes/savings.routes.js';
import exportRoutes from './routes/export.routes.js';
import { createRateLimiter, securityHeaders } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Hide server technology fingerprint
app.disable('x-powered-by');

// Apply defensive HTTP security headers
app.use(securityHeaders);

// Configure CORS with explicit allowed origins in production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Limit JSON request payload size to prevent memory exhaustion DoS
app.use(express.json({ limit: '100kb' }));

// Global API rate limiter (240 requests per minute per IP)
app.use(
  '/api',
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 240,
    message: 'Too many requests. Please slow down.',
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', transactionRoutes);
app.use('/api', savingsRoutes);
app.use('/api', exportRoutes);

// Health Check (minimal non-sensitive response)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler (never leak stack traces or internal error messages to client)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Application Error:', err?.message || 'Unknown error');
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Financial Board Backend API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
