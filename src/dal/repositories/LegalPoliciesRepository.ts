import { LegalPolicyType, LegalPolicyVersion, ProofOfConsentRecord } from '../../types';
import { computeSha256 } from '../../utils/crypto';

export const CANONICAL_POLICY_NAMES: Record<LegalPolicyType, string> = {
  privacy: 'Политика в отношении обработки персональных данных (152-ФЗ)',
  user_agreement: 'Пользовательское соглашение и регламент платформы',
  cookies: 'Политика использования файлов cookie',
  advertising_consent: 'Согласие на получение информационных и рекламных сообщений (38-ФЗ)',
  public_distribution_consent:
    'Согласие на обработку персональных данных, разрешенных субъектом для распространения (ст. 10.1 152-ФЗ)',
};

export const INITIAL_POLICY_TEXTS: Record<LegalPolicyType, string> = {
  privacy: `ПОЛИТИКА В ОТНОШЕНИИ ОБРАБОТКИ ПЕРСОНАЛЬНЫХ ДАННЫХ
(в редакции от 01.03.2026, Федеральный закон РФ № 152-ФЗ)

1. ОБЩИЕ ПОЛОЖЕНИЯ
1.1. Настоящая Политика определяет порядок сбора, записи, систематизации, накопления, хранения, уточнения, извлечения, использования, передачи, обезличивания, блокирования, удаления и уничтожения персональных данных оператором ООО «ДОМЭКЗИТ ТЕХНОЛОДЖИ» (ОГРН 1247800045120, ИНН 7801723450).
1.2. Базы данных информации, содержащей персональные данные граждан Российской Федерации, размещены исключительно на территории РФ в защищенном контуре Yandex Cloud (ЦОД Владимир / Сасово / Мытищи), аттестованном по требованиям УЗ-1 (Приказ ФСТЭК № 21).
1.3. Обработка биометрических данных и трансграничная передача персональных данных оператором категорически НЕ осуществляются.

2. КАТЕГОРИИ И ЦЕЛИ ОБРАБОТКИ
2.1. Данные обрабатываются в целях:
- предварительной экспресс-оценки прав требований по договорам участия в долевом строительстве (214-ФЗ);
- организации безопасных расчетов через аккредитивы уполномоченных банков;
- исполнения соглашений об уступке прав и переводе долга;
- соблюдения требований противодействия легализации доходов (115-ФЗ).
2.2. Состав данных: ФИО, номер мобильного телефона, адрес электронной почты, сведения о номере и дате ДДУ/кредитного договора, реквизиты эскроу-счета.

3. ПРАВА СУБЪЕКТА ПЕРСОНАЛЬНЫХ ДАННЫХ
3.1. Субъект вправе в любой момент отозвать согласие путем направления письменного заявления оператору или через личный кабинет клиента. Уничтожение данных производится в течение 30 календарных дней с составлением электронного акта по Приказу Роскомнадзора № 179.`,

  user_agreement: `ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ И РЕГЛАМЕНТ ПЛАТФОРМЫ «DOMEXIT»
(в редакции от 01.03.2026)

1. СТАТУС ПЛАТФОРМЫ
1.1. Платформа «DomExit — Чистый Выход» представляет собой программно-аппаратный комплекс для структурирования сделок по уступке прав требований по договорам участия в долевом строительстве (214-ФЗ) и залоговой недвижимости (140-ФЗ).
1.2. DomExit не является банком, кредитной организацией или стороной в кредитном договоре. Все финансовые расчеты и депонирование средств осуществляются через лицензированные банки-партнеры (ПАО Сбербанк, Банк ВТБ, АО «Банк ДОМ.РФ», АО «АЛЬФА-БАНК»).

2. ПОРЯДОК РАЗМЕЩЕНИЯ ЛОТОВ И ЭКСПРЕСС-ВЫКУПА
2.1. Пользователь гарантирует достоверность предоставляемых сведений об обременениях, остатке долга по рассрочке/ипотеке и наличии несовершеннолетних сособственников.
2.2. Запрещается сокрытие факта направления средств материнского капитала без соблюдения регламента его возврата в Социальный фонд РФ.

3. ОТВЕТСТВЕННОСТЬ СТОРОН
3.1. Платформа проводит комплексную юридическую экспертизу титула (Legal Due Diligence) каждого лота перед допуском к закрытому инвестиционному витрине.`,

  cookies: `ПОЛИТИКА ИСПОЛЬЗОВАНИЯ ФАЙЛОВ COOKIE И ВЕБ-АНАЛИТИКИ
(в редакции от 01.03.2026)

1. НАЗНАЧЕНИЕ ФАЙЛОВ COOKIE
1.1. Сайт использует необходимые (essential) технические файлы cookie для поддержания защищенной пользовательской сессии, работы механизмов двухфакторной аутентификации и фиксации согласий.
1.2. Аналитические файлы cookie собираются исключительно через локализованные российские счетчики веб-аналитики (Яндекс.Метрика) без передачи идентификаторов за пределы РФ.

2. УПРАВЛЕНИЕ НАСТРОЙКАМИ
2.1. Пользователь может в любой момент изменить настройки файлов cookie в плавающем баннере или в футере сайта. Отключение обязательных cookie может повлечь некорректную работу личного кабинета.`,

  advertising_consent: `СОГЛАСИЕ НА ПОЛУЧЕНИЕ ИНФОРМАЦИОННЫХ И РЕКЛАМНЫХ СООБЩЕНИЙ
(в соответствии со статьей 18 Федерального закона «О рекламе» № 38-ФЗ)

1. Я даю свое добровольное, информированное и отдельное согласие оператору ООО «ДОМЭКЗИТ ТЕХНОЛОДЖИ» на получение сообщений рекламного и информационного характера.
2. Каналы связи: SMS-сообщения, звонки голосового робота/оператора, сообщения в мессенджере Telegram, письма по электронной почте.
3. Содержание рассылок: персональные предложения по выкупу лотов, уведомления о снижении ставок по семейной ипотеке, аналитические дайджесты рынка первичной недвижимости.
4. Срок действия согласия: до момента его отзыва. Отзыв осуществляется в 1 клик по ссылке в любом сообщении либо отправкой запроса на help@domexit.ru.`,

  public_distribution_consent: `СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ, РАЗРЕШЕННЫХ СУБЪЕКТОМ ДЛЯ РАСПРОСТРАНЕНИЯ
(в соответствии со статьей 10.1 Федерального закона № 152-ФЗ)

1. Настоящее согласие оформляется отдельно от иных согласий на обработку персональных данных.
2. Категории данных, разрешенных для публикации в закрытой витрине лотов:
- Имя и отчество продавца (без раскрытия фамилии публично);
- Город и наименование жилого комплекса;
- Номер корпуса, этаж и секция объекта (без указания точного номера квартиры до этапа бронирования);
- Финансовые условия уступки (сумма остатка рассрочки, размер скидки).
3. Субъект вправе установить запреты на передачу (кроме предоставления доступа) указанных персональных данных неограниченному кругу лиц.`,
};

const VERSIONS_STORAGE_KEY = 'domexit_legal_policy_versions_v1';
const CONSENTS_STORAGE_KEY = 'domexit_user_consent_proofs_v1';

export class LegalPoliciesRepository {
  private static async getStoredVersions(): Promise<LegalPolicyVersion[]> {
    try {
      const raw = localStorage.getItem(VERSIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse legal versions, building initial defaults', e);
    }

    // Build initial baseline versions with true SHA-256 hashes
    const initialVersions: LegalPolicyVersion[] = [];
    const policyTypes: LegalPolicyType[] = [
      'privacy',
      'user_agreement',
      'cookies',
      'advertising_consent',
      'public_distribution_consent',
    ];

    for (const pType of policyTypes) {
      const text = INITIAL_POLICY_TEXTS[pType];
      const hash = await computeSha256(text);
      initialVersions.push({
        id: `pol-${pType}-v2.1`,
        policyType: pType,
        policyNameRu: CANONICAL_POLICY_NAMES[pType],
        versionNumber: '2.1',
        effectiveDate: '2026-03-01',
        changeType: 'material',
        changeSummary:
          pType === 'public_distribution_consent'
            ? 'Первичная публикация отдельного согласия по ст. 10.1 152-ФЗ'
            : pType === 'advertising_consent'
            ? 'Разделение рекламного согласия по ст. 18 38-ФЗ'
            : 'Актуализация требований Роскомнадзора 2026 г., локализация в Yandex Cloud',
        fullText: text,
        sha256Hash: hash,
        isCurrent: true,
        createdAt: '2026-03-01T00:00:00Z',
        createdBy: 'Служба комплаенса DomExit',
      });
    }

    try {
      localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(initialVersions));
    } catch {
      // ignore
    }

    return initialVersions;
  }

  static async getAllVersions(): Promise<LegalPolicyVersion[]> {
    return this.getStoredVersions();
  }

  static async getCurrentVersions(): Promise<Record<LegalPolicyType, LegalPolicyVersion>> {
    const all = await this.getStoredVersions();
    const result = {} as Record<LegalPolicyType, LegalPolicyVersion>;
    const types: LegalPolicyType[] = [
      'privacy',
      'user_agreement',
      'cookies',
      'advertising_consent',
      'public_distribution_consent',
    ];

    for (const t of types) {
      const found = all.filter((v) => v.policyType === t && v.isCurrent);
      if (found.length > 0) {
        // take latest by effectiveDate or creation
        result[t] = found[found.length - 1];
      }
    }
    return result;
  }

  static async getVersionHistory(policyType: LegalPolicyType): Promise<LegalPolicyVersion[]> {
    const all = await this.getStoredVersions();
    return all
      .filter((v) => v.policyType === policyType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async publishNewVersion(params: {
    policyType: LegalPolicyType;
    versionNumber: string;
    changeType: 'minor' | 'material';
    changeSummary: string;
    fullText: string;
    createdBy: string;
  }): Promise<LegalPolicyVersion> {
    const all = await this.getStoredVersions();
    const sha256 = await computeSha256(params.fullText);

    // Mark previous current versions of this policy as false
    const updated = all.map((v) => {
      if (v.policyType === params.policyType) {
        return { ...v, isCurrent: false };
      }
      return v;
    });

    const newVersion: LegalPolicyVersion = {
      id: `pol-${params.policyType}-v${params.versionNumber.replace(/\./g, '_')}-${Date.now()}`,
      policyType: params.policyType,
      policyNameRu: CANONICAL_POLICY_NAMES[params.policyType],
      versionNumber: params.versionNumber,
      effectiveDate: new Date().toISOString().split('T')[0],
      changeType: params.changeType,
      changeSummary: params.changeSummary,
      fullText: params.fullText,
      sha256Hash: sha256,
      isCurrent: true,
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy || 'Служба комплаенса DomExit',
    };

    updated.push(newVersion);
    localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(updated));
    return newVersion;
  }

  // --- Proof of Consent Audit Trail ---

  private static getStoredConsents(): ProofOfConsentRecord[] {
    try {
      const raw = localStorage.getItem(CONSENTS_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to parse consents from storage', e);
    }
    return [];
  }

  static async recordProofOfConsent(params: {
    userId: string;
    clientCode?: string;
    userFullName?: string;
    policyType: LegalPolicyType;
    policyVersion: string;
    policySha256: string;
    consentMethod: 'web_form' | 'reconsent_modal' | 'portal_action';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ProofOfConsentRecord> {
    const list = this.getStoredConsents();
    const record: ProofOfConsentRecord = {
      id: `proof-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: params.userId,
      clientCode: params.clientCode,
      userFullName: params.userFullName,
      policyType: params.policyType,
      policyVersion: params.policyVersion,
      policySha256: params.policySha256,
      consentedAt: new Date().toISOString(),
      ipAddress: params.ipAddress || '127.0.0.1 (Yandex Cloud DC)',
      userAgent: params.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Browser'),
      consentMethod: params.consentMethod,
    };
    list.push(record);
    localStorage.setItem(CONSENTS_STORAGE_KEY, JSON.stringify(list));
    return record;
  }

  static async getUserConsents(userId: string): Promise<ProofOfConsentRecord[]> {
    const list = this.getStoredConsents();
    return list.filter((c) => c.userId === userId || c.clientCode === userId);
  }

  /**
   * Checks if an authenticated user needs to accept updated material policies.
   * Returns list of material versions not consented to by this user.
   */
  static async checkUserUnconsentedMaterialPolicies(userId: string): Promise<LegalPolicyVersion[]> {
    if (!userId) return [];
    const current = await this.getCurrentVersions();
    const userConsents = await this.getUserConsents(userId);

    const unconsented: LegalPolicyVersion[] = [];

    const types: LegalPolicyType[] = [
      'privacy',
      'user_agreement',
      'cookies',
      'advertising_consent',
      'public_distribution_consent',
    ];

    for (const t of types) {
      const currentVer = current[t];
      if (currentVer && currentVer.changeType === 'material') {
        // Has user consented to this exact version or hash?
        const hasConsented = userConsents.some(
          (c) =>
            c.policyType === t &&
            c.policyVersion === currentVer.versionNumber &&
            !c.isWithdrawn
        );
        if (!hasConsented) {
          unconsented.push(currentVer);
        }
      }
    }

    return unconsented;
  }
}
