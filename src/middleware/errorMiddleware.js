const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'An unexpected error occurred on the server.';

  // Handle Multer file upload errors gracefully
  if (
    err.code === 'LIMIT_FILE_SIZE' ||
    (err.message && err.message.includes('Invalid file type'))
  ) {
    statusCode = 400;
  } else if (err.name === 'MulterError') {
    statusCode = 400;
  } else if (err.message && err.message.includes('CORS blocked')) {
    statusCode = 403;
  }

  res.status(statusCode).json({
    message: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = {
  notFound,
  errorHandler
};
