require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const { errorHandler, notFound } = require('./middleware/errors');

const app = express();
const port = Number(process.env.PORT) || 3000;
const repoRoot = path.resolve(__dirname, '../..');

const reactBuildDir = path.resolve(__dirname, '../../frontend/dist');
const reactIndexPath = path.join(reactBuildDir, 'index.html');
const hasReactBuild = fs.existsSync(reactIndexPath);

const faviconIcoBase64 = 'AAABAAEAEBAAAAAAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAGAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///8A';
const appleTouchPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx4QAAAAASUVORK5CYII=';

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.status(200).send('ok'));

app.get('/favicon.ico', (_req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(faviconIcoBase64, 'base64'));
});

app.get('/apple-touch-icon.png', (_req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(appleTouchPngBase64, 'base64'));
});

app.use('/api', apiRoutes);

// Legacy UI (old design) static assets
app.use('/css', express.static(path.join(repoRoot, 'css'), { maxAge: '1h' }));
app.use('/js', express.static(path.join(repoRoot, 'js'), { maxAge: '1h' }));
app.use('/pages', express.static(path.join(repoRoot, 'pages'), { maxAge: '1h' }));
app.use('/json', express.static(path.join(repoRoot, 'json'), { maxAge: '1h' }));
app.use('/html', express.static(path.join(repoRoot, 'html'), { maxAge: '1h' }));

app.get('/', (_req, res) => res.sendFile(path.join(repoRoot, 'html', 'index.html')));
app.get('/search', (_req, res) => res.sendFile(path.join(repoRoot, 'pages', 'search.html')));
app.get('/title', (_req, res) => res.sendFile(path.join(repoRoot, 'pages', 'anime.html')));

if (hasReactBuild) {
  app.use('/app', express.static(reactBuildDir, { maxAge: '1h', index: false }));
  app.get('/app/*', (_req, res) => res.sendFile(reactIndexPath));
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`AniLuna backend started on port ${port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason && reason.message ? reason.message : reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error && error.message ? error.message : error);
  server.close(() => process.exit(1));
});
