import { Router } from 'express';
import multer from 'multer';
import { TradeController } from '../controllers/trade.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate, tradeValidationRules, updateTradeValidationRules } from '../middleware/validator.js';

const router = Router();
const storage = multer.memoryStorage();

const imageUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const csvUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// MT5 direct integration routes (status check is public, sync requires user auth)
router.get('/mt5/status', TradeController.getMT5Status);
router.post('/mt5/sync', protect, TradeController.syncMT5Trades);

// MQL EA direct auto-sync route
router.post('/sync', protect, TradeController.syncEATrades);

router.route('/')
  .get(protect, TradeController.getTrades)
  .post(protect, tradeValidationRules(), validate, TradeController.createTrade);

router.post('/bulk', protect, TradeController.createBulkTrades);

router.post('/upload', protect, csvUpload.single('file'), TradeController.uploadTrades);
router.post('/screenshots', protect, imageUpload.single('file'), TradeController.uploadScreenshot);

// Real-time SSE push stream for live order updates
router.get('/stream', protect, TradeController.streamTrades);

// Bulk clear all trades for authenticated user
router.delete('/all', protect, TradeController.deleteAllTrades);

// Auto-evaluate final triggers (TP/SL) for manual trades based on candle data
router.post('/auto-evaluate-triggers', protect, TradeController.autoEvaluateTriggers);

// Intelligent deduplication, merge, and cleanup
router.post('/cleanup-duplicates', protect, TradeController.cleanupDuplicates);

router.route('/:id')
  .get(protect, TradeController.getTrade)
  .put(protect, updateTradeValidationRules(), validate, TradeController.updateTrade)
  .delete(protect, TradeController.deleteTrade);

export default router;
