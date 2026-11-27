# Руководство по подключению Yandex DataLens к DomExit (Zero-PII BI & FinOps)

Настоящее руководство описывает подключение бесплатного сервиса бизнес-аналитики **Yandex DataLens** (0 ₽/мес) к обезличенным аналитическим срезам платформы DomExit, автоматически выгружаемым в закрытый S3-бакет (`S3_PRIVATE_BUCKET/_analytics/datalens/`).

---

## 5 шагов быстрой настройки (15 минут)

### Шаг 1: Активация Yandex DataLens в Yandex Cloud
1. Перейдите в консоль [Yandex Cloud](https://console.ycloud.ru/).
2. В левом меню сервисов выберите **DataLens** (или откройте [datalens.yandex.ru](https://datalens.yandex.ru/)).
3. Если инстанс DataLens еще не создан, нажмите **Создать инстанс** (выберите бесплатный тариф «Community/Standard» с лимитом пользователей 0 ₽).

---

### Шаг 2: Создание сервисного подключения к S3 Object Storage
1. В интерфейсе DataLens перейдите в раздел **Подключения** (`Connections`) и нажмите **Создать подключение**.
2. В качестве типа источника выберите **Yandex Object Storage (Файлы)** или **Yandex Query**.
3. Укажите параметры подключения:
   - **Бакет:** `domexit-private-docs-staging` (для Staging) или имя вашего закрытого бакета.
   - **Путь к файлам:** `_analytics/datalens/*.ndjson`
   - **Аутентификация:** выберите сервисный аккаунт (`sa-domexit-uploader`) с ролью `storage.viewer` в каталоге проекта.

---

### Шаг 3: Создание датасетов (Datasets)
Создайте 4 целевых датасета на основе 4 файлов NDJSON:

1. **`ds_deals_funnel` (`deals_funnel.ndjson`):**
   - **Поля:** `lotCode` (строка), `region` (строка), `dealTrack` (строка), `currentStage` (строка), `lotStatus` (строка), `dduFullPriceRub` (число), `sellerCashRub` (число), `developerPriceTodayRub` (число), `buyerNetSavingsRub` (число), `platformFeeNetRub` (число), `totalCycleDays` (число), `isClosedSuccess` (булево).
   - **Метрики:** `Количество лотов` (`count(lotCode)`), `Средний чек` (`avg(sellerCashRub)`), `Выручка комиссии` (`sum(platformFeeNetRub)`), `Средний срок выхода` (`avg(totalCycleDays)`).

2. **`ds_curator_sla_kpi` (`curator_sla_kpi.ndjson`):**
   - **Поля:** `curatorId` (строка), `curatorRole` (строка), `activeLotsCount` (число), `closedDealsCount` (число), `totalNetCommissionRub` (число), `auditActionsCount` (число).
   - **Метрики:** `Сделок на куратора` (`sum(closedDealsCount)`), `Сумма комиссий` (`sum(totalNetCommissionRub)`).

3. **`ds_ai_finops_usage` (`ai_finops_usage.ndjson`):**
   - **Поля:** `date` (дата), `module` (строка), `callsCount` (число), `inputTokens` (число), `outputTokens` (число), `pagesProcessed` (число), `estimatedCostRub` (число).
   - **Метрики:** `Общая стоимость AI за месяц` (`sum(estimatedCostRub)`), `Количество обращений` (`sum(callsCount)`).

4. **`ds_journal_seo_metrics` (`journal_seo_metrics.ndjson`):**
   - **Поля:** `slug` (строка), `category` (строка), `status` (строка), `hasTelegramBroadcast` (булево), `readingTimeMin` (число).
   - **Метрики:** `Опубликовано статей` (`count(slug)`).

---

### Шаг 4: Построение чартов (Виджетов)
В разделе **Чарты** (`Charts`) настройте базовые визуализации:
- **KPI-индикаторы:** Общая комиссия площадки (₽), Средний цикл сделки (дней), Экономия покупателей (₽).
- **Воронка конверсии:** распределение лотов по этапам (`currentStage`: packaging → legal_audit → available → matching → closing → closed).
- **FinOps круговая диаграмма:** затраты на AI по модулям (`Vision OCR`, `GPT Pro Legal`, `GPT Lite Buyer`, `Concierge RAG`, `KYC Check`).
- **Столбчатая диаграмма:** рейтинг кураторов по закрытым лотам и скорости прохождения аудита.

---

### Шаг 5: Сборка Дашборда Владельца («DomExit Executive Dashboard»)
1. Перейдите в раздел **Дашборды** и нажмите **Создать дашборд**.
2. Добавьте заголовок: **DomExit Executive & FinOps Dashboard**.
3. Разместите созданные виджеты:
   - Верхний ряд: 4 карточки KPI.
   - Средний ряд: Воронка сделок и динамика комиссий.
   - Нижний ряд: AI FinOps затраты и SLA кураторов.
4. Настройте селекторы фильтрации по датам (`snapshotDate`) и регионам (`region`).

---

## Политика безопасности и 152-ФЗ (Zero-PII Compliance)
- Все выгружаемые файлы проходят обязательную валидацию через встроенный фильтр **`assertZeroPiiInExport`**.
- В срезы **никогда не попадают**:
  - ФИО и паспортные данные покупателей и продавцов.
  - Номера телефонов и адреса электронной почты.
  - Персональные 12-значные ИНН физических лиц.
  - Точные адреса квартир и ссылки на конфиденциальные документы из `documents_vault`.
- Файлы NDJSON перезаписываются автоматически раз в сутки планировщиком или по кнопке в **AI Лаборатории**.
