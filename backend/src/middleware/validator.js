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
    body('tradeDate').optional({ nullable: true }).isISO8601().withMessage('Trade date must be a valid date'),
    body('entryTime').optional({ nullable: true }).isISO8601().withMessage('Entry time must be a valid date'),
    body('exitTime').optional({ nullable: true }).isISO8601().withMessage('Exit time must be a valid date'),
    body('stopLoss').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Stop loss must be a positive number'),
    body('takeProfit').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Take profit must be a positive number'),
    body('tags').optional({ nullable: true }).isArray().withMessage('Tags must be an array of strings'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string'),
    body('sentiment').optional({ nullable: true }).isString().withMessage('Sentiment must be a string'),
    body('screenshots').optional({ nullable: true }).isArray().withMessage('Screenshots must be an array of strings (URLs)'),
    body('entryConditions').isArray().withMessage('Entry conditions must be an array of strings').notEmpty().withMessage('At least one entry condition is required'),
    body('entryConditions.*').isString().withMessage('Each entry condition must be a string'),
    body('rating').optional({ nullable: true }).isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
    body('manualPnl').optional({ nullable: true }).isFloat().withMessage('Manual PnL must be a number'),
    body('session').optional({ nullable: true }).isIn(['Asia', 'Europe', 'US']).withMessage('Session must be one of "Asia", "Europe", "US"'),
  ];
};

export const updateTradeValidationRules = () => {
  return [
    body('symbol').optional({ nullable: true }).isString().withMessage('Symbol must be a string'),
    body('direction').optional({ nullable: true }).isIn(['long', 'short']).withMessage('Direction must be one of "long" or "short"'),
    body('size').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Size must be a positive number'),
    body('entryPrice').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Entry price must be a positive number'),
    body('exitPrice').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Exit price must be a positive number'),
    body('notes').optional({ nullable: true }).isString().withMessage('Notes must be a string'),
    body('tradeDate').optional({ nullable: true }).isISO8601().withMessage('Trade date must be a valid date'),
    body('entryTime').optional({ nullable: true }).isISO8601().withMessage('Entry time must be a valid date'),
    body('exitTime').optional({ nullable: true }).isISO8601().withMessage('Exit time must be a valid date'),
    body('stopLoss').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Stop loss must be a positive number'),
    body('takeProfit').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Take profit must be a positive number'),
    body('tags').optional({ nullable: true }).isArray().withMessage('Tags must be an array of strings'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string'),
    body('sentiment').optional({ nullable: true }).isString().withMessage('Sentiment must be a string'),
    body('screenshots').optional({ nullable: true }).isArray().withMessage('Screenshots must be an array of strings (URLs)'),
    body('entryConditions').optional({ nullable: true }).isArray().withMessage('Entry conditions must be an array of strings'),
    body('entryConditions.*').optional().isString().withMessage('Each entry condition must be a string'),
    body('rating').optional({ nullable: true }).isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
    body('manualPnl').optional({ nullable: true }).isFloat().withMessage('Manual PnL must be a number'),
    body('session').optional({ nullable: true }).isIn(['Asia', 'Europe', 'US']).withMessage('Session must be one of "Asia", "Europe", "US"'),
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
