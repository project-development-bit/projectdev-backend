function errorMiddleware(error, req, res, next) {
  let { status = 500, message, code, data } = error;

  console.log(`[Error]`, error);

  // If no message or 500 status → use a generic fallback
  if (status === 500 || !message) {
    message = 'Internal server error';
    code = 'INTERNAL_ERROR';
  }

  const response = {
    type: 'error',
    status,
    message,
    code: code || 'UNKNOWN_ERROR',
  };

  // Include extra data if present
  if (data) response.data = data;

  res.status(status).json(response);
}

module.exports = errorMiddleware;
/*
{
    type: 'error',
    status: 404,
    code: 'NOT_FOUND',
    message: 'Not Found'
    data: {...} // optional
}
*/