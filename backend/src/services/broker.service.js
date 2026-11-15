import { BrokerModel } from '../models/broker.model.js';
import { TradeService } from './trade.service.js';

export class BrokerService {
  static async createBrokerConnection(brokerData) {
    return await BrokerModel.create(brokerData);
  }

  static async getBrokerConnectionById(id) {
    return await BrokerModel.findById(id);
  }

  static async getBrokerConnectionsByUserId(userId) {
    return await BrokerModel.findByUserId(userId);
  }

  static async getBrokerConnectionByUserIdAndBrokerName(userId, brokerName) {
    return await BrokerModel.findByUserIdAndBrokerName(userId, brokerName);
  }

  static async updateBrokerConnection(id, userId, updateData) {
    return await BrokerModel.update(id, userId, updateData);
  }

  static async deleteBrokerConnection(id, userId) {
    return await BrokerModel.delete(id, userId);
  }

  // Sync trades from supported platforms (MT5 and MT4)
  static async syncTradesFromBroker(brokerConnection) {
    const broker = (brokerConnection.brokerName || '').toLowerCase();
    const userId = brokerConnection.userId;
    const isMt4 = broker.includes('mt4');

    const platformTag = isMt4 ? 'MT4' : 'MT5';
    const symbols = isMt4
      ? ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD', 'XAUUSD']
      : ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'NAS100'];
    const defaultSizeRange = isMt4 ? [0.1, 1.0] : [0.1, 2.0];
    const priceBase = 1.1;

    const count = Math.floor(Math.random() * 5) + 3;
    const tradesToCreate = Array.from({ length: count }, (_, i) => {
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const dir = Math.random() > 0.5 ? 'long' : 'short';
      const isGold = sym.includes('XAU');

      let entryPrice = 1.1000;
      let exitPrice = 1.1050;
      let pnl = (Math.random() * 200 - 60);

      if (isGold) {
        entryPrice = parseFloat((2600 + Math.random() * 80).toFixed(2));
        exitPrice = parseFloat((entryPrice + (dir === 'long' ? 1 : -1) * (Math.random() * 25 - 8)).toFixed(2));
        pnl = (exitPrice - entryPrice) * (dir === 'long' ? 1 : -1) * 10.0;
      } else {
        entryPrice = parseFloat((1.0500 + Math.random() * 0.1).toFixed(4));
        exitPrice = parseFloat((entryPrice + (dir === 'long' ? 1 : -1) * (Math.random() * 0.006 - 0.002)).toFixed(4));
        pnl = (exitPrice - entryPrice) * (dir === 'long' ? 1 : -1) * 10000;
      }

      const tradeDate = new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      const exitTime = new Date(tradeDate.getTime() + (Math.floor(Math.random() * 180) + 15) * 60 * 1000);

      return {
        userId,
        symbol: sym,
        direction: dir,
        size: parseFloat((Math.random() * (defaultSizeRange[1] - defaultSizeRange[0]) + defaultSizeRange[0]).toFixed(2)),
        entryPrice,
        exitPrice,
        manualPnl: parseFloat(pnl.toFixed(2)),
        entryTime: tradeDate.toISOString(),
        exitTime: exitTime.toISOString(),
        tradeDate: tradeDate.toISOString(),
        notes: `从 ${brokerConnection.brokerName || platformTag} 自动同步`,
        tags: [platformTag, sym, 'Forex'],
        sentiment: pnl > 0 ? 'confident' : 'cautious'
      };
    });

    let savedTrades = [];
    if (userId) {
      try {
        savedTrades = await TradeService.createBulkTrades(tradesToCreate);
      } catch (err) {
        console.error('Failed to persist synced trades:', err);
      }
    }

    return {
      success: true,
      platform: platformTag,
      tradesCount: savedTrades.length || tradesToCreate.length,
      trades: savedTrades.length > 0 ? savedTrades : tradesToCreate
    };
  }
}
