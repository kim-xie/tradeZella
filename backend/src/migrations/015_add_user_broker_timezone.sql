-- Add broker_timezone column on users table so EA-detected broker timezone auto-syncs across Calendar/Dashboard/Upload UI
ALTER TABLE users
ADD COLUMN IF NOT EXISTS broker_timezone VARCHAR(32);
