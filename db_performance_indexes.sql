-- ==============================================================================
-- DOMEXIT 1.2 — ENTERPRISE DATABASE PERFORMANCE INDEXES (Criterion 17)
-- 100% Non-destructive: Safe CREATE INDEX IF NOT EXISTS statements
-- Compatible with PostgreSQL, Yandex YDB PostgreSQL compatibility, Supabase & Cloud DBs
-- ==============================================================================

-- 1. Lots & Real Estate Catalog (High-frequency filters & sorting)
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots (status);
CREATE INDEX IF NOT EXISTS idx_lots_city ON lots (city);
CREATE INDEX IF NOT EXISTS idx_lots_district ON lots (district);
CREATE INDEX IF NOT EXISTS idx_lots_created_at ON lots (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lots_developer ON lots (developer);
CREATE INDEX IF NOT EXISTS idx_lots_price ON lots (ddu_contract_price);
CREATE INDEX IF NOT EXISTS idx_lots_current_stage ON lots (current_stage);
CREATE INDEX IF NOT EXISTS idx_lots_catalog_composite ON lots (status, city, current_stage);

-- 2. Buyer Applications & Matchmaker Bids
CREATE INDEX IF NOT EXISTS idx_buyer_apps_lot_id ON buyer_applications (lot_id);
CREATE INDEX IF NOT EXISTS idx_buyer_apps_status ON buyer_applications (status);
CREATE INDEX IF NOT EXISTS idx_buyer_apps_client_code ON buyer_applications (client_code);
CREATE INDEX IF NOT EXISTS idx_buyer_apps_created_at ON buyer_applications (created_at DESC);

-- 3. Seller Requests & Acquisition Pipeline
CREATE INDEX IF NOT EXISTS idx_seller_reqs_status ON seller_requests (status);
CREATE INDEX IF NOT EXISTS idx_seller_reqs_client_code ON seller_requests (client_code);
CREATE INDEX IF NOT EXISTS idx_seller_reqs_created_at ON seller_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_reqs_lot_code ON seller_requests (lot_code);

-- 4. Protected Cloud Documents Vault (152-FZ Compliance)
CREATE INDEX IF NOT EXISTS idx_documents_vault_entity ON documents_vault (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_vault_client_code ON documents_vault (client_code);
CREATE INDEX IF NOT EXISTS idx_documents_vault_category ON documents_vault (category);
CREATE INDEX IF NOT EXISTS idx_documents_vault_status ON documents_vault (status);

-- 5. Audit Trail & Decision Logs (Mission 12 & Compliance 152-FZ)
CREATE INDEX IF NOT EXISTS idx_audit_logs_lot_code ON audit_logs (lot_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_uid);

-- 6. Legal CMS & Acts Archive (26 Canonical Acts)
CREATE INDEX IF NOT EXISTS idx_legal_docs_slug ON legal_documents (slug);
CREATE INDEX IF NOT EXISTS idx_legal_docs_active ON legal_documents (is_active);
CREATE INDEX IF NOT EXISTS idx_legal_docs_category ON legal_documents (category);

-- 7. User Consent Register (152-ФЗ & 38-ФЗ)
CREATE INDEX IF NOT EXISTS idx_user_consents_client ON user_consents (client_code);
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents (user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON user_consents (consent_type);

-- ==============================================================================
-- CONNECTION POOLING ARCHITECTURE (Criterion 18):
-- When connecting to PostgreSQL/Supabase, route application read queries through
-- transaction connection pooler (e.g. PgBouncer port 6543) using the singleton
-- DatabaseGateway client instance. Max connection limit recommended: 20-50 clients.
-- ==============================================================================
