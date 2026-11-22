import { Router } from 'express';
import { BacktestingController } from '../controllers/backtesting.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// Public endpoints: MT5 status & K-line candle feeds (supports public/demo replay)
router.get('/mt5/status', BacktestingController.getMT5Status);
router.get('/symbols', BacktestingController.getAvailableCandleSymbols);
router.get('/candles', BacktestingController.getCandles);
router.post('/candles/sync', BacktestingController.syncCandles);
router.post('/candles/clear', BacktestingController.clearCandles);
router.delete('/candles', BacktestingController.clearCandles);

// Protect user-specific backtest results
router.use(protect);

router.route('/')
  .get(BacktestingController.getBacktestingResults)
  .post(BacktestingController.runBacktest);

router.route('/:id')
  .get(BacktestingController.getBacktestingResult)
  .delete(BacktestingController.deleteBacktestingResult);

export default router;
