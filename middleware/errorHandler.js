function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  res.status(statusCode).json({ message: err.message || 'Internal server error' });
}

module.exports = errorHandler;
