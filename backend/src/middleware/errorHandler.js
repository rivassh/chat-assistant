export function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.message, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}
