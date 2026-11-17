/**
 * Security Activity Logger & SIEM Sentinel (Item 22: Security Logging & Incident Monitoring)
 * Tracks suspicious security events (brute force, malicious file attempts, IDOR violations)
 * in compliance with 152-FZ incident monitoring requirements.
 */

export type SecurityEventType =
  | 'RATE_LIMIT_EXCEEDED'
  | 'MALICIOUS_FILE_BLOCKED'
  | 'UNAUTHORIZED_ADMIN_ATTEMPT'
  | 'IDOR_ACCESS_DENIED'
  | 'OPEN_REDIRECT_BLOCKED'
  | 'PRICE_TAMPERING_DETECTED'
  | 'SUSPICIOUS_PAYLOAD_BLOCKED';

export interface SecurityIncident {
  id: string;
  type: SecurityEventType;
  details: string;
  ipMasked?: string;
  userClientCode?: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class SecurityActivityLogger {
  private static readonly MAX_INCIDENTS = 100;
  private incidents: SecurityIncident[] = [];

  log(
    type: SecurityEventType,
    details: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userClientCode?: string
  ): void {
    const incident: SecurityIncident = {
      id: `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      details,
      userClientCode,
      timestamp: new Date().toISOString(),
      severity,
    };

    this.incidents.unshift(incident);
    if (this.incidents.length > SecurityActivityLogger.MAX_INCIDENTS) {
      this.incidents.pop();
    }

    if (import.meta.env.DEV) {
      console.warn(`[SecurityLogger 🛡️ ${severity.toUpperCase()}] ${type}: ${details}`);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('domexit:security_incident', {
          detail: incident,
        })
      );
    }
  }

  getIncidents(): SecurityIncident[] {
    return [...this.incidents];
  }

  getHighSeverityIncidents(): SecurityIncident[] {
    return this.incidents.filter((i) => i.severity === 'high' || i.severity === 'critical');
  }
}

export const securityLogger = new SecurityActivityLogger();
