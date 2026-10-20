export type Language = 'ru' | 'en';

export interface Lot {
  id: string;
  lotCode: string; // e.g. U-10566, U-14102
  complexName: string; // e.g. ЖК «Чистое Небо», ЖК «Pulse Premier»
  developer: string; // e.g. Setl Group, ПИК, Группа ЛСР
  city: 'spb' | 'msk';
  district: string; // e.g. Приморский район, Невский район
  areaM2: number;
  rooms: 'studio' | '1-room' | '2-room' | '3-room' | 'euro';
  floor: number;
  totalFloors: number;
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
  escrowBank: 'Sberbank' | 'VTB' | 'AlfaBank';
  tags: string[];
  status?: 'available' | 'processing' | 'closed'; // Status in Catalog
  currentStage?: number; // Current deal stage 1-5
  approvalStatus?: 'approved' | 'pending_owner_approval' | 'rejected';
  assignedEmployeeId?: string; // ID of assigned employee
  assignedEmployeeName?: string; // Name of assigned employee
  sellerUserId?: string; // ID of the seller user

  // Seller photos & packaging approval
  sellerUploadedPhotos?: string[];
  approvedGalleryImages?: string[];

  // Additional documents requested by legal curator
  additionalDocsRequested?: {
    requestedList: string[];
    notes: string;
    requestedAt: string;
    status: 'pending' | 'submitted' | 'resolved';
    submittedDocs?: Array<{ name: string; url: string; uploadedAt: string }>;
  };

  // Operations log
  curatorOperationsLog?: Array<{
    timestamp: string;
    curatorName: string;
    action: string;
    notes: string;
  }>;

  // Partner bank special accreditation
  specialApprovalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  specialApprovalBank?: string;

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
    bio?: string;
  };
}

export interface BuyerCandidate {
  id: string;
  code: string; // e.g. B-409
  lotCode?: string; // lot code applied for (e.g. U-10566)
  userId?: string; // user ID who submitted bid
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
  curatorVerified?: boolean;
  curatorVerifiedAt?: string;
  curatorVerifiedBy?: string;
  isVerifiedByCurator?: boolean;
  readinessTimeline: string; // e.g. Наличные на руках — 48ч
  availableLiquidity: number; // e.g. 3 000 000 ₽
  priorityBadge?: string;
  status: 'pending' | 'priority_reserved' | 'under_review' | 'declined' | 'withdrawn_accepted_elsewhere';
  requestedTimestamp: string;
}

export interface DealTrack {
  id: string;
  dealId: string; // e.g. DEAL-2025-10566
  lotCode: string;
  lotTitle: string;
  developer: string;
  complexName?: string;
  sellerName?: string;
  buyerName?: string;
  route: 'ddu_assignment' | 'fast_cash' | 'trade_in_6';
  stage: 'initial_audit' | 'document_check' | 'packaging' | 'buyer_matching' | 'closing_escrow';
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
  customProposal: string;
  ndaAgreed: boolean;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface PartnerEntry {
  id: string;
  userId?: string;
  name: string;
  role: string;
  organization: string;
  category: 'developer_cancellation' | 'mortgage_broker' | 'lawyer' | 'trade_in_developer';
  leadsCountMonthly: number;
  paidBonusesRub: number;
  pendingBonusesRub: number;
  fixedRewardPerDealRub: number; // 30 000 ₽
  referralCode: string;
  phone: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  telegram: string;
  whatsapp?: string;
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
  photoURL?: string;
  roles: Array<'buyer' | 'seller' | 'partner' | 'investor' | 'employee' | 'owner' | 'bank_officer'>;
  role?: string;
  activeRole?: string;
  isPartnerApproved: boolean;
  isInvestorApproved: boolean;
  partnerRefCode?: string;
  assignedEmployeeId?: string;
  favorites: string[];
  registeredAt: string;
  activeDealId?: string;
  bankCreditLimit?: {
    approvedLimitRub: number;
    validUntil: string;
    certificateNumber: string;
    bankName: string;
    issuedAt: string;
  };
}

export interface KPIStats {
  todayNewRequestsCount: number; // 18
  todayNewRequestsGrowth: string; // +24% к н/н
  todayNewRequestsReturnRub: number; // 42 500 000 ₽
  activeLotsCount: number; // 142
  activeLotsSpbCount: number; // 98
  activeLotsMskCount: number; // 44
  averageDiscountPercent: number; // 18.2%
  dealsInEscrowStageCount: number; // 9
  dealsInEscrowTotalRub: number; // 84 600 000 ₽
  dealsInSberCount: number; // 7
  dealsInVtbCount: number; // 2
  expectedCommissionMonthlyRub: number; // 3 850 000 ₽
  actualCommissionMonthlyRub: number; // 2 140 000 ₽
  reservedCommissionMonthlyRub: number; // 1 710 000 ₽
  sellerCommissionTotalRub: number; // 0 ₽
}

// Market Parameters & Rates Settings (Task 2)
export interface MarketSettings {
  id: string; // 'market_parameters'
  cbrKeyRatePercent: number; // Key / Market mortgage rate ЦБ РФ (e.g. 23%)
  familyMortgageRatePercent: number; // Subsidized Family Mortgage (e.g. 6%)
  developerPenaltyPercent: number; // Developer cancellation penalty (e.g. 15%)
  buyerCommissionPercent: number; // Platform commission for buyer (e.g. 2.5%)
  updatedAt: string;
  updatedBy?: string;
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
}

// Partner Bank Portal Types (Task 6)
export interface BankEmployee {
  id: string;
  name: string;
  email: string;
  role: 'chief_manager' | 'head_manager' | 'officer' | 'escrow_agent';
  bankName: string; // 'Сбербанк' | 'ВТБ' | 'Альфа-Банк'
  status: 'active' | 'suspended';
  phone?: string;
  createdAt: string;
}

export interface SpecialApprovalRequest {
  id: string;
  lotId: string;
  lotCode: string;
  complexName: string;
  developer: string;
  contractPriceRub: number;
  requestedByEmployeeId: string;
  requestedByEmployeeName: string;
  bankName: string;
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  decisionNotes?: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface BuyerCreditLimitRequest {
  id: string;
  userId: string;
  clientCode: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  requestedAmountRub: number;
  approvedLimitRub?: number;
  validUntil?: string; // YYYY-MM-DD
  bankName: string;
  status: 'pending' | 'approved' | 'rejected';
  certificateNumber?: string;
  reviewedBy?: string;
  requestedAt: string;
  reviewedAt?: string;
  notes?: string;
}

// Operations & Decisions Audit Log (Task 7 & 12)
export interface AuditLogEntry {
  id: string;
  timestamp: string; // Full ISO timestamp
  lotCode?: string;
  dealId?: string;
  operatorId: string;
  operatorName: string;
  operatorRole: 'curator' | 'bank_officer' | 'owner' | 'system';
  actionType: 
    | 'legal_approved' 
    | 'legal_rejected' 
    | 'doc_requested' 
    | 'doc_uploaded'
    | 'packaging_published' 
    | 'buyer_matched' 
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
    | 'credit_limit_granted'
    | 'market_settings_updated'
    | 'employee_created_modified';
  title: string;
  description: string;
  attachments?: Array<{ name: string; url: string }>;
  metadata?: Record<string, any>;
}

