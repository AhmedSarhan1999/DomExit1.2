import { db } from './firebase';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

export const COLLECTIONS_TO_WIPE = [
  'audit_logs',
  'deals',
  'lots',
  'seller_requests',
  'buyer_applications',
  'candidates',
  'documents_vault',
  'bank_credit_limits',
  'bank_special_approvals',
  'developer_accreditation_requests',
  'partner_preliminary_requests',
  'user_consents',
] as const;

export interface PurgeResult {
  success: boolean;
  wipedCollections: Record<string, number>;
  totalWiped: number;
  message: string;
}

export class DatabasePurgeService {
  /**
   * Complete 152-FZ Platform Database Purge & Sanitization
   * Clears all 12 mock/temporary collections, sanitizes users, staff & developers,
   * preserves immutable market settings, and clears browser caches.
   */
  static async runPlatformDatabasePurge(): Promise<PurgeResult> {
    const wipedStats: Record<string, number> = {};
    let totalWiped = 0;

    console.log('[DatabasePurgeService] Initiating comprehensive database purge...');

    // 1. Wipe all 12 collections in Firestore
    if (db && (db as unknown as { app?: unknown }).app) {
      for (const colName of COLLECTIONS_TO_WIPE) {
        try {
          const colRef = collection(db, colName);
          const snap = await getDocs(colRef);
          if (!snap.empty) {
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 400) {
              const chunk = docs.slice(i, i + 400);
              const batch = writeBatch(db);
              chunk.forEach((d) => batch.delete(d.ref));
              await batch.commit();
            }
            wipedStats[colName] = docs.length;
            totalWiped += docs.length;
          } else {
            wipedStats[colName] = 0;
          }
        } catch (e) {
          console.warn(`[DatabasePurgeService] Error wiping collection "${colName}":`, e);
          wipedStats[colName] = 0;
        }
      }

      // 2. Sanitize Users in Firestore
      try {
        const userSnap = await getDocs(collection(db, 'users'));
        for (const d of userSnap.docs) {
          const data = d.data();
          const email = (data.email || '').trim().toLowerCase();
          const name = (data.name || '').trim();

          // Delete mock ceo@domexit.ru or alexander@domexit.ru
          if (email === 'ceo@domexit.ru' || email === 'alexander@domexit.ru') {
            await deleteDoc(d.ref);
            continue;
          }

          // Delete duplicate Viktor Sergeyevich
          if (
            email === 'amaas9499@gmail.com' &&
            (name.includes('Виктор') || (data.clientCode === 'DEX-000001' && d.id !== 'usr-owner-001'))
          ) {
            await deleteDoc(d.ref);
            continue;
          }

          // Delete any unlinked user records
          if (
            email !== 'amaas9499@gmail.com' &&
            email !== 'amaas9494@gmail.com' &&
            email !== 'bank@domexit.ru'
          ) {
            await deleteDoc(d.ref);
            continue;
          }
        }

        // Canonical Owner
        await setDoc(
          doc(db, 'users', 'usr-owner-001'),
          {
            id: 'usr-owner-001',
            clientCode: 'DEX-104662',
            name: 'Ahmed Abdallah',
            email: 'amaas9499@gmail.com',
            role: 'owner',
            currentRole: 'owner',
            activeRole: 'owner',
            roles: ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'],
            phone: '+7 (812) 900-00-01',
            telegram: '@domexit_owner',
            isInvestorApproved: true,
            isPartnerApproved: true,
            registeredAt: '2025-01-01T00:00:00Z',
            partnerRefCode: 'PARTNER-MASTER-OWNER',
            favorites: [],
          },
          { merge: true }
        );

        // Canonical Employee
        await setDoc(
          doc(db, 'users', 'usr-staff-002'),
          {
            id: 'usr-staff-002',
            clientCode: 'DEX-000002',
            name: 'Алексей Смирнов',
            email: 'amaas9494@gmail.com',
            role: 'employee',
            currentRole: 'employee',
            activeRole: 'employee',
            roles: ['employee'],
            phone: '+7 (921) 888-11-22',
            telegram: '@domexit_smirnov',
            assignedEmployeeId: 'emp-1',
            isInvestorApproved: false,
            isPartnerApproved: false,
            registeredAt: '2025-02-01T00:00:00Z',
            favorites: [],
          },
          { merge: true }
        );

        // Canonical Bank Officer
        await setDoc(
          doc(db, 'users', 'nuKBWAun7CSvqSKuh8suTZyofJq1'),
          {
            id: 'nuKBWAun7CSvqSKuh8suTZyofJq1',
            clientCode: 'DEX-000004',
            name: 'Игорь Владимирович Соколов (Сбербанк)',
            email: 'bank@domexit.ru',
            role: 'bank',
            currentRole: 'bank',
            activeRole: 'bank',
            roles: ['bank'],
            phone: '+7 (812) 500-11-00',
            telegram: '@bank_sber_escrow',
            isInvestorApproved: false,
            isPartnerApproved: false,
            registeredAt: '2025-02-15T00:00:00Z',
            partnerRefCode: 'PARTNER-777',
            favorites: [],
          },
          { merge: true }
        );
      } catch (userErr) {
        console.warn('[DatabasePurgeService] User sanitization warning:', userErr);
      }

      // 3. Sanitize Developers
      try {
        const devSnap = await getDocs(collection(db, 'developers'));
        for (const d of devSnap.docs) {
          await deleteDoc(d.ref);
        }

        const accreditedDevelopers = [
          {
            id: 'dev-pik',
            name: 'ПИК',
            legalName: 'ПАО «ПИК СЗ»',
            inn: '7701360732',
            rating: 'A++',
            reliabilityScore: 98,
            city: 'msk',
            headquarters: 'Москва',
            foundedYear: 1994,
            escrowBank: 'Сбербанк',
            status: 'active',
            isFederalAccredited: true,
            description: 'Крупнейший девелопер России. 100% проектов аккредитованы в банках по эскроу-счетам 214-ФЗ.',
            logoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=160&q=80',
          },
          {
            id: 'dev-setl',
            name: 'Setl Group',
            legalName: 'ООО «Сэтл Групп»',
            inn: '7810245481',
            rating: 'A++',
            reliabilityScore: 99,
            city: 'spb',
            headquarters: 'Санкт-Петербург',
            foundedYear: 1994,
            escrowBank: 'Сбербанк',
            status: 'active',
            isFederalAccredited: true,
            description: 'Лидер девелоперского рынка Санкт-Петербурга и Северо-Западного региона с безупречной историей сдачи.',
            logoUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=160&q=80',
          },
          {
            id: 'dev-lsr',
            name: 'ЛСР',
            legalName: 'ПАО «Группа ЛСР»',
            inn: '7838360491',
            rating: 'A++',
            reliabilityScore: 97,
            city: 'spb',
            headquarters: 'Санкт-Петербург',
            foundedYear: 1993,
            escrowBank: 'ВТБ',
            status: 'active',
            isFederalAccredited: true,
            description: 'Один из старейших девелоперов РФ, системообразующее строительное предприятие федерального значения.',
            logoUrl: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=160&q=80',
          },
          {
            id: 'dev-etalon',
            name: 'Эталон',
            legalName: 'ПАО «Группа Эталон»',
            inn: '7814116230',
            rating: 'A+',
            reliabilityScore: 95,
            city: 'spb',
            headquarters: 'Санкт-Петербург / Москва',
            foundedYear: 1987,
            escrowBank: 'Сбербанк',
            status: 'active',
            isFederalAccredited: true,
            description: 'Федеральная девелоперская группа с проектами бизнес- и комфорт-класса в СПб и Москве.',
            logoUrl: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&w=160&q=80',
          },
          {
            id: 'dev-fsk',
            name: 'ФСК',
            legalName: 'Группа компаний «ФСК»',
            inn: '7705704608',
            rating: 'A+',
            reliabilityScore: 94,
            city: 'msk',
            headquarters: 'Москва',
            foundedYear: 2005,
            escrowBank: 'ВТБ',
            status: 'active',
            isFederalAccredited: true,
            description: 'Крупный многопрофильный девелопер с портфелем объектов в Москве, МО, СПб и Калужской области.',
            logoUrl: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=160&q=80',
          },
          {
            id: 'dev-samolet',
            name: 'Самолёт',
            legalName: 'ПАО «ГК Самолёт»',
            inn: '7731476100',
            rating: 'A+',
            reliabilityScore: 96,
            city: 'msk',
            headquarters: 'Москва',
            foundedYear: 2012,
            escrowBank: 'Сбербанк',
            status: 'active',
            isFederalAccredited: true,
            description: 'Быстрорастущая PropTech-корпорация федерального масштаба с масштабным земельным банком.',
            logoUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=160&q=80',
          },
        ];

        for (const dev of accreditedDevelopers) {
          await setDoc(doc(db, 'developers', dev.id), dev);
        }
      } catch (devErr) {
        console.warn('[DatabasePurgeService] Developers sanitization warning:', devErr);
      }

      // 4. Sanitize Staff
      try {
        const empSnap = await getDocs(collection(db, 'employees'));
        for (const d of empSnap.docs) {
          if (d.id !== 'emp-1') {
            await deleteDoc(d.ref);
          }
        }
        await setDoc(doc(db, 'employees', 'emp-1'), {
          id: 'emp-1',
          name: 'Алексей Смирнов',
          email: 'amaas9494@gmail.com',
          role: 'Ведущий куратор отдела выходов',
          phone: '+7 (812) 409-32-11',
          telegram: '@domexit_smirnov',
          whatsapp: '+7 (812) 409-32-11',
          bio: '12 лет в сфере уступки прав по 214-ФЗ и аккредитивов. Экс-руководитель юридического блока строительного холдинга.',
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          activeLotsCount: 0,
          closedDealsCount: 0,
          avgSpeedDays: 8.0,
          status: 'active',
          allowedSidebarTabs: ['pipeline', 'packaging', 'legal_audit', 'matchmaker', 'profile'],
          permissions: ['legal_audit', 'packaging', 'matchmaker', 'closing'],
        });

        const bankEmpSnap = await getDocs(collection(db, 'bank_employees'));
        for (const d of bankEmpSnap.docs) {
          if (d.id !== 'bank-emp-1') {
            await deleteDoc(d.ref);
          }
        }
        await setDoc(doc(db, 'bank_employees', 'bank-emp-1'), {
          id: 'bank-emp-1',
          name: 'Игорь Владимирович Соколов',
          email: 'bank@domexit.ru',
          phone: '+7 (812) 500-11-00',
          role: 'Кредитный офицер / Руководитель эскроу-направления',
          bankName: 'Сбербанк',
          status: 'active',
          createdAt: '2025-01-01T00:00:00Z',
        });
      } catch (staffErr) {
        console.warn('[DatabasePurgeService] Staff sanitization warning:', staffErr);
      }
    }

    // 5. Clean Browser LocalStorage Caches for wiped collections
    if (typeof window !== 'undefined') {
      try {
        COLLECTIONS_TO_WIPE.forEach((colName) => {
          localStorage.setItem(`domexit_fb_${colName}`, JSON.stringify([]));
          localStorage.setItem(`domexit_db_${colName}`, JSON.stringify([]));
        });
        localStorage.removeItem('domexit_demo_seeded');
        window.dispatchEvent(new CustomEvent('domexit:dal_updated', { detail: { purged: true } }));
      } catch (e) {
        console.warn('[DatabasePurgeService] LocalStorage clean error:', e);
      }
    }

    return {
      success: true,
      wipedCollections: wipedStats,
      totalWiped,
      message: `База данных успешно очищена! Удалено ${totalWiped} записей из 12 тестовых коллекций. Сохранены только аккредитованные застройщики РФ и утвержденные пользователи.`,
    };
  }
}
