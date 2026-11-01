export type Language = 'ru' | 'en';

export type RussianCityCode = 'spb' | 'msk' | 'sochi' | 'kazan' | 'ekb' | 'nsk' | 'nn';

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
  rooms: 'studio' | '1-room' | '2-room' | '3-room' | 'euro';
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
  finishing: 'clean' | 'whitebox' | 'without';
  imageUrl: string;
  galleryImages: string[];
  constructionReadinessPercent: number; // e.g. 82%

  // Financial Truth Engine variables
  dduContractPrice: number; // e.g. 10 972 000 ₽
  cashPaidBySeller: number; // e.g. 2 485 230 ₽ (what seller gets now: 100% cash, 0% commission)
  remainingInstallmentDebt: number; // e.g. 8 486 770 ₽ (transfers to buyer)
  todayDeveloperPrice: number; // e.g. 14 200 000 ₽
  installmentQuarterlyPayment: number; // e.g. 210 779 ₽ / квартал
  serviceCommissionRate: number; // 2.5%
  serviceCommissionRub: number; // 274 300 ₽ (paid strictly by buyer after Rosreestr)

  // Status & Flags
  isVerified: boolean;
  isUrgentExit: boolean;
  isNegotiable: boolean;
  isFeatured: boolean;
  isEarlyAccessVIP?: boolean; // 48-hour VIP Investor early access window
  earlyAccessHoursLeft?: number;
  escrowBank: 'Sberbank' | 'VTB' | 'AlfaBank';
  tags: string[];
  status?: 'available' | 'processing' | 'closed'; // Status in Catalog
  currentStage?: number; // Current deal stage 1-5
  approvalStatus?: 'approved' | 'pending_owner_approval' | 'rejected';
  rejectionReason?: string;
  assignedEmployeeId?: string; // ID of assigned employee
  assignedEmployeeName?: string; // Name of assigned employee
  sellerUserId?: string; // ID of the seller user
  sellerClientCode?: string; // DEX-XXXXXX
  sellerInn?: string;
  referredByPartnerCode?: string;
  documentIds?: string[];

  // Seller photos & packaging approval
  sellerUploadedPhotos?: string[];
  approvedGalleryImages?: string[];

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
  };

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
    efrsbBankruptcyStatus: 'clean' | 'risk';
    nbkiScore: number; // 785
    pdnPercent: number; // 24%
    developerConsentObtained: boolean; // true
    rosreestrEsignSpeedHours: number; // 48
  };

  // Masked owner dossier (152-ФЗ)
  ownerDossier: {
    fullNameMasked: string; // Александр Владимирович Б.
    phoneMasked: string; // +7 911 ***-44-12
    dduNumber: string; // № ЧН-12/2-10566
    apartmentNumber: string; // Квартира № 418
    hideExactFloor: boolean;
    floorRangeDisplay: string; // 7–10 этаж
  };

  curator: {
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
  | 'additional';

export type DocumentReviewStatus = 'uploaded' | 'under_review' | 'approved' | 'rejected';

export interface DocumentMetadata {
  id: string;
  bucket: string; // e.g. 'domexit-yandex-s3-152fz'
  objectKey: string; // S3-compatible key e.g. 'sellers/DEX-784105/U-10566/ddu_contract_1730.pdf'
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
  complexName: string;
  developer: string;
  developerInn?: string;
  dduNumber: string;
  areaM2: number;
  rooms: Lot['rooms'];
  floor: number;
  totalFloors: number;
  contractPriceRub: number;
  paidAmountRub: number;
  remainingDebtRub: number;
  exitRoute: 'ddu_assignment' | 'fast_cash' | 'trade_in_6';
  documentIds: string[];
  status: 'pending_owner_review' | 'approved_assigned' | 'docs_requested' | 'rejected';
  rejectionReason?: string;
  requestedDocsList?: string[];
  requestedDocsNotes?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  referredByPartnerCode?: string;
}

export interface BuyerCandidate {
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
  dealId: string; // e.g. DEAL-2025-10566
  lotCode: string;
  lotTitle: string;
  developer: string;
  complexName?: string;
  city?: RussianCityCode;
  district?: string;
  sellerName?: string;
  sellerUserId?: string;
  sellerClientCode?: string;
  buyerName?: string;
  buyerUserId?: string;
  buyerClientCode?: string;
  partnerRefCode?: string;
  partnerRewardRub?: number;
  partnerPayoutStatus?: 'pending' | 'paid';
  route: 'ddu_assignment' | 'fast_cash' | 'trade_in_6';
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
  createdDate: string;
  updatedDate: string;
  rosreestrPackageNumber?: string;
  escrowNumber?: string;

  // Closing sequence post-selection
  escrowWorkflow?: {
    step: 'curator_review' | 'bank_escrow_deposit' | 'signing_photos' | 'bank_funds_release' | 'deal_finalized' | 'deal_cancelled';
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
  };
}

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
  rejectionReason?: string;
  requestedDocsNotes?: string;
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
  email?: string;
  telegram?: string;
  whatsapp?: string;
  maxProfile?: string;
  bankName?: string;
  photoURL?: string;
  roles: Array<'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner' | 'bank_officer' | 'bank'>;
  role?: string;
  activeRole?: string;
  isPartnerApproved: boolean;
  isInvestorApproved: boolean;
  partnerRefCode?: string;
  assignedEmployeeId?: string;
  favorites: string[];
  registeredAt: string;
  activeDealId?: string;
  investorPackagePreference?: {
    budgetMillions: number;
    selectedPackage: 'flipping' | 'turnkey' | 'syndicate';
    updatedAt: string;
  };
  bankCreditLimit?: {
    approvedLimitRub: number;
    validUntil: string;
    certificateNumber: string;
    bankName: string;
    issuedAt: string;
  };
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
  registrationSource?: 'institutional' | 'project_approval' | 'seed';
  registrationNote?: string;
  bankTerms: DeveloperBankTerms[];
  createdAt: string;
  updatedAt: string;
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
  status: 'pending_client' | 'completed' | 'expired';
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

export type BankTabPermission = 'escrow' | 'developer_accreditation' | 'special' | 'credit_limits' | 'staff';

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

export interface BuyerCreditLimitRequest {
  id: string;
  userId: string;
  uid?: string;
  clientCode: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  incomeProofType?: string;
  monthlyIncomeRub?: number;
  requestedAmountRub: number;
  approvedLimitRub?: number;
  validUntil?: string; // YYYY-MM-DD
  bankName: string;
  status: 'pending' | 'approved' | 'rejected';
  certificateNumber?: string;
  reviewedBy?: string;
  requestedAt: string;
  timestamp?: string;
  reviewedAt?: string;
  notes?: string;
  rejectionReason?: string;
}

// Operations & Decisions Audit Log (Task 7 & 12)
export interface AuditLogEntry {
  id: string;
  timestamp: string; // Full ISO timestamp
  lotCode?: string;
  dealId?: string;
  operatorId: string;
  operatorName: string;
  operatorRole: 'curator' | 'bank_officer' | 'owner' | 'system' | 'client';
  actionType:
    | 'legal_approved'
    | 'legal_rejected'
    | 'doc_requested'
    | 'doc_uploaded'
    | 'document_vault_action'
    | 'packaging_published'
    | 'buyer_matched'
    | 'buyer_bid_submitted'
    | 'seller_request_submitted'
    | 'seller_request_decided'
    | 'partner_application_submitted'
    | 'partner_application_decided'
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
    | 'vip_telegram_broadcast'
    | 'special_bank_approval_requested'
    | 'special_bank_approval_decided'
    | 'developer_accreditation_submitted'
    | 'developer_accreditation_decided'
    | 'credit_limit_granted'
    | 'market_settings_updated'
    | 'employee_created_modified';
  title: string;
  description: string;
  attachments?: Array<{ name: string; url: string }>;
  metadata?: Record<string, any>;
}
