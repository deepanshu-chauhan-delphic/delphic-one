const { ZodError } = require('zod');
const { fail } = require('../utils/response');

module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    return fail(res, 422, 'Validation failed', err.errors);
  }

  console.error(err);
  const status = err.status || 500;
  return fail(res, status, err.message || 'Internal server error');
};
