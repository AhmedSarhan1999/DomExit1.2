import { db } from './firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { initialLots, initialDeals, initialCandidates, initialPartners, initialEmployees } from './seedData';
import { Lot, DealTrack, BuyerCandidate, PartnerEntry, Employee } from '../types';

/**
 * Live Database Auto-Seeder & Migration Controller
 * Synchronizes platform state with Firestore on first run.
 * Provides 1-click clean production switch (clearDemoData).
 */
export class DatabaseInitializer {
  private static isInitialized = false;

  static async initLiveDatabase(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 1. Synchronize Local Storage with seed defaults if empty
      const lotCacheKey = 'domexit_fb_lots';
      if (!localStorage.getItem(lotCacheKey)) {
        localStorage.setItem(lotCacheKey, JSON.stringify(initialLots));
      }
      const dealsCacheKey = 'domexit_fb_deals';
      if (!localStorage.getItem(dealsCacheKey)) {
        localStorage.setItem(dealsCacheKey, JSON.stringify(initialDeals));
      }
      const candCacheKey = 'domexit_fb_candidates';
      if (!localStorage.getItem(candCacheKey)) {
        localStorage.setItem(candCacheKey, JSON.stringify(initialCandidates));
      }
      const partCacheKey = 'domexit_fb_partners';
      if (!localStorage.getItem(partCacheKey)) {
        localStorage.setItem(partCacheKey, JSON.stringify(initialPartners));
      }
      const empCacheKey = 'domexit_fb_employees';
      if (!localStorage.getItem(empCacheKey)) {
        localStorage.setItem(empCacheKey, JSON.stringify(initialEmployees));
      }

      // 2. Synchronize with live Firestore if available
      if (db && typeof db.type === 'string') {
        const lotsCol = collection(db, 'lots');
        const lotSnap = await getDocs(lotsCol);

        if (lotSnap.empty) {
          console.info('[Live Firebase] Seeding initial 12 lots and deals to Firestore...');
          const batch = writeBatch(db);

          // Seed lots
          for (const lot of initialLots) {
            const lotRef = doc(db, 'lots', lot.id);
            batch.set(lotRef, lot);
          }

          // Seed deals
          for (const deal of initialDeals) {
            const dealRef = doc(db, 'deals', deal.id);
            batch.set(dealRef, deal);
          }

          // Seed candidates
          for (const cand of initialCandidates) {
            const candRef = doc(db, 'candidates', cand.id);
            batch.set(candRef, cand);
          }

          // Seed partners
          for (const partner of initialPartners) {
            const partRef = doc(db, 'partners', partner.id);
            batch.set(partRef, partner);
          }

          // Seed employees
          for (const emp of initialEmployees) {
            const empRef = doc(db, 'employees', emp.id);
            batch.set(empRef, emp);
          }

          await batch.commit();
          console.info('[Live Firebase] Initial seed successfully committed to Firestore.');
        }
      }
    } catch (err) {
      console.warn('[DatabaseInitializer] Non-fatal migration check:', err);
    }
  }

  /**
   * 1-Click Function to Reset or Clear Demo Data for Production Readiness
   */
  static clearDemoData(): void {
    const keys = [
      'domexit_fb_lots',
      'domexit_fb_deals',
      'domexit_fb_candidates',
      'domexit_fb_partners',
      'domexit_fb_investors',
    ];
    keys.forEach(k => localStorage.removeItem(k));
    console.info('[DatabaseInitializer] Demo data cleared from local cache.');
  }

  static resetToDemoData(): void {
    localStorage.setItem('domexit_fb_lots', JSON.stringify(initialLots));
    localStorage.setItem('domexit_fb_deals', JSON.stringify(initialDeals));
    localStorage.setItem('domexit_fb_candidates', JSON.stringify(initialCandidates));
    localStorage.setItem('domexit_fb_partners', JSON.stringify(initialPartners));
    localStorage.setItem('domexit_fb_employees', JSON.stringify(initialEmployees));
    window.location.reload();
  }
}
