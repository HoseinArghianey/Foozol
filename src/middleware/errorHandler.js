const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'مسیر مورد نظر پیدا نشد'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    logger.error(err.stack || err.message);
  }
  res.status(status).json({
    error: err.message || 'خطای داخلی سرور',
  });
}

module.exports = { ApiError, notFoundHandler, errorHandler };
