import { body, validationResult } from 'express-validator';

export const registerValidationRules = () => {
  return [
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ];
};

export const loginValidationRules = () => {
  return [
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ];
};

export const tradeValidationRules = () => {
  return [
    body('symbol').notEmpty().withMessage('Symbol is required').isString().withMessage('Symbol must be a string'),
    body('direction').isIn(['long', 'short']).withMessage('Direction must be one of "long" or "short"'),
    body('size').isFloat({ gt: 0 }).withMessage('Size must be a positive number'),
    body('entryPrice').isFloat({ gt: 0 }).withMessage('Entry price must be a positive number'),
    body('exitPrice').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Exit price must be a positive number'),
    body('notes').optional({ nullable: true }).isString().withMessage('Notes must be a string'),
    body('tradeDate').optional({ nullable: true }).isISO8601().toDate().withMessage('Trade date must be a valid date'),
    body('entryTime').optional({ nullable: true }).isISO8601().toDate().withMessage('Entry time must be a valid date'),
    body('exitTime').optional({ nullable: true }).isISO8601().toDate().withMessage('Exit time must be a valid date'),
    body('stopLoss').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Stop loss must be a positive number'),
    body('takeProfit').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Take profit must be a positive number'),
    body('tags').optional({ nullable: true }).isArray().withMessage('Tags must be an array of strings'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string'),
    body('sentiment').optional({ nullable: true }).isString().withMessage('Sentiment must be a string'),
    body('screenshots').optional({ nullable: true }).isArray().withMessage('Screenshots must be an array of strings (URLs)'),
    body('screenshots.*').optional().isString().withMessage('Each screenshot must be a valid string'),
  ];
};

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

  return res.status(422).json({
    errors: extractedErrors,
  });
};
