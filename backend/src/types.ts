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
