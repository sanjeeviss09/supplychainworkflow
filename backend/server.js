import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;

// Security & Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow local development, Vercel deployments, and undefined (server-to-server)
      if (!origin || origin.includes('vercel.app') || origin.includes('localhost')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for initial cloud setup
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// PostgreSQL Connection Pool (Render PostgreSQL or External DB)
const dbUrl = process.env.DATABASE_URL;
let pool = null;

if (dbUrl) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });
}

// 1. Health Check Endpoint (Render checks /health or /)
app.get('/', (req, res) => {
  res.json({
    name: 'SCM Flow Enterprise Backend API',
    status: 'healthy',
    version: '1.0.0',
    platform: 'Render Web Service',
    timezone: 'Asia/Kolkata (IST)',
    currency: 'INR (₹)',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// 2. System Info & Active Modules Endpoint
app.get('/api/info', (req, res) => {
  res.json({
    system: 'SCM Flow Enterprise Gateway',
    version: '1.0.0',
    compliance: 'GxP / 21 CFR Part 11 Audit Trail Compliant',
    phases_implemented: [
      'Phase 1: Employee Auth & Directory',
      'Phase 2: RLS & PostgreSQL Security Matrix',
      'Phase 3: Role-Route Authorization & Audit Logs',
      'Phase 4: Capital & Operational Projects & Milestones',
      'Phase 5: Material Classification & BOM Engine',
      'Phase 6: Supplier Master & Qualification Lifecycle',
      'Phase 7: SAP Reference & Material Delivery Tracking',
      'Phase 8: Supplier Delivery Performance Analytics',
      'Phase 9: Delivery Issue & Escalation Management',
      'Phase 10: Incoming Delivery Planning & 14-Day Calendar',
      'Phase 11: Material Supply Risk & Criticality Management',
      'Phase 12: Centralized SCM Document Vault & Expiry Tracking',
    ],
    defaults: {
      currency: 'INR (₹)',
      timezone: 'Asia/Kolkata (IST)',
      proactive_reminder_days: 3,
    },
  });
});

// 3. Database Status & Connectivity Check
app.get('/api/db/status', async (req, res) => {
  if (!pool) {
    return res.status(200).json({
      connected: false,
      message: 'DATABASE_URL is not configured yet. Configure Render PostgreSQL to activate live database.',
      mode: 'standalone / mock-fallback',
    });
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now, current_database() as db_name, version() as pg_version');
    
    // Check table count
    const tableRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    client.release();

    res.json({
      connected: true,
      database: result.rows[0].db_name,
      pg_version: result.rows[0].pg_version,
      public_tables: parseInt(tableRes.rows[0].count, 10),
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    console.error('Database connection check error:', err);
    res.status(500).json({
      connected: false,
      error: err.message,
    });
  }
});

// 4. Fallback Seed Employees Directory (For offline/dev resilience)
app.get('/api/seed-employees', (req, res) => {
  res.json([
    { employee_id: 'AXX09', full_name: 'Dr. Sanjeev Kumar', role: 'super_admin', email: 'sanjeev@company.internal' },
    { employee_id: 'EMP-1001', full_name: 'Rajesh Sharma', role: 'scm_admin', email: 'rajesh.sharma@company.internal' },
    { employee_id: 'EMP-1002', full_name: 'Priya Patel', role: 'scm_team_user', email: 'priya.patel@company.internal' },
    { employee_id: 'EMP-1003', full_name: 'Amit Verma', role: 'scm_team_user', email: 'amit.verma@company.internal' },
  ]);
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SCM Flow Backend Server running on port ${PORT}`);
  console.log(`Database URL configured: ${Boolean(dbUrl)}`);
  console.log(`Timezone: Asia/Kolkata (IST)`);
});
