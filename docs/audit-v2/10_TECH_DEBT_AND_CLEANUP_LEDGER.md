# Глава 10: Реестр технического долга, оптимизации и подготовки к Фазе 5

## 10.1. Инвентарь перегруженных файлов (Bloated Files Ledger > 1000 строк)

В ходе архитектурного сканирования 200+ файлов платформы DomExit выявлены файлы, превышающие порог в 1000 строк кода. Наличие монолитных файлов увеличивает когнитивную нагрузку при разработке и риск регрессионных ошибок при доработках.

| Файл | Кол-во строк | Текущая ответственность | Рекомендованная декомпозиция для Фазы 5 |
| :--- | :--- | :--- | :--- |
| `src/pages/BankPortalPage.tsx` | **3,473** | Портал партнерских банков: эскроу, аккредитация девелоперов, спецсогласования, сотрудники банков | Разбить на 4 подкомпонента в `src/components/bank/`: `BankEscrowTab.tsx`, `BankDeveloperAccreditationTab.tsx`, `BankSpecialApprovalsTab.tsx`, `BankStaffTab.tsx`. |
| `src/pages/AdminPackagingPage.tsx` | **1,597** | Упаковка объектов, модерация фото, расчет дисконтов, превью карточки каталога | Вынести модерацию фото в `PackagingGalleryManager.tsx`, превью карточки в `PackagingPreviewModal.tsx`. |
| `src/components/admin/tabs/SellerRequestsTableTab.tsx`| **1,519** | Таблица заявок продавцов, детальные модальные окна, назначение кураторов | Вынести модальные окна просмотра документов и назначения в отдельные компоненты. |
| `src/pages/AdminLegalAuditPage.tsx` | **1,501** | 42 проверки паспорта, 5 юридических осей, загрузка подтверждающих документов | Вынести 5 осей комплаенса в `LegalAuditAxesSection.tsx`, паспорт проверок в `LegalCheckpointsMatrix.tsx`. |
| `src/pages/AdminPartnersBotPage.tsx` | **1,468** | Устаревшая страница партнеров (в `App.tsx` уже стоит редирект на `/admin/brokers`) | **Кандидат на удаление:** Страница замещена `AdminBrokersPage.tsx`. Сохраняется как справочный архив. |
| `src/dal/repositories/LegalRepository.ts` | **1,451** | Полные сид-данные 26 юридических документов (ФЗ-152, ФЗ-38, ФЗ-214) | Вынести статичные текстовые константы законов в JSON-манифесты `src/data/legalDocsData.json`. |
| `src/pages/LotDetailsPage.tsx` | **1,349** | Карточка лота: галерея, финансовый калькулятор, паспорт, инфраструктура, карта метро | Разбить на `LotFinancialOverview.tsx`, `LotLegalPassportSummary.tsx`, `LotInfrastructureMap.tsx`. |
| `src/components/legal/LegalCmsManager.tsx` | **1,263** | Панель управления юридическими документами и версиями согласий | Декомпозировать на вкладки `PoliciesListTab.tsx` и `PolicyEditorModal.tsx`. |
| `src/dal/repositories/DevelopersRepository.ts` | **1,206** | Список аккредитованных девелоперов РФ и их условия кредитования | Вынести массив сид-данных застройщиков в отдельный файл `src/data/developersSeed.json`. |
| `src/components/admin/tabs/LegalAndChannelsTab.tsx` | **1,067** | Вкладка настроек реквизитов компании и публичных каналов соцсетей | Разделить на `CompanyProfileForm.tsx` и `PublicChannelsConfigForm.tsx`. |
| `backend/src/routes/telegram.ts` | **1,053** | Вебхук Telegram, обработка всех команд, callback-кнопок, привязки, релея | Вынести обработчики команд в `telegramCommands.ts`, обработку callback в `telegramCallbacks.ts`. |
| `src/pages/AdminPipelinePage.tsx` | **1,022** | Канбан-пайплайн сделок, модальные окна перевода стадий | Вынести канбан-колонку в `PipelineKanbanColumn.tsx`. |

---

## 10.2. Оценка безопасности устаревших таблиц `demo_*` в боевой базе YDB

В боевой базе данных YDB (`etnckg937628mnid7tnb`) присутствуют исторические таблицы с префиксом `demo_*` (созданные на самых ранних прототипах системы).

### Результаты анализа невмешательства (Non-Interference Audit):
1. **Изоляция в коде:** В `src/dal/config/collectionResolver.ts#L12-L14` функция `resolveCollectionName` жестко отсекает префикс `demo_`:
   ```typescript
   export function resolveCollectionName(baseCollection: string): string {
     return baseCollection.replace(/^demo_/, '');
   }
   ```
2. **Изоляция на сервере:** Серверный роутер `backend/src/routes/data.ts` взаимодействует **исключительно** с каноническими именами без префиксов (`lots`, `deals`, `seller_requests` и т.д.).
3. **Безопасность данных:** Таблицы `demo_*` полностью пассивны, не читаются и не модифицируются текущей кодовой базой. В соответствии с правилом Production Safety Gate они не удаляются, исключая любой риск случайного повреждения связанных метаданных YDB.

---

## 10.3. Реестр неиспользуемых артефактов и расхождений (Dead Code & Discrepancies)

1. **Несоответствие имени коллекции инцидентов:**
   - В бэкенде: `security_incidents` (`backend/src/routes/data.ts#L48`).
   - Во фронтенде: `security_incident_logs` (`src/dal/repositories/SecurityIncidentsRepository.ts#L4`).
   - **Решение для Фазы 5:** Унифицировать имя на `security_incidents` во фронтенд-репозитории.
2. **Устаревший маршрут `/admin/partners-bot`:**
   - Страница `AdminPartnersBotPage.tsx` (1,468 строк) замещена современной `AdminBrokersPage.tsx`. В `App.tsx#L160` настроен редирект. Файл `AdminPartnersBotPage.tsx` является мертвым кодом и может быть удален в плановом рефакторинге.
3. **Файлы миграций Netlify и Firebase:**
   - В корневом каталоге отсутствуют файлы конфигурации `netlify.toml` или `firebase.json` (полностью удалены в Фазах 1–2).
   - Все устаревшие упоминания Netlify в документах устранены.

---

## 10.4. Чеклист готовности к Фазе 5 (Pre-Phase 5 Readiness Gate)

Перед стартом активной разработки Фазы 5 необходимо убедиться в выполнении следующих условий:

- [x] **100% локализация в РФ:** Вся инфраструктура развернута в Yandex Cloud (Москва).
- [x] **Абсолютная сохранность данных:** Ежедневный автоматический бекап в S3 активен в 02:00 UTC, Write-Ahead Journal непрерывно фиксирует события в `_journal/`.
- [x] **Telegram OS стабильна:** Вебхуки боевого (@DomExitOfficialBot) и тестового (@DomExitStageBot) ботов настроены и проверены.
- [x] **Целостность паролей:** Хэши паролей надежно защищены от затирания во всех методах auth и data.
- [ ] **Схемная валидация бэкенда:** Спроектировать модуль `validationAndGuards.ts` на Node.js без раздувания зависимостей.
- [ ] **Детектор аномалий и суточные квоты:** Разработать модуль `anomalyDetector.ts`.
- [ ] **Buy-Box скоринг:** Заменить статическую фильтрацию в `AdminMatchmakerPage.tsx` на математический расчет `matchScore`.
- [ ] **Унификация `security_incidents`:** Исправить имя коллекции в `SecurityIncidentsRepository.ts`.
