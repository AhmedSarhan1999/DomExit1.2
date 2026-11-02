const fs = require('fs');

// 1. Update FirebaseAdapter.ts
{
  const p = 'd:/DomExit1.2/src/dal/adapters/FirebaseAdapter.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  const oldMethod = `  async getAllEntities<T extends { id: string }>(
    collectionName: string,
    seedFallback: T[] = []
  ): Promise<T[]> {
    const storageKey = \`domexit_fb_\${collectionName}\`;
    const localCached = this.getCache<T>(collectionName);

    // Fetch from live Firestore and merge with local/seed items so newly created or seeded entities are never lost
    try {
      if (db && (db as unknown as { app?: unknown }).app) {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          const remoteMap = new Map<string, T>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as T;
            if (data && data.id) {
              remoteMap.set(data.id, data);
            }
          });

          // Merge local cached items that may not yet have flushed or additional seed items
          for (const localItem of localCached) {
            if (!remoteMap.has(localItem.id)) {
              remoteMap.set(localItem.id, localItem);
            }
          }
          for (const seedItem of seedFallback) {
            if (!remoteMap.has(seedItem.id)) {
              remoteMap.set(seedItem.id, seedItem);
            }
          }

          const merged = Array.from(remoteMap.values());
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch {}
          return merged;
        }
      }
    } catch {
      // Graceful fallback to local cache or seed data
    }

    if (localCached.length > 0) {
      // Ensure any newly added seed lots/entities appear cleanly
      if (seedFallback.length > 0) {
        const existingIds = new Set(localCached.map((i) => i.id));
        const missingSeeds = seedFallback.filter((s) => !existingIds.has(s.id));
        if (missingSeeds.length > 0) {
          const combined = [...localCached, ...missingSeeds];
          try {
            localStorage.setItem(storageKey, JSON.stringify(combined));
          } catch {}
          return combined;
        }
      }
      return localCached;
    }

    if (seedFallback.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(seedFallback));
      } catch {}
    }
    return [...seedFallback];
  }`;

  const newMethod = `  async getAllEntities<T extends { id: string }>(
    collectionName: string,
    seedFallback: T[] = []
  ): Promise<T[]> {
    const storageKey = \`domexit_fb_\${collectionName}\`;
    const localCached = this.getCache<T>(collectionName);

    // Fetch from live Firestore
    try {
      if (db && (db as unknown as { app?: unknown }).app) {
        const colRef = collection(db, collectionName);
        const snapshot = await getDocs(colRef);

        // If Firestore collection is empty, then it is genuinely empty/purged! Return []!
        if (snapshot.empty) {
          try {
            localStorage.setItem(storageKey, JSON.stringify([]));
          } catch {}
          return [];
        }

        const remoteDocs: T[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as T;
          if (data && data.id) {
            remoteDocs.push(data);
          }
        });

        try {
          localStorage.setItem(storageKey, JSON.stringify(remoteDocs));
        } catch {}
        return remoteDocs;
      }
    } catch (fbErr) {
      // Graceful fallback to local cache ONLY if Firestore network request fails
    }

    if (localCached.length > 0) {
      return localCached;
    }

    try {
      if (localStorage.getItem(storageKey) !== null) {
        return [];
      }
    } catch {}

    // Only market_settings can use seed fallback if genuinely first offline load
    if (collectionName === 'market_settings' && seedFallback.length > 0) {
      return [...seedFallback];
    }

    return [];
  }`;

  if (c.includes(oldMethod)) {
    c = c.replace(oldMethod, newMethod);
    fs.writeFileSync(p, c, 'utf8');
    console.log('Successfully updated FirebaseAdapter.ts to enforce Anti-Seeding');
  } else {
    console.log('Could not find oldMethod in FirebaseAdapter.ts');
  }
}

// 2. Update initializer.ts
{
  const p = 'd:/DomExit1.2/src/dal/initializer.ts';
  let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  const oldInit = `    try {
      // Warm up & ensure all canonical collections are hydrated via DatabaseGateway
      await Promise.all([
        DatabaseGateway.getAll('lots', initialLots),
        DatabaseGateway.getAll('deals', initialDeals),
        DatabaseGateway.getAll('buyer_applications', initialCandidates),
        DatabaseGateway.getAll('seller_requests', initialSellerRequests),
        DatabaseGateway.getAll('partner_applications', initialPartners),
        DatabaseGateway.getAll('employees', initialEmployees),
        DatabaseGateway.getAll('market_settings', [initialMarketSettings]),
        DatabaseGateway.getAll('bank_employees', initialBankEmployees),
      ]);
    } catch (err) {
      console.warn('[DatabaseInitializer] Non-fatal migration check:', err);
    }`;

  const newInit = `    // Auto-seeding disabled per 152-FZ Anti-Seeding Directive.
    // Collections remain in zero-state until real lots/deals are approved by Owner.
    return;`;

  if (c.includes(oldInit)) {
    c = c.replace(oldInit, newInit);
    fs.writeFileSync(p, c, 'utf8');
    console.log('Successfully disabled auto-seeding in initializer.ts');
  } else {
    console.log('Could not find oldInit in initializer.ts');
  }
}
