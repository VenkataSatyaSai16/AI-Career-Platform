function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? "Internal server error" : error.message || "Request failed";

  if (statusCode >= 500) {
    console.error("Unhandled server error", {
      message: error.message,
      stack: error.stack
    });
  }

  res.status(statusCode).json({
    message
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
