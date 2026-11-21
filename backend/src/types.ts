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
  assignedEmployeeId?: string;
  isPartnerApproved?: boolean;
  isInvestorApproved?: boolean;
  partnerRefCode?: string;
  favorites?: string[];
  registeredAt?: string;
  authProvider?: string;
  passwordHash?: string;
  yandexId?: string;
}

export interface AuthSessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  activeRole: UserRole;
  roles: UserRole[];
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
  completedViewingsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type QueueStatus =
  | 'pending_review'
  | 'priority_1'
  | 'reserve_2'
  | 'reserve_3'
  | 'waitlist'
  | 'deposit_paid'
  | 'expired'
  | 'withdrawn'
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
