require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const { errorHandler, notFound } = require('./middleware/errors');

const app = express();
const port = Number(process.env.PORT) || 3000;

const staticDir = path.resolve(__dirname, '../../frontend/dist');
const hasFrontendBuild = fs.existsSync(staticDir);

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', apiRoutes);

if (hasFrontendBuild) {
  app.use(express.static(staticDir, { maxAge: '1h', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(staticDir, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`AniLuna backend started on port ${port}`);
  if (!hasFrontendBuild) {
    console.warn('Frontend build is missing. Build frontend before deploy.');
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  server.close(() => process.exit(1));
});
