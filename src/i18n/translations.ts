export interface TranslationDict {
  brandName: string;
  brandTagline: string;
  nav: {
    sellers: string;
    catalog: string;
    howItWorks: string;
    story: string;
    investors: string;
    partners: string;
    tracker: string;
    admin: string;
    wantBuy: string;
    wantSell: string;
  };
  footer: {
    legalDescription: string;
    tgChannel: string;
    navTitle: string;
    urgentBuyout: string;
    verifiedCatalog: string;
    safeDealProtocol: string;
    investPools: string;
    officesTitle: string;
    mskOffice: string;
    spbOffice: string;
    supportTitle: string;
    hotline: string;
    email: string;
    rosreestrBadge: string;
    disclaimer: string;
    rightsReserved: string;
  };
  hero: {
    badgeLocations: string;
    badgePlatform: string;
    headline: string;
    subheadline: string;
    ctaSell: string;
    ctaCompare: string;
    cardDevTitle: string;
    cardDevBadge: string;
    cardDevPenaltyLabel: string;
    cardDevPenaltyValue: string;
    cardDevPayoutLabel: string;
    cardDevPayoutValue: string;
    cardDevWaitLabel: string;
    cardDevWaitValue: string;
    cardDomExitTitle: string;
    cardDomExitBadge: string;
    cardDomExitPayoutLabel: string;
    cardDomExitPayoutValue: string;
    cardDomExitFeeLabel: string;
    cardDomExitFeeValue: string;
    cardDomExitWaitLabel: string;
    cardDomExitWaitValue: string;
    cardDomExitBuyerBadge: string;
  };
  statsBar: {
    lotsCount: string;
    assetsVolume: string;
    bankAccreditation: string;
    escrowEndorsement: string;
    rosreestrEndorsement: string;
    stage1: string;
    stage2: string;
    stage3: string;
  };
  calc2Min: {
    title: string;
    subtitle: string;
    tabSeller: string;
    tabBuyer: string;
    paidAmountLabel: string;
    cashToHandLabel: string;
    penaltySavedLabel: string;
    phonePlaceholder: string;
    submitBtn: string;
  };
  common: {
    details: string;
    back: string;
    loading: string;
    noResults: string;
    resetFilters: string;
    verified42: string;
    cashToSeller: string;
    todayPrice: string;
    marketAdvantage: string;
    currency: string;
    rubleSymbol: string;
  };
}

export const translations: Record<'ru' | 'en', TranslationDict> = {
  ru: {
    brandName: 'DomExit',
    brandTagline: 'ЧИСТЫЙ ВЫХОД',
    nav: {
      sellers: 'Продавцам',
      catalog: 'Каталог ДДУ',
      howItWorks: 'Как это работает',
      story: 'О проекте',
      investors: 'Инвесторам',
      partners: 'Партнерам',
      tracker: 'Трекер сделки',
      admin: 'Панель управления',
      wantBuy: 'Хочу купить',
      wantSell: 'Хочу продать (0%)',
    },
    footer: {
      legalDescription: 'Платформа безопасной переуступки прав требований по 214-ФЗ. Институциональный стандарт защиты прав дольщиков и покупателей в Санкт-Петербурге и Москве.',
      tgChannel: 'Telegram Канал',
      navTitle: 'Навигация',
      urgentBuyout: 'Срочный выкуп и переуступка',
      verifiedCatalog: 'Каталог проверенных квартир',
      safeDealProtocol: 'Регламент безопасной сделки',
      investPools: 'Инвестиционные пулы',
      officesTitle: 'Офисы обслуживания',
      mskOffice: 'Москва: Пресненская наб., 12, ММДЦ «Москва-Сити», Башня Федерация',
      spbOffice: 'Санкт-Петербург: Малоохтинский пр., 64, лит. Б, БЦ «Санкт-Петербург Плаза»',
      supportTitle: 'Связь и поддержка',
      hotline: '+7 (800) 555-34-29',
      email: 'deal@domexit.ru',
      rosreestrBadge: 'Электронная регистрация Росреестр',
      disclaimer: 'ООО «ДомЭкзит Технологии». ОГРН 1247800049210. Сервис не является риелторским агентством. Все расчеты производятся через номинальные счета и аккредитивы аккредитованных банков РФ (ПАО Сбербанк, Банк ВТБ ПАО) с государственной регистрацией в Росреестре согласно Федеральному закону № 214-ФЗ.',
      rightsReserved: '© 2024–2026 DomExit. Все права защищены.',
    },
    hero: {
      badgeLocations: 'САНКТ-ПЕТЕРБУРГ & МОСКВА',
      badgePlatform: 'Платформа выхода из рассрочек и ДДУ без наценки',
      headline: 'Продавец возвращает 100% денег наличными, а покупатель забирает старую цену договора!',
      subheadline: 'Легальный выход из договоров долевого участия без штрафа девелопера (10%–15%). Покупатель приобретает проверенный лот по цене 2023–2024 гг. с экономией до 30% от текущего прайса застройщика.',
      ctaSell: 'Продать квартиру (0%) ->',
      ctaCompare: 'Смотреть сравнение',
      cardDevTitle: 'Если вернуть квартиру девелоперу',
      cardDevBadge: 'УБЫТОК ДО 15%',
      cardDevPenaltyLabel: 'Штраф по договору:',
      cardDevPenaltyValue: '-1,500,000 ₽ (15% от стоимости лота)',
      cardDevPayoutLabel: 'Остаток к выдаче:',
      cardDevPayoutValue: '500,000 ₽ (из 2,000,000 ₽ внесенных)',
      cardDevWaitLabel: 'Срок ожидания:',
      cardDevWaitValue: '6–18 месяца через суды или кассу застройщика',
      cardDomExitTitle: 'Переуступка через DomExit',
      cardDomExitBadge: '100% ВОЗВРАТ',
      cardDomExitPayoutLabel: 'Выплата продавцу:',
      cardDomExitPayoutValue: '2,000,000 ₽ (Наличными при сделке)',
      cardDomExitFeeLabel: 'Комиссия продавца:',
      cardDomExitFeeValue: '0 ₽ (Без скрытых удержаний)',
      cardDomExitWaitLabel: 'Срок выхода:',
      cardDomExitWaitValue: '7–14 рабочих дней',
      cardDomExitBuyerBadge: 'Покупателю: -3 млн ₽',
    },
    statsBar: {
      lotsCount: '9,227 ЛОТОВ В БАЗЕ',
      assetsVolume: '133 млрд ₽ АКТИВОВ',
      bankAccreditation: 'Аккредитация в топ-10 банках РФ',
      escrowEndorsement: 'Эскроу и аккредитивы ЦБ РФ',
      rosreestrEndorsement: 'Прямая регистрация в Росреестре',
      stage1: 'ЭТАП 01: Юридический аудит ДДУ',
      stage2: 'ЭТАП 02: Подбор пула покупателей',
      stage3: 'ЭТАП 03: Безопасный расчет (Эскроу)',
    },
    calc2Min: {
      title: 'Рассчитайте возврат денег за 2 минуты',
      subtitle: 'Узнайте точную сумму выплаты на руки без штрафов застройщика',
      tabSeller: 'Я хочу продать (0%)',
      tabBuyer: 'Я хочу купить с выгодой',
      paidAmountLabel: 'Фактически выплачено застройщику:',
      cashToHandLabel: 'Сумма к получению на руки:',
      penaltySavedLabel: 'Экономия на штрафах:',
      phonePlaceholder: '+7 (___) ___-__-__',
      submitBtn: 'Получить расчет (0%)',
    },
    common: {
      details: 'Подробнее о лоте ->',
      back: 'Назад',
      loading: 'Загрузка данных...',
      noResults: 'По вашему запросу ничего не найдено',
      resetFilters: 'Сбросить фильтры',
      verified42: 'Документы проверены (42/42)',
      cashToSeller: 'Наличными продавцу сейчас:',
      todayPrice: 'Текущая цена у застройщика:',
      marketAdvantage: 'Ваша выгода от цены рынка:',
      currency: '₽',
      rubleSymbol: '₽',
    },
  },
  en: {
    brandName: 'DomExit',
    brandTagline: 'CLEAN EXIT',
    nav: {
      sellers: 'For Sellers',
      catalog: 'DDU Catalog',
      howItWorks: 'How It Works',
      story: 'About Us',
      investors: 'Investors',
      partners: 'Partners',
      tracker: 'Deal Tracker',
      admin: 'Admin Core',
      wantBuy: 'I Want to Buy',
      wantSell: 'I Want to Exit (0%)',
    },
    footer: {
      legalDescription: 'Institutional safe assignment platform under Federal Law 214-FZ. Standard of capital protection for developers and real estate buyers in St. Petersburg and Moscow.',
      tgChannel: 'Telegram Channel',
      navTitle: 'Navigation',
      urgentBuyout: 'Urgent Buyout & Assignment',
      verifiedCatalog: 'Verified Property Catalog',
      safeDealProtocol: 'Safe Settlement Protocol',
      investPools: 'Investment Liquidity Pools',
      officesTitle: 'Service Offices',
      mskOffice: 'Moscow: Presnenskaya Embankment, 12, Moscow-City, Federation Tower',
      spbOffice: 'St. Petersburg: Malookhtinsky Ave, 64B, St. Petersburg Plaza',
      supportTitle: 'Contact & Support',
      hotline: '+7 (800) 555-34-29',
      email: 'deal@domexit.ru',
      rosreestrBadge: 'Rosreestr Digital Escrow Verification',
      disclaimer: 'DomExit Technologies LLC. Reg. 1247800049210. Not a brokerage agency. All transactions are executed via Central Bank accredited letters of credit with direct federal title registration under 214-FZ.',
      rightsReserved: '© 2024–2026 DomExit. All rights reserved.',
    },
    hero: {
      badgeLocations: 'ST. PETERSBURG & MOSCOW',
      badgePlatform: 'Installment & DDU Clean Exit Platform (0% Markup)',
      headline: 'The seller gets 100% of cash back, and the buyer locks in the old contract price!',
      subheadline: 'Legal exit from developer installment agreements without developer contract penalties (10%–15%). Buyers purchase verified apartments at 2023–2024 prices saving up to 30% against current market rates.',
      ctaSell: 'Exit My Unit (0%) ->',
      ctaCompare: 'Compare Methods',
      cardDevTitle: 'If Returning Directly to Developer',
      cardDevBadge: 'LOSS UP TO 15%',
      cardDevPenaltyLabel: 'Contract penalty:',
      cardDevPenaltyValue: '-1,500,000 ₽ (15% of total lot value)',
      cardDevPayoutLabel: 'Remaining payout:',
      cardDevPayoutValue: '500,000 ₽ (out of 2,000,000 ₽ paid)',
      cardDevWaitLabel: 'Waiting period:',
      cardDevWaitValue: '6–18 months through court or developer cashbox',
      cardDomExitTitle: 'Assignment via DomExit',
      cardDomExitBadge: '100% CASH REFUND',
      cardDomExitPayoutLabel: 'Seller payout:',
      cardDomExitPayoutValue: '2,000,000 ₽ (Cash at deal closing)',
      cardDomExitFeeLabel: 'Seller commission:',
      cardDomExitFeeValue: '0 ₽ (Zero hidden deductions)',
      cardDomExitWaitLabel: 'Exit timeframe:',
      cardDomExitWaitValue: '7–14 business days',
      cardDomExitBuyerBadge: 'Buyer saves: -3M ₽',
    },
    statsBar: {
      lotsCount: '9,227 ACTIVE LOTS',
      assetsVolume: '133B ₽ ASSETS REGISTRY',
      bankAccreditation: 'Accreditation with Top 10 Russian Banks',
      escrowEndorsement: 'Escrows & Letters of Credit per Central Bank',
      rosreestrEndorsement: 'Direct Rosreestr Digital Title Escrow',
      stage1: 'STAGE 01: Legal Audit of DDU Contract',
      stage2: 'STAGE 02: Buyer Pool Matching',
      stage3: 'STAGE 03: Bank Escrow Settlement',
    },
    calc2Min: {
      title: 'Calculate your cash return in 2 minutes',
      subtitle: 'Find out the exact net payout without developer penalty deductions',
      tabSeller: 'I want to exit (0%)',
      tabBuyer: 'I want to buy with discount',
      paidAmountLabel: 'Amount paid to developer:',
      cashToHandLabel: 'Cash amount to receive:',
      penaltySavedLabel: 'Penalty amount saved:',
      phonePlaceholder: '+7 (___) ___-__-__',
      submitBtn: 'Get My Calculation (0%)',
    },
    common: {
      details: 'View Lot Details ->',
      back: 'Back',
      loading: 'Loading data...',
      noResults: 'No lots found matching your criteria',
      resetFilters: 'Reset filters',
      verified42: 'Documents verified (42/42 points)',
      cashToSeller: 'Cash to seller now:',
      todayPrice: 'Current developer price:',
      marketAdvantage: 'Your savings vs. today market:',
      currency: '₽',
      rubleSymbol: '₽',
    },
  },
};
