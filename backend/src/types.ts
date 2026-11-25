export interface YcHttpEvent {
  httpMethod: string;
  headers?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  queryStringParameters?: Record<string, string>;
  multiValueQueryStringParameters?: Record<string, string[]>;
  requestContext?: {
    requestId?: string;
    identity?: {
      sourceIp?: string;
      userAgent?: string;
    };
    httpMethod?: string;
  };
  body?: string | null;
  isBase64Encoded?: boolean;
  path?: string;
  params?: Record<string, string>;
  url?: string;
}

export interface YcHttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body: string;
  isBase64Encoded?: boolean;
}

export type UserRole =
  | 'owner'
  | 'admin'
  | 'employee'
  | 'bank'
  | 'buyer'
  | 'seller'
  | 'partner'
  | 'investor';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  activeRole: UserRole;
  roles: UserRole[];
  phone?: string;
  inn?: string;
  clientCode?: string;
  photoURL?: string;
  telegram?: string;
  telegramUsername?: string;
  telegramChatId?: string;
  telegramBotUsername?: string;
  assignedEmployeeId?: string;
  isPartnerApproved?: boolean;
  isInvestorApproved?: boolean;
  partnerRefCode?: string;
  partnerId?: string;
  referralCode?: string;
  favorites?: string[];
  registeredAt?: string;
  updatedAt?: string;
  authProvider?: string;
  passwordHash?: string;
  yandexId?: string;
  authProviders?: Array<'password' | 'yandex' | 'phone'>;
  hasPassword?: boolean;
  passwordSetupDismissedAt?: string;
  phoneNormalized?: string;
  phoneVerified?: boolean;
  tokenVersion?: number;
}

export interface AuthSessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  activeRole: UserRole;
  roles: UserRole[];
  tv?: number;
  iat?: number;
  exp?: number;
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

export interface BuyerApplication {
  id: string;
  lotCode: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
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
  withdrawalReason?: string;
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
  portalUrl?: string;
  evaluated?: boolean;
  checkedAt?: string;
  checkedBy?: string;
  proofDocName?: string;
  proofDocKey?: string;
  proofDocUrl?: string;
}

export interface LegalRadarCheckItem {
  registry: string;
  registryId?: string;
  status: 'clear' | 'warning' | 'risk' | 'clean' | 'attention' | 'critical' | 'unchecked';
  checkedAt: string;
  checkedBy: string;
  note?: string;
}

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

