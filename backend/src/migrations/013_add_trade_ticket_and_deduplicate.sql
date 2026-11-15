-- Add ticket column to trades table for storing MT5 position/deal ticket or broker trade ID
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS ticket VARCHAR(100);

-- Backfill ticket from notes for existing MT5 and CSV trades
UPDATE trades
SET ticket = substring(notes from 'MT5 Position #([0-9]+)')
WHERE ticket IS NULL AND notes LIKE '%MT5 Position #%';

UPDATE trades
SET ticket = substring(notes from 'Ticket/ID: ([0-9a-zA-Z_-]+)')
WHERE ticket IS NULL AND notes LIKE '%Ticket/ID: %';

-- Delete duplicate trades with the same ticket per user (keep minimum id)
DELETE FROM trades
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY userid, ticket
      ORDER BY id ASC
    ) as rn
    FROM trades
    WHERE ticket IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Delete duplicate trades without ticket having exact same core attributes (keep minimum id)
DELETE FROM trades
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY userid, symbol, direction, round(entryprice::numeric, 4), round(coalesce(exitprice, 0)::numeric, 4), round(size::numeric, 4), entry_time, exit_time
      ORDER BY id ASC
    ) as rn
    FROM trades
    WHERE ticket IS NULL
  ) t
  WHERE t.rn > 1
);

-- Create partial unique index on (userid, ticket) to enforce uniqueness in PostgreSQL
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_user_ticket_unique
ON trades (userid, ticket)
WHERE ticket IS NOT NULL;

-- Create index for faster fingerprint checking
CREATE INDEX IF NOT EXISTS idx_trades_dedup_fingerprint
ON trades (userid, symbol, entry_time);
