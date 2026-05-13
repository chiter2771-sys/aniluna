function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) {
    console.error('[AniLuna API error]', err);
  }
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
