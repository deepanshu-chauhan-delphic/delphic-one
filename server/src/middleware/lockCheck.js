const db = require('../config/db');
const { fail } = require('../utils/response');

function lockCheck(table) {
  return async (req, res, next) => {
    try {
      const row = await db(table).select('is_locked').where({ id: req.params.id }).first();
      if (!row) return fail(res, 404, 'Not found');
      if (row.is_locked) return fail(res, 403, 'Record is locked');
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = lockCheck;
