/**
 * Canonical Collection Name Resolver
 * Standardized single-environment routing. All repositories interact directly
 * with clean canonical database tables ('lots', 'deals', 'users', etc.).
 */
export const ISOLATED_COLLECTIONS: readonly string[] = [];

/**
 * Resolves collection name to canonical production name.
 * Strips any legacy 'demo_' prefix if present.
 */
export function resolveCollectionName(baseCollection: string): string {
  return baseCollection.replace(/^demo_/, '');
}

/**
 * Checks if a given collection name is an isolated data collection (always false in unified architecture).
 */
export function isIsolatedCollection(_collectionName: string): boolean {
  return false;
}
