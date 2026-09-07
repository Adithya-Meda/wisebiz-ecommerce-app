'use strict';

const { ValidationError } = require('./errors');

/**
 * Middleware factory — wraps a Joi schema validation
 * Usage: router.post('/path', validate(schema), handler)
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const target = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
    const { error, value } = schema.validate(target, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const fields = {};
      error.details.forEach((d) => {
        const key = d.path.join('.');
        fields[key] = d.message.replace(/["]/g, '');
      });
      return next(new ValidationError('Validation failed', fields));
    }

    if (source === 'query') {
      req.query = value;
    } else if (source === 'params') {
      req.params = value;
    } else {
      req.body = value;
    }

    next();
  };
}

module.exports = { validate };
