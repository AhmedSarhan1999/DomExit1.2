import { TierVerificationRequest, TierVerificationProofType } from '../../types';
import { apiClient, PaginatedResult } from '../../services/apiClient';

export class TierVerificationRepository {
  /**
   * Fetches the current user's tier verification requests.
   */
  static async getMyRequests(): Promise<{
    requests: TierVerificationRequest[];
    currentRequest: TierVerificationRequest | null;
  }> {
    const res = await apiClient.tierVerification.getMyRequests();
    return {
      requests: res.requests || [],
      currentRequest: res.currentRequest || null,
    };
  }

  /**
   * Submits a new Gold verification request.
   */
  static async submitRequest(data: {
    proofType: TierVerificationProofType;
    declaredBudgetRub: number;
    documentKey: string;
    documentName: string;
    documentMime?: string;
    documentSize?: number;
    comment?: string;
  }): Promise<TierVerificationRequest> {
    const res = await apiClient.tierVerification.submitRequest(data);
    return res.request;
  }

  /**
   * Fetches paginated verification requests for admin review.
   */
  static async getRequests(params?: {
    status?: 'pending' | 'archive';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<TierVerificationRequest>> {
    return await apiClient.tierVerification.getRequests(params);
  }

  /**
   * Generates a 5-minute presigned download/view URL for the document.
   */
  static async getDocumentUrl(id: string): Promise<string> {
    const res = await apiClient.tierVerification.getDocumentUrl(id);
    return res.downloadUrl;
  }

  /**
   * Admin approves or rejects the verification request.
   */
  static async makeDecision(
    id: string,
    decision: 'approved' | 'rejected',
    reviewNote?: string
  ): Promise<TierVerificationRequest> {
    const res = await apiClient.tierVerification.makeDecision(id, { decision, reviewNote });
    return res.request;
  }
}
