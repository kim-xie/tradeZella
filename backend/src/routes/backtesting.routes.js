import { Router } from 'express';
import { BacktestingController } from '../controllers/backtesting.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// Protect all routes in this file
router.use(protect);

// MT5 status endpoint
router.get('/mt5/status', BacktestingController.getMT5Status);
router.get('/candles', BacktestingController.getCandles);

router.route('/')
  .get(BacktestingController.getBacktestingResults)
  .post(BacktestingController.runBacktest);

router.route('/:id')
  .get(BacktestingController.getBacktestingResult)
  .delete(BacktestingController.deleteBacktestingResult);

export default router;
