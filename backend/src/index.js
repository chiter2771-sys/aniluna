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
const indexHtmlPath = path.join(staticDir, 'index.html');
const hasFrontendBuild = fs.existsSync(indexHtmlPath);

const emergencyHtml = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AniLuna</title><style>body{font-family:Inter,Arial,sans-serif;background:#090c16;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:720px;padding:24px;border-radius:16px;background:#121826}code{background:#1f2937;padding:2px 6px;border-radius:6px}</style></head>
<body><main><h1>AniLuna is starting</h1><p>Frontend build is not available yet. Backend is alive.</p><p>Check: <a href="/api/health">/api/health</a></p></main></body></html>`;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), timestamp: new Date().toISOString(), frontendBuilt: hasFrontendBuild });
});

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.use('/api', apiRoutes);

if (hasFrontendBuild) {
  app.use(express.static(staticDir, { maxAge: '1h', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(indexHtmlPath);
  });
} else {
  app.get('/', (_req, res) => {
    res.status(200).type('html').send(emergencyHtml);
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

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  server.close(() => process.exit(1));
});
