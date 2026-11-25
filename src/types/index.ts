export type Language = 'ru' | 'en';

export type RussianCityCode = 'spb' | 'msk' | 'sochi' | 'kazan' | 'ekb' | 'nsk' | 'nn';

export type PropertyDealTrack = 'ddu_cession' | 'secondary_dkp';
export type DealTrackMode = PropertyDealTrack;
export type DealTrackType = PropertyDealTrack;

export interface SecondaryRiskChecklist {
  bankruptcyChecked?: boolean;
  pndNdCertificates?: boolean;
  matkapitalChecked?: boolean;
  forma9Checked?: boolean;
  fullPriceInDkpConfirmed?: boolean;
  notaryRequired?: boolean;
  egrnExtractVerified?: boolean;
  registeredPersonsCleared?: boolean;
  utilityDebtsCleared?: boolean;
  legalCapacityConfirmed?: boolean;
  bankSettlementMethodSelected?: boolean;
  notes?: string;
}

export interface LegalRadarCheckItem {
  registry: string;
  registryId?: string;
  status: 'clear' | 'warning' | 'risk' | 'clean' | 'attention' | 'critical' | 'unchecked';
  checkedAt: string;
  checkedBy: string;
  note?: string;
}

export interface PepSignatureRecord {
  id: string;
  documentType: 'nda_viewing_act' | 'seller_exclusive_consent' | 'buyer_reservation_terms';
  documentVersion: string;
  lotCode: string;
  userId: string;
  userRole: string;
  userEmail: string;
  telegramChatId?: string;
  telegramUsername?: string;
  documentTitle: string;
  documentTextHashSha256: string;
  signedAt: string;
  ipHash: string;
  userAgentShort?: string;
  verificationMethod: 'telegram_otp_63fz';
  status: 'signed';
}

export interface MetroStationInfo {
  name: string;
  lineColor?: string;
  travelTimeText: string; // e.g. '5 мин. пешком' | '12 мин. транспортом'
  mode: 'walk' | 'drive';
}

export interface RentalPotentialInfo {
  longTermMonthlyRub: number; // e.g. 65000
  shortTermDailyRub: number; // e.g. 3800
  estimatedAnnualYieldPercent: number; // e.g. 8.4
}

export interface Lot {
  id: string;
  lotCode: string; // e.g. U-10566, U-14102
  complexName: string; // e.g. ЖК «Чистое Небо», ЖК «Pulse Premier»
  developer: string; // e.g. Setl Group, ПИК, Группа ЛСР
  city: RussianCityCode;
  district: string; // e.g. Приморский район, Пресненский район
  streetAddress?: string; // e.g. Комендантский пр., уч. 4
  areaM2: number;
  rooms: 'studio' | '1-room' | '2-room' | '3-room' | '4-room' | 'euro' | string;
  floor: number;
  totalFloors: number;
  ceilingHeightM?: number; // e.g. 2.78, 3.05
  districtAvgPricePerM2?: number; // e.g. 285000
  coordinates?: {
    lat: number;
    lng: number;
  };
  metroStations?: MetroStationInfo[];
  rentalPotential?: RentalPotentialInfo;
  deliveryDate: string; // e.g. 4 кв. 2026 г.
  deliveryYear: number;
  finishing: 'clean' | 'whitebox' | 'without' | 'turnkey' | string;
  imageUrl: string;
  images?: string[];
  galleryImages: string[];
  constructionReadinessPercent: number; // e.g. 82%

  // Financial Truth Engine variables
  dduContractPrice: number; // e.g. 10 972 000 ₽
  developerConsentFeeRub?: number; // Плата застройщика за согласование уступки
  developerConsentPolicy?: 'included_in_platform_fee' | 'paid_by_buyer'; // Включено в сбор платформы 2.5% или оплачивается покупателем
  contractTemplateRequirement?: 'developer_template' | 'domexit_template'; // Требование к шаблону договора
  cashPaidBySeller: number; // e.g. 2 485 230 ₽ (what seller gets now: 100% cash, 0% commission)
  sellerReturnRub?: number;
  remainingInstallmentDebt: number; // e.g. 8 486 770 ₽ (transfers to buyer)
  todayDeveloperPrice: number; // e.g. 14 200 000 ₽
  discountPercent?: number;
  discountRub?: number;
  installmentQuarterlyPayment: number; // e.g. 210 779 ₽ / квартал
  serviceCommissionRate: number; // 2.5%
  serviceCommissionRub: number; // 274 300 ₽ (paid strictly by buyer after Rosreestr)

  // Status & Flags
  isVerified: boolean;
  isUrgentExit: boolean;
  isNegotiable: boolean;
  is_negotiable?: boolean;
  sellerBanks?: string[];
  seller_banks?: string[];
  isFeatured: boolean;
  isPublished?: boolean;
  isApproved?: boolean;
  dealTrack?: PropertyDealTrack;
  dropConfig?: LotDropConfig;
  cadastralNumber?: string;
  secondaryRiskChecklist?: SecondaryRiskChecklist;
  legalRadarChecks?: LegalRadarCheckItem[];
  transactionType?: 'installment_cession' | 'mortgage_cession' | 'direct_sale_140fz';
  escrowBank: 'Sberbank' | 'VTB' | 'AlfaBank' | string;
  tags: string[];
  status?: 'available' | 'processing' | 'in_deal' | 'closed' | 'draft' | 'hidden' | 'blocked'; // Status in Catalog
  currentStage?: number; // Current deal stage 0-5 (0 = pending curator assignment)
  approvalStatus?:
    | 'approved'
    | 'approved_for_packaging'
    | 'pending_legal_audit'
    | 'pending_owner_approval'
    | 'pending_curator_assignment'
    | 'rejected';
  rejectionReason?: string;
  blockedReason?: string;
  moderationReason?: string;
  assignedEmployeeId?: string; // ID of assigned employee
  assignedCuratorId?: string; // Alias ID of assigned curator
  assignedEmployeeName?: string; // Name of assigned employee
  closedAt?: string;
  sellerUserId?: string; // ID of the seller user
  sellerClientCode?: string; // DEX-XXXXXX
  sellerInn?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  buyerUserId?: string;
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  referredByPartnerCode?: string;
  documentIds?: string[];

  // Seller photos & packaging approval
  sellerUploadedPhotos?: string[];
  sellerSubmittedImages?: string[];
  approvedGalleryImages?: string[];
  curatorApprovedImages?: string[];
  photos?: string[];
  floorRange?: string;
  legalReviewedByName?: string;

  // Additional documents requested by legal curator
  additionalDocsRequested?: {
    requestedList: string[];
    notes: string;
    requestedAt: string;
    status: 'pending' | 'submitted' | 'resolved';
    submittedDocs?: Array<{ name: string; url: string; uploadedAt: string; docId?: string }>;
  };

  // Operations log
  curatorOperationsLog?: Array<{
    timestamp: string;
    curatorName: string;
    action: string;
    notes: string;
  }>;

  // Partner bank special accreditation & developer accreditation
  specialApprovalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  specialApprovalBank?: string;
  developerInn?: string;
  developerAccreditationStatus?: 'accredited' | 'pending_bank_accreditation' | 'project_approved' | 'rejected';
  approvedBankFinancing?: {
    bankName: string;
    approvedRatePercent: number;
    maxPdnPercent: number;
    approvedAt: string;
    decidedBy: string;
    notes?: string;
  };
  approvedFinancingBanks?: Array<{
    bankName: string;
    approvedRatePercent: number;
    maxPdnPercent: number;
    approvedAt: string;
    decidedBy?: string;
    notes?: string;
  }>;

  // Telemetry & Engagement Metrics
  publishedAt?: string; // ISO Timestamp or formatted date
  viewsCount?: number;
  favoritesCount?: number;

  // Legal passport parameters (42 items summary)
  legalPassport: {
    passedChecksCount: number; // 42
    totalChecksCount: number; // 42
    antiBankruptcyIndex: number; // 98
    maternalCapitalUsed: boolean; // false
    spousalConsentNotarized: boolean; // true
    fsspDebtRub: number; // 0
    efrsbBankruptcyStatus: 'pending' | 'clean' | 'risk';
    nbkiScore: number; // 785
    pdnPercent: number; // 24%
    developerConsentObtained: boolean; // true
    rosreestrEsignSpeedHours: number; // 48
  };

  legalAuditCheckpoints?: LegalAuditCheckpoint[];
  legalAuditAxes?: LegalAuditAxis[];

  // Masked owner dossier (152-ФЗ)
  ownerDossier: {
    fullNameMasked: string; // Александр Владимирович Б.
    phoneMasked: string; // +7 911 ***-44-12
    dduNumber: string; // № ЧН-12/2-10566
    apartmentNumber: string; // Квартира № 418
    hideExactFloor: boolean;
    floorRangeDisplay: string; // 7–10 этаж
  };

  curator?: {
    name: string;
    role: string;
    phone: string;
    telegram: string;
    photoUrl?: string;
    whatsapp?: string;
    maxProfile?: string;
    bio?: string;
  };
}

export type DocumentCategory =
  | 'ddu_contract'
  | 'developer_payment_cert'
  | 'sfr_maternal_cap'
  | 'bank_statement_origin'
  | 'mortgage_approval'
  | 'buyer_cash_statement'
  | 'rosreestr_extract'
  | 'additional'
  | 'additional_documents';

export type DocumentReviewStatus = 'uploaded' | 'under_review' | 'approved' | 'rejected';

export interface DocumentMetadata {
  id: string;
  bucket: string; // e.g. 'domexit-yandex-s3-152fz'
  objectKey: string; // S3-compatible key e.g. 'sellers/DEX-784105/U-10566/ddu_contract_1730.pdf'
  key?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string; // ISO Timestamp
  uploadedByUid: string;
  clientCode: string; // DEX-XXXXXX
  entityType: 'seller_request' | 'lot' | 'buyer_application' | 'partner_application' | 'investor_application' | 'deal';
  entityId: string;
  category: DocumentCategory;
  categoryLabelRu?: string;
  status: DocumentReviewStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  sha256Hash?: string;
  previewDataUrl?: string; // Thumbnail or lightweight inline preview
  cloudUrl?: string;
  storageDriver: 'indexeddb_s3' | 'firebase_cloud' | 'yandex_s3';
  // Dual-compatibility bindings for YDB and legacy queries
  file_url?: string;
  url?: string;
  storage_path?: string;
  file_name?: string;
  fileName?: string;
  mime_type?: string;
  file_size?: number;
}

export interface SellerExitRequest {
  id: string;
  uid: string;
  clientCode: string; // DEX-XXXXXX
  lotId: string;
  lotCode: string;
  dealId: string;
  timestamp: string;
  sellerName: string;
  sellerPhone: string;
  sellerInn: string;
  city: RussianCityCode;
  district: string;
  streetAddress?: string;
  metroName?: string;
  metroTime?: number | string;
  metroTransport?: 'walk' | 'transport';
  coordinates?: {
    lat: number;
    lng: number;
  };
  complexName: string;
  developer: string;
  developerInn?: string;
  dduNumber: string;
  areaM2: number;
  rooms: Lot['rooms'];
  floor: number;
  totalFloors: number;
  ceilingHeightM?: number;
  finishing?: string;
  deliveryDate?: string;
  contractPriceRub: number;
  paidAmountRub: number;
  remainingDebtRub: number;
  todayDeveloperPrice?: number;
  exitRoute: 'ddu_assignment' | 'fast_cash' | 'trade_in_6';
  dealTrack?: PropertyDealTrack;
  dropConfig?: LotDropConfig;
  cadastralNumber?: string;
  secondaryRiskChecklist?: SecondaryRiskChecklist;
  isNegotiable?: boolean;
  is_negotiable?: boolean;
  sellerBanks?: string[];
  seller_banks?: string[];
  documentIds: string[];
  photos?: string[];
  sellerUploadedPhotos?: string[];
  matCapitalUsed?: boolean;
  status: 'pending_owner_review' | 'approved_assigned' | 'docs_requested' | 'rejected';
  rejectionReason?: string;
  requestedDocsList?: string[];
  requestedDocsNotes?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  referredByPartnerCode?: string;
}

export interface LegalAuditCheckpoint {
  id: 'efrsb' | 'fssp' | 'courts' | 'ddu_sfr';
  title: string;
  shortLabel: string;
  weightPercent: number; // efrsb: 25, fssp: 15, courts: 15, ddu_sfr: 45
  portalUrl: string;
  score: number; // 0 to 10
  status: 'pending' | 'clean' | 'attention' | 'critical';
  notes: string;
  proofDocUrl?: string;
  proofDocKey?: string;
  proofDocName?: string;
  evaluated: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

export type LegalAuditAxisStatus =
  | 'unverified'
  | 'verified_safe'
  | 'required_at_deal'
  | 'condition_found'
  | 'critical_risk';

export interface LegalAuditAxis {
  id:
    | 'title_encumbrances'
    | 'bankruptcy_debts'
    | 'developer_settlement'
    | 'family_matkap'
    | 'cession_escrow';
  title: string;
  shortLabel: string;
  status: LegalAuditAxisStatus;
  notes: string;
  defaultNotes?: string;
  portalUrl?: string;
  evaluated?: boolean;
  checkedAt?: string;
  checkedBy?: string;
  proofDocName?: string;
  proofDocKey?: string;
  proofDocUrl?: string;
}

export interface EscrowChatMessage {
  id: string;
  dealId: string;
  senderRole: 'buyer' | 'bank_officer' | 'curator';
  senderName: string;
  senderUid?: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'statement' | 'wire_receipt' | 'requisites' | 'document';
  timestamp: string;
  isEncryptedNotice?: boolean;
}

export interface BuyerCandidate {
  selectedBank?: string; // 'Сбербанк' | 'ВТБ' | 'Альфа-Банк' | 'ДОМ.РФ'
  id: string;
  code: string; // e.g. B-409
  lotCode?: string; // lot code applied for (e.g. U-10566)
  userId?: string; // user ID who submitted bid
  uid?: string; // canonical user UID
  clientCode?: string; // DEX-XXXXXX
  phone?: string;
  email?: string;
  name: string;
  location: string;
  matchScore: number; // e.g. 98%
  fundingType: 'cash' | 'family-mortgage' | 'liquidity-pool' | 'trade-in' | 'installment';
  buyerTrack?: 'full_cash' | 'mortgage_substitution'; // Track 1: full cash or Track 2: seller cash + mortgage
  creditLimitRub?: number; // Pre-approved credit ceiling
  bankApprovalDocUrl?: string; // Uploaded bank pre-approval cert url/data
  bankApprovalDocName?: string; // Uploaded file name
  bankStatementUrl?: string; // Recent bank statement for 100% cash track
  bankStatementName?: string;
  documentId?: string; // Reference into StorageService vault
  // Dual-compatibility bindings for YDB and legacy queries
  document_id?: string;
  bank_approval_doc_url?: string;
  bank_approval_doc_name?: string;
  bank_statement_url?: string;
  bank_statement_name?: string;
  file_url?: string;
  file_name?: string;
  storage_path?: string;
  curatorVerified?: boolean;
  curatorVerifiedAt?: string;
  curatorVerifiedBy?: string;
  isVerifiedByCurator?: boolean;
  readinessTimeline: string; // e.g. Наличные на руках — 48ч
  availableLiquidity: number; // e.g. 3 000 000 ₽
  priorityBadge?: string;
  status: 'pending' | 'priority_reserved' | 'under_review' | 'declined' | 'withdrawn_accepted_elsewhere';
  requestedTimestamp: string;
  timestamp?: string;
}

export interface DealTrack {
  id: string;
  lotId?: string;
  bankName?: string;
  dealId: string; // e.g. DEAL-2025-10566
  lotCode: string;
  lotTitle: string;
  developer: string;
  developerInn?: string;
  developerAccreditationStatus?: string;
  complexName?: string;
  city?: RussianCityCode;
  district?: string;
  sellerName?: string;
  sellerUserId?: string;
  sellerClientCode?: string;
  buyerName?: string;
  buyerUserId?: string;
  buyerClientCode?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  status?: 'active' | 'in_deal' | 'closed' | 'cancelled';
  closedAt?: string;
  partnerId?: string;
  partnerRefCode?: string;
  partnerRewardRub?: number;
  partnerPayoutStatus?: 'pending' | 'payable' | 'paid';
  route: 'ddu_assignment' | 'fast_cash' | 'trade_in_6';
  dealTrack?: PropertyDealTrack;
  stage: 'initial_audit' | 'document_check' | 'packaging' | 'buyer_matching' | 'closing_escrow' | 'completed';
  daysLeft: number;
  sellerReturnRub: number;
  discountRub: number;
  fsspClear: boolean;
  efrsbClear: boolean;
  matchingCandidatesCount: number;
  clientName: string;
  curatorName: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  createdDate: string;
  updatedDate: string;
  rosreestrPackageNumber?: string;
  escrowNumber?: string;

  // Closing sequence post-selection
  escrowWorkflow?: {
    step: ClosingStepId;
    bankName: string;
    escrowAccountNumber: string;
    depositedAmountRub: number;
    depositConfirmedAt?: string;
    signingProofPhotos: string[];
    signingProofVideos: string[];
    rosreestrStampDocUrl?: string;
    fundsReleasedAt?: string;
    platformFeeRub?: number;
    curatorHandoverAt?: string;
    // Phase B 6-step Russian closing fields (S3 objectKeys only, no Base64)
    pepOverrideReason?: string;
    pepOverrideDocKey?: string;
    cessionDraftDocKey?: string;
    cessionDraftDocName?: string;
    developerConsentDocKey?: string;
    developerConsentDocName?: string;
    notaryConsentConfirmed?: boolean;
    notaryConsentDocKey?: string;
    notaryConsentDocName?: string;
    sbrReceiptDocKey?: string;
    sbrReceiptDocName?: string;
    rosreestrKuvdNumber?: string;
    egrnExtractDocKey?: string;
    egrnExtractDocName?: string;
    sellerPayoutConfirmed?: boolean;
    platformFeeConfirmed?: boolean;
    developerFeeDeductedRub?: number;
  };
  actionItems?: DealActionItem[];
}

export interface DealActionItem {
  id: string;
  title: string;
  assignee: 'seller' | 'buyer';
  kind: 'upload_doc' | 'sign_pep' | 'confirm';
  pepDocumentType?: 'nda_viewing_act' | 'buyer_reservation_terms' | 'seller_exclusive_consent';
  status: 'pending' | 'submitted' | 'approved';
  createdAt: string;
  createdBy: string;
  submittedAt?: string;
  approvedAt?: string;
  uploadedDocKey?: string;
  uploadedDocName?: string;
  note?: string;
}

export type ClosingStepId =
  | 'pep_reservation'
  | 'developer_consent'
  | 'notary_and_sbr'
  | 'rosreestr_filing'
  | 'egrn_and_payout'
  | 'platform_fee_and_close'
  | 'deal_finalized'
  | 'curator_review'
  | 'bank_escrow_deposit'
  | 'signing_photos'
  | 'bank_funds_release'
  | 'deal_cancelled';

export interface InvestorApplication {
  id: string;
  userId?: string;
  uid?: string;
  clientCode?: string; // DEX-XXXXXX
  timestamp: string;
  fullName: string;
  companyOrFund?: string;
  countryAndCity: string;
  contactTelegramOrPhone: string;
  entityType: 'individual' | 'fund' | 'developer' | 'bank' | 'legal' | 'finishing' | 'agency';
  capitalVolume: '5-15m' | '15-50m' | '50-200m' | '>200m' | 'institutional';
  strategy: 'flipping' | 'rental_fitout' | 'equity_platform' | 'institutional_partnership';
  targetRegions: string[];
  requestedServices: string[];
  targetIrr?: string;
  customProposal: string;
  ndaAgreed: boolean;
  selectedBudgetMillions?: number;
  selectedPackage?: 'flipping' | 'turnkey' | 'syndicate';
  documentIds?: string[];
  status?: 'pending' | 'approved' | 'rejected' | 'docs_requested';
  isApproved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  requestedDocsNotes?: string;
}

export interface PartnerEntry {
  id: string;
  userId?: string;
  uid?: string;
  clientCode?: string; // DEX-XXXXXX
  timestamp?: string;
  name: string;
  role: string;
  organization: string;
  inn?: string;
  email?: string;
  city?: string;
  category: 'developer_cancellation' | 'mortgage_broker' | 'lawyer' | 'trade_in_developer';
  leadsCountMonthly: number;
  paidBonusesRub: number;
  pendingBonusesRub: number;
  fixedRewardPerDealRub: number; // 30 000 ₽
  referralCode: string;
  phone: string;
  documentIds?: string[];
  status?: 'pending' | 'approved' | 'rejected' | 'docs_requested';
  isApproved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  requestedDocsNotes?: string;
  lastPayoutAmountRub?: number;
  lastPayoutDate?: string;
  lastPayoutTransactionNumber?: string;
  lastPayoutBankName?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  telegram: string;
  whatsapp?: string;
  maxProfile?: string;
  photoUrl?: string;
  bio?: string;
  activeLotsCount: number;
  closedDealsCount: number;
  avgSpeedDays: number;
  status: 'active' | 'suspended';
  permissions: string[];
}

export interface UserProfile {
  id: string;
  clientCode: string; // e.g. DEX-784105
  name: string;
  phone: string;
  inn?: string;
  email?: string;
  telegram?: string;
  telegramUsername?: string;
  whatsapp?: string;
  maxProfile?: string;
  bankName?: string;
  photoURL?: string;
  yandexId?: string;
  roles: Array<'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner'>;
  role?: string;
  activeRole?: string;
  isPartnerApproved: boolean;
  isInvestorApproved: boolean;
  agreedPolicyVersion?: string;
  partnerRefCode?: string;
  partnerId?: string;
  referralCode?: string;
  assignedEmployeeId?: string;
  favorites: string[];
  registeredAt: string;
  activeDealId?: string;
  investorPackagePreference?: {
    budgetMillions: number;
    selectedPackage: 'flipping' | 'turnkey' | 'syndicate';
    updatedAt: string;
  };
  authProviders?: Array<'password' | 'yandex' | 'phone'>;
  hasPassword?: boolean;
  passwordSetupDismissedAt?: string;
  phoneNormalized?: string;
  phoneVerified?: boolean;
  tokenVersion?: number;
}

export interface KPIStats {
  todayNewRequestsCount: number;
  todayNewRequestsGrowth: string;
  todayNewRequestsReturnRub: number;
  activeLotsCount: number;
  activeLotsSpbCount: number;
  activeLotsMskCount: number;
  activeLotsRegionsCount?: number;
  averageDiscountPercent: number;
  dealsInEscrowStageCount: number;
  dealsInEscrowTotalRub: number;
  dealsInSberCount: number;
  dealsInVtbCount: number;
  expectedCommissionMonthlyRub: number;
  actualCommissionMonthlyRub: number;
  reservedCommissionMonthlyRub: number;
  sellerCommissionTotalRub: number;
}

// District Yield & Capital Growth Engine Config (Task 4)
export interface DistrictYieldConfig {
  districtNameRu: string; // e.g. 'Приморский район', 'Московский район', 'Пресненский район'
  city?: RussianCityCode;
  dailyRentPercentOfMarket: number; // e.g. 0.05 (% of current developer/market price per day)
  monthlyRentPercentOfMarket: number; // e.g. 0.65 (% of current developer/market price per month)
  annualGrowthPercent: number; // e.g. 11 (% expected annual capital growth)
  updatedAt: string;
  updatedBy?: string;
}

// Market Parameters & Rates Settings (Task 2 & Task 4)
export interface MarketSettings {
  id: string; // 'market_parameters'
  cbrKeyRatePercent: number; // Key / Market mortgage rate ЦБ РФ (e.g. 23%)
  familyMortgageRatePercent: number; // Subsidized Family Mortgage (e.g. 6%)
  developerPenaltyPercent: number; // Developer cancellation penalty (e.g. 15%)
  buyerCommissionPercent: number; // Platform commission for buyer (e.g. 2.5%)
  districtYieldConfigs?: Record<string, DistrictYieldConfig>;
  updatedAt: string;
  updatedBy?: string;
}

// Developer Accreditation Engine Types (Task 1 & Task 2)
export type PartnerBankName = 'Сбербанк' | 'ВТБ' | 'Альфа-Банк' | 'ДОМ.РФ';

export interface DeveloperBankTerms {
  bankName: PartnerBankName;
  isAccredited: boolean;
  baseRatePercent: number; // e.g. 19.8%
  familyMortgage6: boolean; // Семейная ипотека 6%
  itMortgage6: boolean; // IT-ипотека 6%
  maxPdnPercent: 40 | 50 | 60; // Max Debt-to-Income ratio (ПДН) allowed by bank
  accreditedAt?: string;
  accreditedBy?: string;
}

export interface AccreditedDeveloper {
  id: string;
  name: string; // e.g. 'ПИК', 'Setl Group', 'Самолёт'
  inn: string; // 10-digit corporate ИНН or 12-digit for ИП
  isAccredited: boolean;
  isActive?: boolean;
  regions?: RussianCityCode[];
  registrationSource?: 'institutional' | 'project_approval' | 'seed' | 'seller_submission';
  registered_via_project?: boolean;
  registrationNote?: string;
  bankTerms: DeveloperBankTerms[];
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedBankFinancing {
  bankName: PartnerBankName | string;
  baseRatePercent: number;
  maxPdnPercent: 40 | 50 | 60;
  familyMortgage6: boolean;
  itMortgage6: boolean;
  source: 'developer' | 'project';
  isAccredited: boolean;
  sourceLabel: string; // 'Генеральная аккредитация девелопера' | 'Проектное финансирование объекта'
  accreditedAt?: string;
  decidedBy?: string;
}

export interface DeveloperAccreditationRequest {
  id: string;
  developerName: string;
  developerInn: string;
  lotId: string;
  lotCode: string;
  complexName: string;
  city: RussianCityCode;
  district: string;
  contractPriceRub: number;
  sellerName: string;
  sellerClientCode: string;
  documentIds: string[]; // DDU contract, payment cert, project plan
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decisions: Array<{
    bankName: PartnerBankName;
    decision: 'approved' | 'rejected';
    baseRatePercent?: number;
    familyMortgage6?: boolean;
    itMortgage6?: boolean;
    maxPdnPercent?: 40 | 50 | 60;
    notes?: string;
    decidedBy: string;
    decidedAt: string;
  }>;
}

// Partner Preliminary Referral with 7-Day Expiration (Task 4)
export interface PartnerPreliminaryRequest {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerRefCode: string;
  clientCode: string; // DEX-XXXXXX
  clientUserId?: string;
  clientName: string;
  clientPhone: string;
  complexName: string;
  developer: string;
  paidAmountRub: number;
  contractPriceRub: number;
  remainingDebtRub: number;
  notes?: string;
  createdAt: string;
  expiresAt: string; // 7-day countdown deadline
  status: 'pending_client' | 'completed' | 'converted_to_lot' | 'expired';
  activatedLotId?: string;
  activatedLotCode?: string;
  activatedDealId?: string;
}

// Partner Bank Portal & Tenant Types
export interface PartnerBankEntity {
  id: string; // e.g. 'bank-sber', 'bank-vtb', 'bank-alfa', 'bank-domrf'
  name: string; // 'Сбербанк' | 'ВТБ' | 'Альфа-Банк' | 'ДОМ.РФ' or custom
  logoUrl?: string;
  masterAdminEmail: string;
  status: 'active' | 'suspended';
  contactPhone?: string;
  contactPerson?: string;
  createdAt: string;
  kpis: {
    escrowAccountsCount: number;
    totalEscrowRub: number;
    avgApprovalDays: number;
    devApprovalRatePercent: number;
    devRejectionRatePercent: number;
  };
}

export type BankTabPermission = 'escrow' | 'developer_accreditation' | 'special' | 'staff';

export interface BankEmployee {
  id: string;
  name: string;
  email: string;
  role: 'chief_manager' | 'head_manager' | 'officer' | 'escrow_agent';
  bankName: string; // 'Сбербанк' | 'ВТБ' | 'Альфа-Банк' | 'ДОМ.РФ'
  status: 'active' | 'suspended';
  phone?: string;
  createdAt: string;
  isMasterAdmin?: boolean;
  permissions?: BankTabPermission[];
}

export interface SpecialApprovalRequest {
  id: string;
  lotId: string;
  lotCode: string;
  complexName: string;
  developer: string;
  developerInn?: string;
  contractorName?: string; // Grouping by contractor
  contractorInn?: string;
  projectTitle?: string;
  location?: string;
  costPriceRub?: number;
  contractPriceRub: number;
  requestedByEmployeeId: string;
  requestedByEmployeeName: string;
  bankName: string;
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedRatePercent?: number;
  maxPdnPercent?: 40 | 50 | 60;
  documentIds?: string[];
  decisionNotes?: string;
  decidedAt?: string;
  decidedBy?: string;
}

// Operations & Decisions Audit Log (Task 7 & 12)
export interface AuditLogEntry {
  id: string;
  timestamp: string; // Full ISO timestamp
  lotCode?: string;
  dealId?: string;
  operatorId: string;
  operatorName: string;
  operatorRole: 'curator' | 'owner' | 'system' | 'client';
  actionType:
    | 'legal_approved'
    | 'legal_rejected'
    | 'doc_requested'
    | 'doc_uploaded'
    | 'document_vault_action'
    | 'packaging_published'
    | 'buyer_matched'
    | 'pep_paper_override'
    | 'buyer_bid_submitted'
    | 'seller_request_submitted'
    | 'seller_request_decided'
    | 'partner_application_submitted'
    | 'partner_application_decided'
    | 'partner_payout_confirmed'
    | 'investor_application_submitted'
    | 'investor_application_decided'
    | 'lot_assigned_to_curator'
    | 'escrow_transferred_to_bank'
    | 'escrow_funds_deposited'
    | 'signing_docs_uploaded'
    | 'signing_proof_uploaded'
    | 'funds_released_closed'
    | 'escrow_released'
    | 'deal_cancelled_relisted'
    | 'packaging_photos_approved'
    | 'special_bank_approval_requested'
    | 'special_bank_approval_decided'
    | 'developer_accreditation_submitted'
    | 'developer_accreditation_decided'
    | 'credit_limit_granted'
    | 'market_settings_updated'
    | 'company_profile_updated'
    | 'security_incident_reported'
    | 'employee_created_modified'
    | 'tier_upgrade_approved'
    | 'tier_upgrade_rejected'
    | 'tier_modified_manual'
    | 'sla_reliability_restored';
  title: string;
  description: string;
  attachments?: Array<{ name: string; url: string }>;
  metadata?: Record<string, any>;
}

export interface CompanyLegalProfile {
  id: string; // 'company_legal_profile'
  fullName: string;
  shortName: string;
  entityType: 'ООО' | 'АО' | 'ИП';
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  postalAddress: string;
  generalDirector: string;
  dpoName: string;
  privacyEmail: string;
  officialPhone: string;
  bankName: string;
  bik: string;
  checkingAccount: string;
  correspondentAccount: string;
  updatedAt: string;
}

export interface UserConsentRecord {
  id: string; // consent_id
  userId?: string;
  clientCode?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  policyVersion: string; // e.g. '2026-v1.0'
  formSource: string; // e.g. 'seller_exit_form', 'buyer_bid_modal', 'registration'
  consentItems: {
    pdProcessing: boolean; // ст. 9 152-ФЗ
    termsAgreed: boolean; // Пользовательское соглашение
    ads: boolean; // ст. 18 38-ФЗ
    distribution?: boolean; // ст. 10.1 152-ФЗ
  };
}

export type IncidentCategory = 'waf_security_event' | 'pdn_breach_152fz';

export interface SecurityIncidentRecord {
  id: string;
  category?: IncidentCategory;
  type?: string;
  timestamp: string;
  createdAt?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary?: string;
  description: string;
  affectedRecordsCount?: number;
  requiresRknNotification?: boolean;
  reportedToRoskomnadzor: boolean;
  roskomnadzorDraft?: string;
  roskomnadzorNotificationDate?: string;
  resolvedAt?: string;
  deadline24h?: string;
  status: 'open' | 'investigating' | 'notified_rkn' | 'contained' | 'resolved';
  actorUserId?: string;
  actorRole?: string;
  ipHash?: string;
  endpoint?: string;
  collection?: string;
  details?: any;
}

export interface CookieConsentPreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

export interface PublicChannelsConfig {
  id: string; // 'public_channels'
  telegramChannelUrl: string; // Telegram-канал лотов
  telegramBotUrl: string; // Telegram-бот
  maxProfileUrl: string; // Официальный профиль MAX
  vkCommunityUrl: string; // VK Сообщество
  hotlinePhone: string; // Номер горячей линии
  supportEmail: string; // Официальный email
  updatedAt: string;
}

// SEO Knowledge Hub & Articles
export type KnowledgeArticleCategory = 'ddu' | 'mortgage' | 'law140' | 'matkapital' | 'general';

export interface TableOfContentsItem {
  id: string;
  title: string;
}

export interface LegalCallout {
  lawCode: string; // e.g. '214-ФЗ ст. 11', '140-ФЗ ст. 37.1', '256-ФЗ', '152-ФЗ'
  title: string;
  description: string;
  badgeType: 'warning' | 'info' | 'success' | 'danger';
}

export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: KnowledgeArticleCategory;
  categoryLabel: string;
  readTimeMinutes: number;
  publishedAt: string;
  updatedAt: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  keywords: string[];
  tableOfContents: TableOfContentsItem[];
  legalCallouts?: LegalCallout[];
  content: string; // Structured HTML or markdown
}

// FAQ Items
export type FaqCategory = 'installments_ddu' | 'mortgage_banks' | 'law140_pledge' | 'matkapital_escrow';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  categoryLabel: string;
  order: number;
  relatedArticleSlug?: string;
  lawReferences?: string[];
}

// Legal Policy Versioning & Proof of Consent (152-FZ & Roskomnadzor)
export type LegalPolicyType =
  | 'privacy'
  | 'user_agreement'
  | 'cookies'
  | 'advertising_consent'
  | 'public_distribution_consent';

export interface LegalPolicyVersion {
  id: string;
  policyType: LegalPolicyType;
  policyNameRu: string;
  versionNumber: string; // e.g. "2.1", "2.2"
  effectiveDate: string; // ISO date string (YYYY-MM-DD)
  changeType: 'minor' | 'material'; // 'material' triggers ConsentGateModal for users
  changeSummary: string; // Short changelog summary
  fullText: string;
  sha256Hash: string; // Cryptographic SHA-256 hash of the exact legal text
  isCurrent: boolean;
  createdAt: string;
  createdBy: string;
}

export interface ProofOfConsentRecord {
  id: string;
  userId: string;
  clientCode?: string;
  userFullName?: string;
  policyType: LegalPolicyType;
  policyVersion: string;
  policySha256: string;
  consentedAt: string; // ISO timestamp
  ipAddress?: string;
  userAgent?: string;
  consentMethod: 'web_form' | 'reconsent_modal' | 'portal_action';
  isWithdrawn?: boolean;
  withdrawnAt?: string;
}

export interface CuratorMessage {
  id: string;
  dealId?: string;
  lotId?: string;
  lotCode?: string;
  threadChannel?: 'seller_curator' | 'buyer_curator';
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller' | 'employee' | 'owner';
  curatorId?: string;
  text: string;
  source?: 'web' | 'telegram';
  createdAt: string;
  isRead: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface LotDropConfig {
  mode: 'staged_drop' | 'open';
  launchedAt: string;
  launchedBy: string;
  goldExclusiveHours: number;
  goldExclusiveUntil: string;
  windowHours: number;
  closesAt: string;
  maxApplicationsCap: number;
  currentValidApplications: number;
  waveStatus: 'draft' | 'gold_wave' | 'silver_wave' | 'capped_closed' | 'expired_closed';
  matchedGoldCount: number;
  matchedSilverCount: number;
  silverWaveNotifiedAt?: string;
  reDropCount?: number;
  staleAlertedAt?: string;
}

export type BuyBoxTier = 'gold' | 'silver' | 'bronze';
export type BuyBoxPaymentMethod =
  | 'cash_100'
  | 'family_mortgage_approved'
  | 'standard_mortgage_approved'
  | 'alternative';
export type BuyBoxGoal = 'living' | 'flipping' | 'rental';

export interface BuyerBuyBox {
  id: string; // format: bb:{userId}
  userId: string;
  active: boolean;
  cities: string[];
  districts: string[];
  complexNames: string[];
  dealTracks: ('ddu_cession' | 'secondary_dkp')[];
  rooms: string[];
  minAreaM2?: number;
  maxAreaM2?: number;
  maxBudgetRub: number;
  minDiscountPercent: number;
  paymentMethod: BuyBoxPaymentMethod;
  preferredBanks: string[];
  goal: BuyBoxGoal;
  readinessHours: number;
  availableLiquidityRub?: number;
  tier: BuyBoxTier;
  tierVerifiedAt?: string;
  tierVerifiedBy?: string;
  tierNote?: string;
  reliabilityScore: number;
  noShowCount: number;
  withdrawalCount?: number;
  completedViewingsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type QueueStatus =
  | 'pending_review'
  | 'priority_1'
  | 'in_deal'
  | 'reserve_2'
  | 'reserve_3'
  | 'waitlist'
  | 'standby_in_other_deal'
  | 'deposit_paid'
  | 'expired'
  | 'withdrawn'
  | 'withdrawn_from_queue'
  | 'withdrawn_from_deal'
  | 'completed'
  | 'lot_closed'
  | 'rejected';

export type PriceAcceptance = 'full_price' | 'above_asking' | 'discount_requested';

export interface ApplicationProofDocument {
  name: string;
  objectKey: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export type CuratorVerificationStatus = 'pending' | 'verified' | 'needs_clarification';

export interface BuyerApplication {
  id: string;
  lotCode: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerTelegram?: string;
  telegramUsername?: string;
  telegramChatId?: string;
  buyBoxId?: string;
  status?: string;
  closingScore?: number;
  matchScore?: number;
  scoreBreakdown?: Record<string, number>;
  queuePosition?: number;
  queueStatus?: QueueStatus;
  activeDealLotCode?: string;
  withdrawnAt?: string;
  completedAt?: string;
  withdrawalReason?: string;
  tier?: BuyBoxTier;
  reliabilityScore?: number;
  availableLiquidityRub?: number;
  confirmedCashRub?: number;
  paymentMethod?: BuyBoxPaymentMethod;
  buyerComment?: string;
  proofDocuments?: ApplicationProofDocument[];
  curatorVerificationStatus?: CuratorVerificationStatus;
  curatorVerificationNote?: string;
  curatorVerifiedAt?: string;
  curatorVerifiedBy?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  lotTitle?: string;
  lotDistrict?: string;
  lotPriceRub?: number;
  lotDduPriceRub?: number;
  lotStatus?: string;
  dealStage?: string;
  curatorName?: string;
  priceAcceptance?: PriceAcceptance;
  offeredPriceRub?: number;
  readiness24h?: boolean;
  deposit48h?: boolean;
  viewingDeadlineAt?: string;
  depositDeadlineAt?: string;
  deadlineAlertedAt?: string;
  promotedFromReserveAt?: string;
  ndaSigned?: boolean;
  source?: 'web' | 'telegram';
  createdAt: string;
  updatedAt?: string;
}

export type TierVerificationProofType = 'cash_100_statement' | 'mortgage_approval';
export type TierVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface TierVerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  currentTier: BuyBoxTier;
  requestedTier: 'gold';
  proofType: TierVerificationProofType;
  declaredBudgetRub: number;
  documentKey: string;
  documentName: string;
  documentMime: string;
  documentSize: number;
  comment?: string;
  status: TierVerificationStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export * from './legal';
