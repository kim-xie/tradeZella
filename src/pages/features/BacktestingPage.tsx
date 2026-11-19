import React, { useState, useEffect } from 'react';
import FeaturePageLayout from './FeaturePageLayout';
import ManualBarReplay from '../../components/ManualBarReplay';
import { getMT5Status, getAvailableCandleSymbols, MT5StatusData } from '../../services/api';

export default function BacktestingPage() {
  const [mt5Status, setMt5Status] = useState<MT5StatusData | null>(null);
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [popularSymbols, setPopularSymbols] = useState<string[]>([]);

  useEffect(() => {
    fetchInfo();
  }, []);

  const fetchInfo = async () => {
    try {
      const [status, candleData] = await Promise.all([
        getMT5Status().catch(() => ({ connected: false })),
        getAvailableCandleSymbols().catch(() => null),
      ]);
      setMt5Status(status);

      if (candleData && candleData.symbols && candleData.symbols.length > 0) {
        setAvailableSymbols(candleData.symbols);
        setPopularSymbols(candleData.popularSymbols || []);
      } else if (status?.allSymbols && status.allSymbols.length > 0) {
        setAvailableSymbols(status.allSymbols);
        setPopularSymbols(status.popularSymbols || []);
      }
    } catch {
      setMt5Status({ connected: false });
    }
  };

  const defaultPopular = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'];

  return (
    <FeaturePageLayout hideHeader>
      <ManualBarReplay 
        initialSymbol="EURUSD"
        popularSymbols={popularSymbols.length > 0 ? popularSymbols : (mt5Status?.popularSymbols || defaultPopular)}
        allSymbols={availableSymbols.length > 0 ? availableSymbols : (mt5Status?.allSymbols || defaultPopular)}
      />
    </FeaturePageLayout>
  );
}
