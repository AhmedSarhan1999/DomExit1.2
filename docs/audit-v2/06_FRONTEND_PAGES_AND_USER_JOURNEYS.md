# Глава 6: Фронтенд-архитектура, страницы и пользовательские сценарии (User Journeys)

## 6.1. Полная карта маршрутов приложения (Routing & Layouts)

Маршрутизация фронтенда DomExit построена на базе `react-router-dom` v6 (`src/App.tsx#L8-L195`). Все страницы загружаются асинхронно через `React.lazy()` для минимизации начального размера бандла (`PageSkeletonLoader`).

```mermaid
flowchart TD
    subgraph RootRouter["App.tsx Router"]
        subgraph PublicLayoutWrapper["PublicLayout (Шапка, Футер, Уведомления)"]
            p_home["/ (HomePage)"]
            p_sellers["/sellers (SellersPage)"]
            p_opps["/opportunities (OpportunitiesPage)"]
            p_vip["/vip-catalog (VipCatalogPage)"]
            p_lot["/opportunities/:lotCode (LotDetailsPage)"]
            p_verify["/verify/:lotCode (VerifyCertificatePage)"]
            p_partners["/partners (PartnersPublicPage)"]
            p_portal["/portal & /account (ClientPortalPage)"]
            p_tracker["/client/tracker/:dealId (ClientTrackerPage)"]
            p_legal["/legal/* (LegalIndex, Reader, Archive)"]
            p_knowledge["/knowledge/* & /faq (Knowledge Hub)"]
        end

        subgraph AdminGuardWrapper["AdminRouteGuard (Защита: owner | employee)"]
            a_dash["/admin/dashboard (AdminDashboardPage)"]
            a_pipe["/admin/pipeline (AdminPipelinePage)"]
            a_pack["/admin/packaging/:lotId? (AdminPackagingPage)"]
            a_legal["/admin/legal-audit/:lotId? (AdminLegalAuditPage)"]
            a_match["/admin/matchmaker/:lotId? (AdminMatchmakerPage)"]
            a_close["/admin/closing/:dealId? (AdminClosingPage)"]
            a_brok["/admin/brokers (AdminBrokersPage)"]
            a_arch["/admin/archive-logs (AdminArchiveLogsPage)"]
            a_prof["/admin/profile (AdminCuratorProfilePage)"]
        end

        subgraph BankGatewayWrapper["BankGatewayErrorBoundary (Защита: role: bank)"]
            b_portal["/bank-portal & /admin/bank-gateway (BankPortalPage)"]
        end
    end
```

---

## 6.2. Сценарий посетителя и покупателя (Visitor & Buyer Journey)

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Покупатель / Инвестор
    participant Cat as /opportunities (Каталог)
    participant Lot as /opportunities/:lotCode
    participant Modal as BidModal / BuyBox
    participant DAL as DatabaseGateway
    participant Tg as Telegram (@DomExitOfficialBot)

    Buyer->>Cat: Поиск, фильтры (город, ЖК, цена, срок сдачи, дисконт)
    Cat->>DAL: getAll('lots') (SWR Cache 30s)
    Cat-->>Buyer: Список проверенных лотов с дисконтом и расчетом выгоды
    Buyer->>Lot: Переход в карточку объекта
    Lot-->>Buyer: 42 проверки юр. паспорта, фотоотчет, финансовая модель уступки
    Buyer->>Modal: Клик «Забронировать по безопасной сделке»
    Modal->>Modal: Выбор трека: 100% Cash или Ипотека (справка / одобрение банка)
    Modal->>DAL: save('buyer_applications', bidData)
    Note over Modal,DAL: Создание записи в buyer_applications.<br/>Запись в journal S3.
    DAL->>Tg: telegramNotifier.notifyNewBuyerApplication
    Tg-->>Buyer: Пуш-уведомление в Telegram: «Ваша заявка принята в работу»
    Tg-->>Buyer: Назначение персонального куратора и кнопка перехода в чат
```

### Ключевые этапы сценария покупателя:
1. **Каталог (`OpportunitiesPage.tsx`):**
   - Серверная и клиентская фильтрация: город (`spb`, `msk`, `sochi`, `kazan`), застройщик, этажность, тип комнатности (`studio`, `1-room`, `euro`), готовность дома (%).
   - Сортировки: по сумме дисконта, по возрастанию цены, по дате добавления.
   - 48-часовое окно раннего доступа для участников VIP-клуба (`isEarlyAccessVIP`).
2. **Карточка объекта (`LotDetailsPage.tsx` — 1,349 строк):**
   - Интерактивная финансовая модель: цена ДДУ, сумма выплаты продавцу, остаток долга девелоперу по рассрочке, текущая цена застройщика и чистая экономия покупателя.
   - Развернутый юридический паспорт объекта (42 проверки: ЕФРСБ банкротство, ФССП аресты, суды общей юрисдикции, материнский капитал СФР, согласие супругов).
   - Интерактивная карта Yandex Maps с инфраструктурой и временем пешком до метро.
3. **Оформление бронирования и трекинг (`ClientPortalPage.tsx`, `ClientTrackerPage.tsx`):**
   - Доступ к чату с назначенным куратором в реальном времени.
   - Просмотр эскроу-реквизитов и статуса регистрации переуступки в Росреестре.

---

## 6.3. Сценарий продавца (Seller 4-Step Exit Wizard Journey)

Страница `/sellers` (`src/pages/SellersPage.tsx` — 38,918 байт) представляет собой конверсионный интерактивный мастер срочного выхода из ДДУ:

```mermaid
flowchart LR
    Step1["Шаг 1: Параметры объекта\nГород, ЖК, Застройщик,\nПлощадь, Этаж, Номер ДДУ"] --> Step2["Шаг 2: Финансовые условия\nЦена ДДУ, Внесенная сумма,\nОстаток долга, Срочность"]
    Step2 --> Step3["Шаг 3: Юридический чеклист\nМаткапитал, Брак, Ипотека,\nЗадолженности ФССП"]
    Step3 --> Step4["Шаг 4: Загрузка документов\nСкан ДДУ, Справка застройщика,\nФотографии квартиры"]
    Step4 --> Submitted["Заявка в статусе intake_moderation\nУведомление в Telegram кураторам"]
```

### Архитектурные элементы мастера продавца:
- **`SellerLiveAuditCard.tsx`:** Интерактивный калькулятор в правой колонке. В реальном времени рассчитывает сумму, которую продавец получает на руки наличными (100% внесенных средств, 0% комиссии с продавца), и сопоставляет ее со штрафом при расторжении договора застройщиком (15%).
- **`SellerStepProperty.tsx` & валидаторы (`src/utils/validators.ts`):** Проверка ИНН девелопера, формата номера ДДУ, корректности соотношения сумм (`paidAmount <= contractPrice`).
- **Защита персональных данных:** Документы продавца загружаются напрямую в приватный бакет S3 по Presigned URL без публикации в открытый доступ (`StorageService.ts`).

---

## 6.4. Исчерпывающий аудит партнерской и брокерской подсистемы

> [!IMPORTANT]
> **Критическое архитектурное уточнение для Фазы 5:**
> Партнерская и брокерская подсистема **УЖЕ ПОЛНОСТЬЮ РЕАЛИЗОВАНА В КОДЕ** на всех трех уровнях (публичный интерфейс, личный кабинет партнера, админ-панель управления брокерами). Ее **КАТЕГОРИЧЕСКИ НЕЛЬЗЯ ПЕРЕСОЗДАВАТЬ ЗАНОВО** в Фазе 5 — необходимо лишь интегрировать новые сервисы с уже работающей логикой.

### 1. Публичный лендинг партнеров (`src/pages/PartnersPublicPage.tsx`):
- Доступен по адресу `/partners`.
- Категории партнеров: `mortgage_broker` (ипотечные брокеры), `developer_cancellation` (отделы расторжений застройщиков), `lawyer` (юристы по банкротству и недвижимости), `trade_in_developer` (агентства trade-in).
- Форма регистрации: валидация ФИО, телефона РФ, ИНН организации (10 или 12 цифр). Автоматическая генерация уникального реферального кода партнера (`PART-XXXX`).
- Запись создается в репозитории `PartnersRepository` (`src/dal/repositories/PartnersRepository.ts`).

### 2. Личный кабинет партнера (`src/components/portal/PartnerPortalTab.tsx`):
- Интегрирован во вкладку «Партнерский кабинет» страницы `/portal`.
- **Реферальная ссылка:** Генерация ссылки с параметром `?ref=PART-XXXX`.
- **Механизм предварительного бронирования клиента (`PartnerPreliminaryRequest`):**
  - Партнер фиксирует клиента вводом его кода (`DEX-XXXXXX`), ФИО, телефона, ЖК и параметров ДДУ (`handlePartnerReferralSubmit` — строки 69–120).
  - Система запускает **обратный отсчет на 7 дней** (`expiresAt = now + 7 days`).
  - Если в течение 7 дней клиент заключает сделку, партнер получает фиксированное вознаграждение **30 000 ₽ за сделку** (`fixedRewardPerDealRub: 30000`).
  - Данные сохраняются в коллекции `partner_preliminary_requests` (`PartnerRequestsRepository.ts`).

### 3. Панель управления брокерами (`src/pages/AdminBrokersPage.tsx` — 818 строк):
- Доступна по адресу `/admin/brokers` (с редиректом из устаревшего `/admin/partners-bot`).
- **Функционал администратора:**
  - Поиск и фильтрация партнеров по категориям и статусам комиссий (`in_progress`, `payable`, `paid`).
  - Реестр выплат: модальное окно регистрации выплаты (`showPayoutModal`) с фиксацией суммы, номера банковской транзакции, банка плательщика и даты.
  - Генерация акта сверки взаиморасчетов (`showReconciliationModal`) для бухгалтерской отчетности с кнопкой печати.
  - Аудит всех действий через `AuditLogsRepository.addLog`.

---

## 6.5. Контур управления и CRM администратора (Staff & Owner Admin Operations)

Все административные страницы защищены гардом `AdminRouteGuard` (`src/components/auth/AdminRouteGuard.tsx`):

1. **Единый командный дашборд (`AdminDashboardPage.tsx`):**
   - Виджеты KPI: объем активных лотов по городам (СПб, Москва, регионы), средний дисконт каталога, сделки в эскроу Сбера и ВТБ, прогнозируемая комиссия платформы (2.5%).
   - Карточки оперативного управления: «Экстренный выход», «Юридический комплаенс», «Брокерская сеть», «Штатные кураторы».
   - Интеграция с карточкой статуса безопасности YDB и Cloud Functions.
2. **Пайплайн сделок (`AdminPipelinePage.tsx`):**
   - Канбан-доска стадий: `intake_moderation` ➔ `legal_audit` ➔ `packaging` ➔ `buyer_matching` ➔ `closing_escrow` ➔ `completed`.
   - Перетаскивание карточек с фиксацией в транзакционном журнале.
3. **Модуль юридического аудита (`AdminLegalAuditPage.tsx` — 1,501 строка):**
   - Формирование правового паспорта из **42 контрольных чекпоинтов**.
   - 5 юридических осей комплаенса:
     1. `title_encumbrances` — чистота титула и обременения;
     2. `bankruptcy_debts` — банкротство и долги ФССП;
     3. `developer_settlement` — взаиморасчеты с девелопером;
     4. `family_matkap` — маткапитал и права несовершеннолетних;
     5. `cession_escrow` — схема эскроу-расчетов по переуступке.
4. **Упаковка и маркетинг (`AdminPackagingPage.tsx` — 1,597 строк):**
   - Модерация фотографий продавца: одобрение для публичной галереи (`approvedGalleryImages`), отклонение некачественных фото.
   - Фиксация рыночной стоимости по оценке DomExit и генерация промо-тизеров.
5. **Банковский портал (`BankPortalPage.tsx` — 3,473 строки):**
   - Изолированный интерфейс для авторизованных сотрудников банков-партнеров (`Сбербанк`, `ВТБ`, `Альфа-Банк`, `ДОМ.РФ`).
   - Согласование аккредитации застройщиков и проектного финансирования.
