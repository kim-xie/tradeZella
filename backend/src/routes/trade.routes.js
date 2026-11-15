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

// MT5 direct integration routes
router.get('/mt5/status', protect, TradeController.getMT5Status);
router.post('/mt5/sync', protect, TradeController.syncMT5Trades);

router.route('/')
  .get(protect, TradeController.getTrades)
  .post(protect, tradeValidationRules(), validate, TradeController.createTrade);

router.post('/bulk', protect, TradeController.createBulkTrades);

router.post('/upload', protect, csvUpload.single('file'), TradeController.uploadTrades);
router.post('/screenshots', protect, imageUpload.single('file'), TradeController.uploadScreenshot);

router.route('/:id')
  .get(protect, TradeController.getTrade)
  .put(protect, updateTradeValidationRules(), validate, TradeController.updateTrade)
  .delete(protect, TradeController.deleteTrade);

export default router;
