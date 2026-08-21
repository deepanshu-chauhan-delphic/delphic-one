const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const accountsRoutes = require('./modules/accounts/accounts.routes');
const requirementsRoutes = require('./modules/requirements/requirements.routes');
const seatsRoutes = require('./modules/requirements/seats.routes');
const profilesRoutes = require('./modules/profiles/profiles.routes');
const submissionsRoutes = require('./modules/submissions/submissions.routes');
const interviewRoundsRoutes = require('./modules/submissions/interviewRounds.routes');
const documentsRoutes = require('./modules/documents/documents.routes');
const commentsRoutes = require('./modules/comments/comments.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(requestLogger);
app.use('/uploads', express.static(path.resolve(env.uploadDir)));

const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

app.get('/api/v1/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

// Rate limit login in real environments only — tests log in once per case and would hit 429 mid-suite.
if (env.nodeEnv !== 'test') {
  app.use('/api/v1/auth/login', loginLimiter);
}
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/accounts', accountsRoutes);
app.use('/api/v1/requirements', requirementsRoutes);
app.use('/api/v1/seats', seatsRoutes);
app.use('/api/v1/profiles', profilesRoutes);
app.use('/api/v1/submissions', submissionsRoutes);
app.use('/api/v1/interview-rounds', interviewRoundsRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/comments', commentsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));
app.use(errorHandler);

module.exports = app;
