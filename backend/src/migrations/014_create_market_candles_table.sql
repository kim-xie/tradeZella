-- 014_create_market_candles_table.sql
-- Create table for storing historical candles synced from MQL EA or data feeds

CREATE TABLE IF NOT EXISTS market_candles (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(30) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  candle_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  timestamp BIGINT NOT NULL,
  open NUMERIC(18, 5) NOT NULL,
  high NUMERIC(18, 5) NOT NULL,
  low NUMERIC(18, 5) NOT NULL,
  close NUMERIC(18, 5) NOT NULL,
  volume BIGINT DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_symbol_tf_candletime UNIQUE (symbol, timeframe, candle_time)
);

CREATE INDEX IF NOT EXISTS idx_candles_symbol_tf_time ON market_candles(symbol, timeframe, candle_time DESC);
