function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = 'Internal server error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((error) => error.message).join('; ');
  } else if (err.code === 11000) {
    statusCode = 400;
    if (err.keyPattern?.menuItem && err.keyPattern?.size) {
      message = 'A recipe already exists for this menu item and size';
    } else {
      message = 'A record with this name already exists';
    }
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid value for ' + err.path;
  } else if (err.status === 400) {
    statusCode = 400;
    message = 'Invalid request body';
  }

  res.status(statusCode).json({ message });
}

module.exports = errorHandler;
