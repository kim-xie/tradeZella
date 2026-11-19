import React, { useState, useEffect } from 'react';
import FeaturePageLayout from './FeaturePageLayout';
import ManualBarReplay from '../../components/ManualBarReplay';
import { getMT5Status, MT5StatusData } from '../../services/api';

export default function BacktestingPage() {
  const [mt5Status, setMt5Status] = useState<MT5StatusData | null>(null);

  useEffect(() => {
    fetchMT5Info();
  }, []);

  const fetchMT5Info = async () => {
    try {
      const status = await getMT5Status();
      setMt5Status(status);
    } catch {
      setMt5Status({ connected: false });
    }
  };

  return (
    <FeaturePageLayout hideHeader>
      <ManualBarReplay 
        initialSymbol="EURUSD"
        popularSymbols={mt5Status?.popularSymbols || ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD']}
        allSymbols={mt5Status?.allSymbols || []}
      />
    </FeaturePageLayout>
  );
}
