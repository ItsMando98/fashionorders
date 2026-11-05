-- Keep historical records; only BTC and Ethereum-native USDC can be enabled.
UPDATE shop_payment_methods SET enabled=false WHERE currency NOT IN ('BTC','USDC');
ALTER TABLE shop_payment_methods DROP CONSTRAINT shop_payment_methods_currency_check;
ALTER TABLE shop_payment_methods ADD CONSTRAINT shop_payment_methods_currency_check CHECK(currency IN ('BTC','USDC','ETH','USDT'));
ALTER TABLE shop_payment_methods ADD CONSTRAINT shop_payment_methods_enabled_asset_check CHECK(NOT enabled OR (currency='BTC' AND network='bitcoin') OR (currency='USDC' AND network='ethereum'));
UPDATE shop_payment_requests SET status='expired',expires_at=least(expires_at,now()) WHERE currency NOT IN ('BTC','USDC') AND status='pending' AND txid IS NULL;
