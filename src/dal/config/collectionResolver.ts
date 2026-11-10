import { useEnvironmentStore } from '../../stores/useEnvironmentStore';

/**
 * Isolated collections subject to dynamic dual-environment routing (Sandbox vs Production).
 * In Sandbox ('demo') mode, these collections are prepended with `demo_` (e.g. `demo_lots`).
 * In Production ('production') mode, they use the clean canonical names (e.g. `lots`).
 */
export const ISOLATED_COLLECTIONS: readonly string[] = [
  'lots',
  'deals',
  'seller_requests',
  'buyer_applications',
  'candidates',
  'documents_vault',
  'audit_logs',
  'partner_preliminary_requests',
  'escrow_bridge_chats',
  'bank_special_approvals',
];

/**
 * Resolves collection name dynamically based on the active environment.
 * Shared infrastructure collections (market_settings, developers, etc.) are strictly preserved.
 */
export function resolveCollectionName(baseCollection: string): string {
  // If collection is already prefixed with demo_, return as is
  if (baseCollection.startsWith('demo_')) {
    return baseCollection;
  }

  const currentEnv = useEnvironmentStore.getState().currentEnv;

  // Apply sandbox prefix if collection is isolated and current environment is demo
  if (ISOLATED_COLLECTIONS.includes(baseCollection)) {
    return currentEnv === 'production' ? baseCollection : `demo_${baseCollection}`;
  }

  // Shared infrastructure collections (market_settings, developers) remain unchanged
  return baseCollection;
}

/**
 * Checks if a given collection name is an isolated data collection.
 */
export function isIsolatedCollection(collectionName: string): boolean {
  const base = collectionName.replace(/^demo_/, '');
  return ISOLATED_COLLECTIONS.includes(base);
}
