import { Router } from 'express';
import multer from 'multer';
import { TradeController } from '../controllers/trade.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate, tradeValidationRules } from '../middleware/validator.js';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({
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

// Protect all routes in this file
// router.use(protect); // Removed global protect

router.route('/')
  .get(protect, TradeController.getTrades)
  .post(protect, tradeValidationRules(), validate, TradeController.createTrade);

router.post('/upload', protect, upload.single('file'), TradeController.uploadTrades);
router.post('/screenshots', protect, upload.single('file'), TradeController.uploadScreenshot);

router.route('/:id')
  .get(protect, TradeController.getTrade)
  .put(protect, tradeValidationRules(), validate, TradeController.updateTrade)
  .delete(protect, TradeController.deleteTrade);

export default router;
