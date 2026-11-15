/**
 * Enterprise Legal CMS Data Models (152-FZ, 38-FZ, 149-FZ, 214-FZ Compliance)
 */

export interface LegalSocialLinks {
  telegram_channel: string;
  telegram_bot: string;
  vk: string;
  max: string;
}

export interface LegalSettings {
  id: string; // 'legal_settings_singleton'
  company_name: string;
  company_short_name: string;
  ogrn: string;
  inn: string;
  kpp: string;
  legal_address: string;
  moscow_office: string;
  bank_details: string;
  dpo_name: string;
  support_phone: string;
  legal_email: string;
  privacy_email: string;
  partners_email: string;
  banks_email: string;
  security_email: string;
  security_phone: string;
  domain_url: string;
  hosting_info: string;
  social_links: LegalSocialLinks;
  updated_at: string;
}

export type LegalDocumentCategory =
  | 'general'
  | 'basic_regulations'
  | 'transactional'
  | 'deal_regulations'
  | 'privacy_consents'
  | 'partners_b2b'
  | 'compliance_aml'
  | 'promotions'
  | 'archive';

export type LegalDocumentStage = 'stage_1' | 'stage_2';

export interface LegalDocument {
  id: string;
  code: string; // e.g. "1.1", "1.2", "3.1", "3.5", "3.6", "3.7", "3.8", "4.1"
  slug: string; // e.g. "terms", "privacy", "consent-pd", "consent-ads", "cookies", "call-recording"
  title: string;
  short_title: string;
  subtitle_badge: string;
  legal_basis: string;
  summary_box_title: string;
  summary_box_items: string[];
  category: LegalDocumentCategory;
  stage: LegalDocumentStage;
  is_visible: boolean;
  show_in_footer: boolean;
  active_revision_id: string;
  active_version: string;
  active_sha256: string;
  updated_at: string;
}

export type LegalRevisionStatus = 'draft' | 'published' | 'archived';

export interface LegalRevision {
  id: string;
  document_id: string;
  document_slug: string;
  document_title: string;
  version_number: string; // e.g. "1.0", "2.1"
  status: LegalRevisionStatus;
  change_note: string;
  is_material_change: boolean;
  raw_content: string; // Content with {{company.*}} tags
  rendered_snapshot: string; // Frozen plain text with substituted values
  company_variables_snapshot: Partial<LegalSettings>;
  sha256_hash: string;
  effective_from: string; // ISO date or "01.03.2026"
  effective_to: string | null; // null for active version
  created_by: string;
  created_at: string;
}

export interface ConsentedDocumentItem {
  document_slug: string;
  revision_version: string;
  sha256_hash: string;
  is_accepted: boolean;
}

export interface UserConsentLog {
  id: string;
  user_id: string;
  user_name: string;
  phone: string;
  email: string;
  action_type:
    | 'registration'
    | 'seller_submission'
    | 'buyer_reservation'
    | 'partner_application'
    | 'cookie_consent'
    | 'policy_reconsent';
  consented_documents: ConsentedDocumentItem[];
  user_agent: string;
  ip_masked: string;
  created_at: string;
}
