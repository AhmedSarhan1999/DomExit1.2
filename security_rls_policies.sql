-- ==============================================================================
-- DOMEXIT 1.2 — ENTERPRISE ROW LEVEL SECURITY (RLS) POLICIES & CONSTRAINTS
-- Compliance: Russian Federal Law 152-FZ (Personal Data Protection) & 63-FZ (e-Signatures)
-- Database Engine: PostgreSQL / Supabase / Yandex Managed PostgreSQL Compatibility
-- ==============================================================================

-- 1. Enable Row Level Security (RLS) across all application tables
ALTER TABLE IF EXISTS lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS buyer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seller_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. Lots Table Security Policies
-- ==============================================================================
-- Allow public / anonymous users to view ONLY published, approved, available lots
DROP POLICY IF EXISTS p_lots_public_read ON lots;
CREATE POLICY p_lots_public_read ON lots
  FOR SELECT
  USING (
    is_published = true
    AND approval_status = 'approved_for_packaging'
    AND status IN ('available', 'processing', 'in_deal')
  );

-- Allow authorized sellers to view and manage ONLY their own real estate lots
DROP POLICY IF EXISTS p_lots_seller_own ON lots;
CREATE POLICY p_lots_seller_own ON lots
  FOR ALL
  USING (seller_user_id = auth.uid()::text)
  WITH CHECK (seller_user_id = auth.uid()::text);

-- Allow Platform Staff & Legal Curators full operational access
DROP POLICY IF EXISTS p_lots_staff_full ON lots;
CREATE POLICY p_lots_staff_full ON lots
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') IN ('owner', 'employee', 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'employee', 'admin')
  );

-- ==============================================================================
-- 3. Buyer Applications & Bids (IDOR Defense)
-- ==============================================================================
-- Buyers can ONLY view and track their own applications
DROP POLICY IF EXISTS p_buyer_apps_own ON buyer_applications;
CREATE POLICY p_buyer_apps_own ON buyer_applications
  FOR SELECT
  USING (user_id = auth.uid()::text OR client_code = (auth.jwt() ->> 'client_code'));

-- Buyers can submit bids for themselves
DROP POLICY IF EXISTS p_buyer_apps_insert ON buyer_applications;
CREATE POLICY p_buyer_apps_insert ON buyer_applications
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Staff can review and match all buyer bids
DROP POLICY IF EXISTS p_buyer_apps_staff ON buyer_applications;
CREATE POLICY p_buyer_apps_staff ON buyer_applications
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') IN ('owner', 'employee', 'admin')
  );

-- ==============================================================================
-- 4. Seller Requests & Acquisition Pipeline (IDOR Defense)
-- ==============================================================================
DROP POLICY IF EXISTS p_seller_reqs_own ON seller_requests;
CREATE POLICY p_seller_reqs_own ON seller_requests
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS p_seller_reqs_staff ON seller_requests;
CREATE POLICY p_seller_reqs_staff ON seller_requests
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') IN ('owner', 'employee', 'admin')
  );

-- ==============================================================================
-- 5. Protected Documents Vault (152-FZ Cloud Safe)
-- ==============================================================================
DROP POLICY IF EXISTS p_vault_docs_own ON documents_vault;
CREATE POLICY p_vault_docs_own ON documents_vault
  FOR SELECT
  USING (
    uploaded_by_uid = auth.uid()::text
    OR client_code = (auth.jwt() ->> 'client_code')
  );

DROP POLICY IF EXISTS p_vault_docs_insert ON documents_vault;
CREATE POLICY p_vault_docs_insert ON documents_vault
  FOR INSERT
  WITH CHECK (uploaded_by_uid = auth.uid()::text);

DROP POLICY IF EXISTS p_vault_docs_staff ON documents_vault;
CREATE POLICY p_vault_docs_staff ON documents_vault
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') IN ('owner', 'employee', 'admin')
  );

-- ==============================================================================
-- 6. User Consents Register (152-ФЗ & 63-ФЗ PEP Immutability: Append-Only)
-- ==============================================================================
DROP POLICY IF EXISTS p_consents_insert_own ON user_consents;
CREATE POLICY p_consents_insert_own ON user_consents
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id IS NULL);

DROP POLICY IF EXISTS p_consents_select_own ON user_consents;
CREATE POLICY p_consents_select_own ON user_consents
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- IMMUTABILITY RULE: No client or user may ever UPDATE or DELETE legal consent records
REVOKE UPDATE, DELETE ON user_consents FROM authenticated, anon, public;

-- ==============================================================================
-- 7. Audit Logs & Decision Journal (Append-Only)
-- ==============================================================================
DROP POLICY IF EXISTS p_audit_logs_staff_read ON audit_logs;
CREATE POLICY p_audit_logs_staff_read ON audit_logs
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') IN ('owner', 'employee', 'admin')
  );

DROP POLICY IF EXISTS p_audit_logs_insert ON audit_logs;
CREATE POLICY p_audit_logs_insert ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- IMMUTABILITY RULE: Audit trails cannot be altered or purged
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated, anon, public;

-- ==============================================================================
-- 8. Server-Side Data Integrity & Validation Constraints (Item 06 & 10)
-- ==============================================================================
DO $$ 
BEGIN
  -- 1. Ensure positive pricing and area
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lots_price_positive') THEN
    ALTER TABLE lots ADD CONSTRAINT chk_lots_price_positive CHECK (ddu_contract_price > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lots_area_positive') THEN
    ALTER TABLE lots ADD CONSTRAINT chk_lots_area_positive CHECK (area_m2 > 0);
  END IF;

  -- 2. Non-negative installment amounts
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lots_installment_non_neg') THEN
    ALTER TABLE lots ADD CONSTRAINT chk_lots_installment_non_neg CHECK (installment_remaining_amount >= 0);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- Table will be verified upon creation
    NULL;
END $$;
