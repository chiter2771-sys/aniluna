function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    const cause = err.cause;
    console.error('[AniLuna API error]', {
      path: req.path,
      method: req.method,
      status,
      message,
      causeCode: cause && cause.code ? cause.code : undefined,
      causeMessage: cause && cause.message ? cause.message : undefined
    });
  }

  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
