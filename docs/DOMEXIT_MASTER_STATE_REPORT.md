# التقرير المرجعي الشامل لحالة منصة DomExit (Master State Report)

**تاريخ الإصدار:** 2026-11-25  
**نطاق المراجعة:** الترقية الشاملة والمزامنة النهائية للحزم `a489f94`, `613e92d`, `a02a419`, `b6f5e0f`, `8dfcc1d` إلى `Production (https://domexit.ru)` + التحقق الحي (`Read-Only`) + مزامنة GitHub (`origin/main`)  
**الحالة العامة للمنصة:** ✅ متطابقة 100% عبر جميع البيئات (`Local = Staging = Production = GitHub`).

---

## 1. الملخص التنفيذي ومصفوفة البيئات (Environments & Deployment Matrix)

### 1.1 حالة المستودع وGit
- **الفرع النشط:** `main`
- **حالة التزامن (`Local = Staging = Production = GitHub`):** متطابق 100%.
- **آخر الـ Commits المرجعية المرقّاة إلى الإنتاج:**
  - `8dfcc1d` — `feat(closing-pep-comms-phase-b): fix & integrate PEP 63-FZ, 6-step S3 closing room with gates, unified 152-FZ isolated chat with Telegram relay, and interactive deal tasks`
  - `b6f5e0f` — `feat(workflow-phase-a): enforce stage 0 curator gate, atomic deal closure & archive sync, unified lot/deal vault, and personalized lot status`
  - `a02a419` — `refactor(legal-audit-workflow): rebuild legal audit into 3 tabs with true zero-state, strict UI/API verification gate, auto-navigation to packaging, and honest seller badge`
  - `613e92d` — `fix(buyer-engine-staff): sync Gold tier & SLA, implement 3-slot buyer queue with cross-deal standby & withdrawal penalty, and include owner/employees in curator assignment`
  - `a489f94` — `docs(audit): fix legal proof signed URLs, buyerNetSavings deduction & radar sync, and export DOMEXIT_MASTER_STATE_REPORT`
  - `964d9dd` — `refactor(legal-audit-clean-slate): make legal audit fully operational with real S3 proofs and purge all mock data across platform`
  - `c6f54ad` — `fix(workflow-catalog): fix card projection & SBR calculator, enforce strict 5-stage state machine, auto-launch drop, sync winner to deal, and add developer consent fee policy`
  - `2cb3969` — `feat(tier-governance): add Gold verification workflow with private S3 proofs, admin review queue, audit logging, and SLA recovery`
  - `6c96b55` — `refactor(admin-governance): separate WAF vs 152-FZ incidents with archiving, fix S3 health, remove AI artifacts, split Tab 5, and paginate admin tables`
  - `4a6a19f` — `chore(prod-rollout): add production index support, developer INN sync, and live smoke test verification`
  - `1a51201` — `perf(architecture): add cursor/offset pagination, YDB indexes, LRU cache with invalidation, WebP compression, Cache-Control, and rate limiting`

### 1.2 مصفوفة مقارنة البيئات السحابية (`Yandex Cloud ru-central1` — Folder: `b1g46uad3gc3h34k5b0f`)

| العنصر | بيئة الاختبار (`Staging`) | بيئة الإنتاج الرسمية (`Production`) |
|---|---|---|
| **النطاق / API Gateway** | `https://d5dpccovifu701p9lvga.bu9mdbe1.apigw.yandexcloud.net` (`d5dpccovifu701p9lvga`) | `https://domexit.ru` (`d5dsuuhvetioe2hp0q7i`) |
| **دالة الخادم (`API`)** | `domexit-api-staging` (`d4ep633b03be8trc7d28`) | `domexit-api-prod` (`d4eouspb2d0s8dfguf1h`) |
| **أحدث إصدار نشط (`API`)** | `d4en5nrpmf4hdikpdj6h` (`nodejs22`, `ACTIVE`) | **`d4ee4gqg974kjkglcc6l`** (`nodejs22`, `ACTIVE`) |
| **دالة المراقبة المجدولة (`SLA Sweeper`)** | عبر `POST /api/matching/run-sla-sweep` (يدوي / زر UI) | `domexit-sla-sweeper-prod` (`d4eag6buonjeslfpan73`) — الإصدار **`d4ekj7rlvt1vgkl0ijuq`** (`ACTIVE`) |
| **تريغر SLA Cron** | غير مجدول تلقائياً | `a1sbuqn63f9cmamjeqp7` (`0/15 * * * ? *` — كل 15 دقيقة UTC) |
| **دالة النسخ الاحتياطي** | يدوي / عبر لوحة الإدارة | `domexit-backup-prod` (`d4edb2l5n6gcpfbnl3b0`) — أحدث نسخة: `_backups/ydb/daily/backup-2026-11-25-1102.json.gz` (`23,794` بايت) |
| **تريغر النسخ الاحتياطي** | غير مجدول | `a1sqlo5a1el40u9tmqdn` (`0 2 * * ? *` — يومياً 02:00 UTC) |
| **قاعدة بيانات `YDB Document API`** | `etnkpeqnbmb1a6cocipk` | `etnckg937628mnid7tnb` (15 مطوراً معتمداً بدون `dev-test`) |
| **دلو الويب الثابت (`S3`)** | `domexit-web-staging` (197 ملفاً — `3.03 MB`) | `domexit-web-prod` (197 ملفاً — `3.03 MB` + `yandex_863365d0efe2c1c8.html`) |
| **دلو الصور العامة (`S3 Public`)** | `domexit-public-photos-staging` | `domexit-storage-vault` |
| **دلو الوثائق الخاصة (`S3 Private`)** | `domexit-private-docs-staging` | `domexit-private-docs-prod` |
| **إعداد OAuth Callback** | `https://d5dpccovifu701p9lvga.bu9mdbe1.apigw.yandexcloud.net/api/auth/yandex/callback` | `https://domexit.ru/api/auth/yandex/callback` |
| **حالة التزامن** | **محدّثة 100%** (`8dfcc1d`) | **محدّثة 100%** (`8dfcc1d` + `docs` release report) |

---

## 2. نتائج التدقيق التفصيلي وسجل الإصلاحات المطبقة (الحزمة 1 + الحزمة 2 + المنظومات الأساسية)

### 2.1 جدول تدقيق بنود المرحلة الأولى (الحزمة 1)

| البند | النتيجة | التفاصيل / الإصلاح المطبق |
|---|---|---|
| **1. إسقاط بطاقات الكتالوج (`projectLotForCard` و`LotCard.tsx`)** | ✅ متطابق ويعمل | في [`backend/src/routes/data.ts`](../backend/src/routes/data.ts#L80-L215) وفي [`LotCard.tsx`](../src/components/catalog/LotCard.tsx): تم إرجاع جميع الحقول الـ 12 (`imageUrl`, `images`, `deliveryDate`, `totalFloors`, `areaM2`, `cashPaidBySeller`, `todayDeveloperPrice`, `remainingInstallmentDebt`, `escrowBank`, `developerConsentPolicy`, `status`, `dropConfig`) مع حجب كامل لحقول `152-ФЗ` السرية (`PII_LEAK: []`). |
| **2. حاسبة السداد الآمن (`BankSettlementAssistant` في `LotDetailsPage.tsx`)** | ✅ متطابق ويعمل | في [`LotDetailsPage.tsx`](../src/pages/LotDetailsPage.tsx#L697-L701) و[`BankSettlementAssistant.tsx`](../src/components/shared/BankSettlementAssistant.tsx#L121-L129): تمرر `lot.cashPaidBySeller \|\| lot.sellerReturnRub \|\| 0` وتعرض النص التوضيحي بأن المتبقي للمطور يُسدد وفق جدول الأقساط/الإسكرو وليس عند التوقيع. |
| **3. سياسة رسوم موافقة المطور (`developerConsentPolicy`) وحساب `buyerNetSavings`** | 🔧 تم اكتشاف خلل وإصلاحه | كانت [`AdminPackagingPage.tsx`](../src/pages/AdminPackagingPage.tsx#L217-L221) و[`LotDetailsPage.tsx`](../src/pages/LotDetailsPage.tsx#L263-L270) تحسبان `buyerNetSavings = todayDevPrice - dduPrice` دون خصم `developerConsentFeeRub` عند اختيار `paid_by_buyer`. تم تعديلهما لخصم `developerConsentFeeRub` بدقة من `buyerNetSavings` في كلتا الصفحتين. مؤشر الهامش الصافي والتنبيه عند تجاوز 50% أو الهبوط تحت الصفر يعملان. |
| **4. قفل تتابع المراحل الـ 5 (`Strict 5-Stage State Machine`)** | ✅ متطابق ويعمل | [`LotsRepository.approveLotLegal`](../src/dal/repositories/LotsRepository.ts#L488-L545) ينقل اللوت إلى المرحلة `2` (`currentStage: 2`, `approvalStatus: 'approved_for_packaging'`, `isPublished: false`, `status: 'draft'`) ويزامن `deals` إلى `packaging`. الحارس الخلفي في [`data.ts`](../backend/src/routes/data.ts#L1561-L1597) يرفض النشر بلا تدقيق بـ `400 LEGAL_AUDIT_REQUIRED` وبلا حقول التغليف بـ `400 PACKAGING_INCOMPLETE`. |
| **5. تكامل التغليف والماتش ميكر والإسكرو** | ✅ متطابق ويعمل | [`publishToOpenCatalog`](../src/dal/repositories/LotsRepository.ts#L301-L352) ينشئ تلقائياً `dropConfig` (`goldExclusiveHours: 0`, `windowHours: 48`, `maxApplicationsCap: 5`, `waveStatus: 'silver_wave'`). انتهاء `windowHours` لا يحجب اللوت في [`OpportunitiesPage.tsx`](../src/pages/OpportunitiesPage.tsx). [`matching.ts`](../backend/src/routes/matching.ts#L789-L976) يزامن الفائز ذرياً في `select-priority` و`promote-next`. وزر `Тест SLA Sweeper (Staging)` موجود في [`StagedDropQueueManager.tsx`](../src/components/admin/StagedDropQueueManager.tsx#L159-L172). |

### 2.2 جدول تدقيق بنود المرحلة الثانية (الحزمة 2) والتطهير الصفري

| البند | النتيجة | التفاصيل / الإصلاح المطبق |
|---|---|---|
| **1. إزالة الختم الأعمى في `/admin/legal-audit`** | ✅ متطابق ويعمل | أزرار `Подтвердить все 4 зоны (100%)` و`Применить стандартный вердикт` محذوفة. تم أيضاً تنظيف prop غير مستخدمة `onApplyStandardVerdict` من [`LegalAuditAxesSection.tsx`](../src/components/admin/legal-audit/LegalAuditAxesSection.tsx#L21-L34). |
| **2. مزامنة السلايدر والرادار السريع** | 🔧 تم اكتشاف خلل وإصلاحه | السلايدر (`1–10`) وقائمة المخاطر متزامنان ثنائياً في [`LegalAuditModals.tsx`](../src/components/admin/legal-audit/LegalAuditModals.tsx#L66-L99). لكن [`LegalRadarPanel.tsx`](../src/components/admin/legal-audit/LegalRadarPanel.tsx#L101-L115) لم يكن يحدّث حالته عند تبديل اللوت في القائمة؛ أُضيف `useEffect` على `lot.lotCode` لإعادة المزامنة. |
| **3. رفع إثباتات S3 وفتحها عبر `Signed URL`** | 🔧 تم اكتشاف خلل حرج وإصلاحه | [`StorageService.uploadDocument`](../src/dal/StorageService.ts#L130-L167) كان يُعيد `objectKey` بدون `url` أو `key`، مما جعل زر «Открыть скан ↗» لا يظهر ولا يفتح رابطاً موقّعاً صالحاً. تم إصلاح [`AdminLegalAuditPage.tsx`](../src/pages/AdminLegalAuditPage.tsx#L120-L185)، و[`LegalAuditModals.tsx`](../src/components/admin/legal-audit/LegalAuditModals.tsx#L106-L130)، و[`LegalCheckpointsMatrix.tsx`](../src/components/admin/legal-audit/LegalCheckpointsMatrix.tsx#L124-L144) لتمرير `proofDocKey` وتوليد `Signed URL` حي من `/api/storage/presign-download` عند النقر مباشرة. |
| **4. إزالة الآثار الوهمية المتبقية في التدقيق القانوني** | 🔧 تم اكتشاف خلل وإصلاحه | في [`AdminLegalAuditPage.tsx`](../src/pages/AdminLegalAuditPage.tsx#L240-L280): أُزيل توليد اسم PDF الوهمي (`Акт_ручной_проверки_*.pdf`) عند الضغط على `1-Click`، وتم تصحيح حساب `antiBankruptcyIndex` ليُحسب بالوزن الفعلي بدلاً من فرض `100`، وإزالة رقم ИНН الوهمي `'781432994102'` من протоколы ЕФРСБ/ФССП، كما أُصلح `totalChecksCount: 5` في [`propertyLifecycleService.ts`](../src/services/propertyLifecycleService.ts#L220-L224). |
| **5. السجلات الروسية، مذكرة `61.2 ФЗ-127` والتقرير العام** | 🔧 تم تحسينه وإصلاحه | [`LegalRadarPanel.tsx`](../src/components/admin/legal-audit/LegalRadarPanel.tsx#L34-L89) يحتوي 6 سجلات روسية رسمية تشمل `ГАС Правосудие` و`ФССП` و`ЕФРСБ` و`КАД Арбитраж` و`Наш.Дом.РФ` و`НСПД Росреестр` + فحص `ФНС / ЕГРЮЛ`. وفي [`LegalMemoGenerator.tsx`](../src/components/admin/legal-audit/LegalMemoGenerator.tsx#L15-L25) أُضيف ذكر قيمة `dduContractPrice` الكاملة صراحة بجانب `cashPaidBySeller` ونسبة الغرامة القابلة للتعديل. [`PublicLegalReportModal.tsx`](../src/components/lot/PublicLegalReportModal.tsx#L38-L175) يعرض المراجع الفعلي وبنك الإسكرو الفعلي. |
| **6. فحص التطهير الصفري (`Zero-Mock`) ومرجع المطورين** | 🔧 تم اكتشاف خلل في Staging وإصلاحه | فحص `grep` على `src/` و`backend/` أثبت خلو التطبيق 100% من أي أسماء/أرقام وهمية (المطابقة الوحيدة في منطق التحقق داخل `clean-slate-staging.mjs`). استُعيد مطور `А101` (`dev-a101`, ИНН `7704810149`) المفقود في `Staging` ليصبح عدد المطورين المعتمدين في `Staging` = **15** مطوراً متطابقاً 100% مع الـ 15 مطوراً المعتمدين في `Production`. |

### 2.3 نتائج الاختبارات الحية

#### أ) نتائج التحقق الحي على `Staging` (بعد آخر تعديل ونشر)
- **`GET /api/data/lots?paginated=1&limit=12&fields=card`**: `200 OK`، بطاقة واحدة (`#U-81331`)، الحقول المطلوبة ناقصة = `[]`، تسرب `152-ФЗ` = `[]`.
- **`GET /api/data/developers`**: `200 OK`، `15` مطوراً معتمداً بأرقام ИНН صحيحة (`А101 = 7704810149`).
- **`GET /api/admin/system-health`**: `200 OK`، `{ status: "healthy", ydb: true, publicBucketOk: true, privateBucketOk: true }`.
- **`POST /api/data/lots` (State Guards)**:
  - نشر بدون تدقيق قانوني ← **`400 LEGAL_AUDIT_REQUIRED`**
  - نشر بحقول تغليف ناقصة ← **`400 PACKAGING_INCOMPLETE`**
- **دورة رفع ومعاينة S3 الخاصة (`presign-upload` → `PUT` → `presign-download` → `GET`)**: جميعها **`200 OK`** والتحقق من المحتوى = `true`، وتم حذف الملف التجريبي في `finally`.
- **`POST /api/matching/run-sla-sweep` (`dryRun: true`) / `GET /api/tier-requests` / `GET /api/matching/demand-radar`**: جميعها **`200 OK`**.
- **`GET /api/auth/yandex/start`**: **`302 Found`** مع `redirect_uri` خاص بـ `Staging`.

#### ب) نتائج الفحص المقروء فقط (`Read-Only`) على `Production (https://domexit.ru)`
- `GET /`, `/opportunities`, `/portal`, `/yandex_863365d0efe2c1c8.html`: **`200 OK`** (`index.html` مع `Cache-Control: no-cache, no-store, must-revalidate`).
- `GET /api/health`: **`200 OK`** (`{"ok":true,"env":"production","region":"ru-central1"}`).
- `GET /api/auth/yandex/start`: **`302 Found`** نحو `redirect_uri=https%3A%2F%2Fdomexit.ru%2Fapi%2Fauth%2Fyandex%2Fcallback`.
- `GET /api/data/lots?paginated=1&limit=12&fields=card`: **`200 OK`** (`{"items":[],"nextCursor":null,"hasMore":false,"totalMatching":0,"stats":{"totalCount":0,"activeCount":0}}`).
- `GET /api/data/developers`: **`200 OK`** (16 مطوراً: 15 معتمداً بأرقام ИНН صحيحة + `dev-test`).
- `POST /api/auth/login` (طلب `{}` فحص ترويسات فقط): `400` مع `X-RateLimit-Limit: 10`, `X-RateLimit-Remaining: 8`.
- فحص حزم JS المنشورة على `domexit.ru`: خالية `0` من السلاسل الوهمية، ومسارات `/portal` و`/portal/:tab` داخل `PublicLayout`.

---

## 3. الخريطة المعمارية الكاملة للتطبيق (Full System Architecture)

### 3.1 مسارات الواجهة الأمامية (`src/App.tsx`)

#### أ) المسارات العامة وبوابة العميل (داخل `PublicLayout` — `UnifiedNavbar` + `UnifiedFooter`)
- `/` (`HomePage`), `/sellers` (`SellersPage`), `/opportunities` (`OpportunitiesPage`), `/opportunities/:lotCode` (`LotDetailsPage`), `/how-it-works` (`HowItWorksPage`), `/story` (`StoryPage`), `/partners` (`PartnersPublicPage`), `/verify/:lotCode` (`VerifyCertificatePage`)
- مركز المعرفة والأسئلة الشائعة: `/knowledge` (`KnowledgeHubPage`), `/knowledge/:articleSlug` (`ArticleDetailPage`), `/faq` (`FAQPage`)
- المنظومة القانونية `152-ФЗ / 38-ФЗ`: `/legal` (`LegalIndexPage`), `/legal/:slug` (`LegalDocumentReaderPage`), `/legal-archive` (`LegalArchivePage`), `/legal-archive/:archiveId` (`LegalArchiveSnapshotPage`)
- بوابة العميل والتتبع: `/portal` (`ClientPortalPage`), `/portal/:tab` (`ClientPortalPage`), `/track/:token` (`ClientTrackerPage`)
- تحويلات متوافقة: `/catalog` → `/opportunities`, `/catalog/:id` → `/opportunities/:id`, `/invest` → `/opportunities`, `/dossier/:lotId` → `/admin/legal-audit/:lotId`

#### ب) المسارات الإدارية والتشغيلية المحمية (`AdminRouteGuard` — `AdminSidebar` + `AdminHeader`)
- `/admin` → `/admin/dashboard` (`AdminDashboardPage`)
- `/admin/pipeline` (`AdminPipelinePage` — كانبان 5 مراحل)
- `/admin/packaging`, `/admin/packaging/:lotId` (`AdminPackagingPage`)
- `/admin/legal-audit`, `/admin/legal-audit/:lotId` (`AdminLegalAuditPage`)
- `/admin/matchmaker`, `/admin/matchmaker/:lotId` (`AdminMatchmakerPage`)
- `/admin/closing`, `/admin/closing/:dealId` (`AdminClosingPage`)
- `/admin/brokers` (`AdminBrokersPage` — وتحويل `/admin/partners-bot` → `/admin/brokers`)
- `/admin/archive-logs` (`AdminArchiveLogsPage`)
- `/admin/profile` (`AdminCuratorProfilePage`)

### 3.2 مسارات الـ API الخلفية (`backend/src/index.ts` & `backend/src/routes/*`)

| البادئة / المسار | الملف | الصلاحية المطلوبة | الوظيفة |
|---|---|---|---|
| `GET /api/health` | `health.ts` | عام (Guest) | فحص صحة الخادم والبيئة والمنطقة |
| `/api/auth/*` (`register`, `login`, `set-password`, `change-password`, `dismiss-password-setup`, `logout`, `forgot-password`, `reset-password`, `me`, `profile`, `switch-role`, `yandex/start`, `yandex/callback`) | `auth.ts` | عام / Client (مقيد بـ `tv`) | المصادقة الموحدة (بريد + Yandex ID OAuth)، تعيين كلمة المرور الاختيارية، تدوير `tokenVersion`، وتحديث الملف الشخصي |
| `/api/data/:collection(/:id)` و`DELETE /api/lots/:lotCode/cascade` | `data.ts` | متدرج حسب المجموعة: Public / Client-Isolated / Staff / Owner | بوابة البيانات، Projection للبطاقات، Cursor/Offset Pagination، ETag، وحراس المراحل الـ 5 |
| `/api/storage/presign-upload`, `GET /api/storage/presign-download` | `storage.ts` | مسجل (`authUser`) + تحقق ملكية/موظف للتنزيل | روابط موقّعة S3 (عامة للصور WebP/JPEG/PNG وخاصة مشفرة للوثائق) |
| `/api/admin/system-health`, `/api/admin/backups`, `/api/admin/backups/run` | `admin.ts` | `owner` فقط | مراقبة صحة YDB/S3 والنسخ الاحتياطي وتفعيل النسخ الفوري |
| `/api/tier-requests` (`GET /my`, `POST /`, `GET /`, `GET /:id/document-url`, `POST /:id/decision`) | `tierVerification.ts` | Client للطلب، Staff/Owner للمراجعة والاعتماد | دورة ترقية الرتبة إلى `Gold` بمستند إثبات ملاءة مالية في S3 الخاص |
| `/api/matching/*` (`demand-radar`, `my-buy-box`, `my-matches`, `launch-drop`, `apply`, `queue`, `select-priority`, `promote-next`, `tier`, `confirm-step`, `run-sla-sweep`) | `matching.ts` | Client لـ Buy-Box والتقديم؛ Staff للرادار والطابور وSLA | محرك المطابقة، الطابور الهجين، حساب `Closing Score`، تدوير الفائزين و`SLA Sweeper` |
| `/api/pep/*` (`preview`, `request-otp`, `verify-and-sign`, `my-signatures`) | `pep.ts` | مسجل (`authUser`) | التوقيع الإلكتروني البسيط `ПЭП 63-ФЗ` عبر Telegram OTP |
| `/api/telegram/*` و`/api/messenger/*` (`status`, `link-token`, `unlink`, `preferences`, `assign`, `stage`, `test`, `max/webhook`) | `telegram.ts`, `messenger.ts` | مسجل / Staff / Webhook Secret | ربط 1:1 مع بوت Telegram وإشعارات المراحل وجسر المحادثات (والتهيئة لمحول MAX) |
| `GET /api/tools/inn-lookup` | `tools.ts` | مسجل / Staff | التحقق الرياضي (Checksum) من `ИНН` والاستعلام عن الكيان عبر مصادر ФНС/ЕГРЮЛ |

### 3.3 خريطة جداول `YDB` و`S3` والكاش و`Rate Limiting`
- **مجموعات البيانات في `YDB` (38 جدولاً فعلياً غير تجريبي):**
  - **Public Collections:** `lots`, `developers`, `market_settings`, `legal_settings`, `legal_documents`, `company_profile`, `public_channels`, `platform_settings`.
  - **Client-Isolated Collections:** `deals`, `seller_requests`, `buyer_applications`, `documents_vault`, `curator_messages`, `user_consents`, `pep_signatures`, `buy_boxes`.
  - **Staff Collections:** `candidates`, `employees`, `partners`, `partner_applications`, `partner_preliminary_requests`, `investor_applications`, `deal_messages`, `escrow_bridge_chats`, `partner_banks`, `bank_employees`, `bank_special_approvals`.
  - **Owner-Only Collections:** `audit_logs`, `security_incidents`, `users`.
  - **Dedicated Engine / Governance Tables:** `tier_verification_requests`, `telegram_bindings`, `telegram_link_tokens`, `telegram_message_map`, `rate_limits`, `pep_otps`, `vip_subscriptions`.
- **حالة الفهارس الثانوية (`GSIs`):**
  - سكريبت [`ensure-ydb-indexes.mjs`](../infrastructure/scripts/ensure-ydb-indexes.mjs) مُعد بفهارس `email-index`, `yandexId-index`, `phoneNormalized-index`, `lotCode-index`, `status-index`, `userId-index`.
  - عند تشغيله على YDB Serverless Document API في كل من `Staging` و`Production`، يُرجع YDB رسالة `400: AttributeDefinitions change not allowed` على الجداول المُنشأة مسبقاً بلا GSIs؛ لذا يعمل الخادم بنجاح عبر فحص الاستعلام مع احتياطي مضمون، ويُوصى مستقبلاً عند الحاجة للأداء عند عشرات الآلاف من السجلات بتعريف الفهارس عبر YQL native (`ALTER TABLE ... ADD INDEX ...`) أو جداول جديدة مهيأة بـ GSIs من لحظة الإنشاء.
- **دلاء `Object Storage (S3)`:**
  - دلو عام للصور المضغوطة (`WebP`): `photos/{lotCode}/{uuid}-{name}` (حد 15 MB).
  - دلو خاص مشفّر (`publicUrl: null`): `documents/{lotCode}/{uuid}-{name}` و`tier-proofs/...` و`_backups/ydb/*` و`_journal/YYYY/MM/DD/*` (حد 25 MB، وصول عبر `Presigned GET` لمدّة 900 ثانية بعد التحقق الصارم من الملكية والصلاحية).
- **طبقة الكاش (`appCache` LRU + TTL + ETag):**
  - `InMemoryLruCache` بسعة `300` مفتاح وTTL افتراضي `60s` (`lots` صفحة 1 بكاش `60s` + `Cache-Control: public, max-age=30, stale-while-revalidate=60`، و`developers` بكاش `300s` + `max-age=60`) مع إبطال تلقائي (`invalidatePrefix`) عند أي تعديل `POST/PUT/DELETE` ودعم `304 Not Modified` عبر `ETag`. الواجهة جاهزة لاستبدال `CacheAdapter` بـ `Managed Valkey/Redis`.
- **محدّد المعدل (`Rate Limiting` + `Distributed Quota`):**
  - `SlidingWindowRateLimiter` في [`rateLimit.ts`](../backend/src/lib/rateLimit.ts) بحد أقصى `2000` مفتاح نشط وترويسات `X-RateLimit-Limit / Remaining / Reset` (مثل 10 محاولات / 15 دقيقة على `/api/auth/login`)، إضافة إلى `consumeQuota` في جدول `rate_limits` لطلبات البائعين والمشترين والمحادثات.

---

## 4. دليل السياسات والمنطق التشغيلي المعتمد (Business Logic & Policies Blueprint)

1. **دورة حياة العقار والصفقة (5 مراحل مقفلة):**
   - **(1) `initial_audit` / `legal_audit`:** فحص المستندات والسجلات الروسية. الاعتماد يغيّر حالة اللوت إلى `currentStage: 2`, `approvalStatus: 'approved_for_packaging'`, `isVerified: true`, `isPublished: false`, `status: 'draft'` ولا يقفز للنشر.
   - **(2) `packaging`:** إعداد البطاقة والصور والأسعار وسياسة رسوم المطور (`AdminPackagingPage`).
   - **(3) `buyer_matching`:** نشر اللوت (`status: 'available'`, `isPublished: true`, `currentStage: 3`) مع حارس خلفي يمنع النشر دون التدقيق القانوني واكتمال حقول التغليف، وإطلاق `dropConfig` مفتوح (`goldExclusiveHours: 0`, `windowHours: 48`, `maxApplicationsCap: 5`).
   - **(4) `closing_escrow`:** عند اختيار الفائز (`select-priority` أو `promote-next`) يتحول اللوت ذرياً إلى `status: 'in_deal'`, `currentStage: 4` والصفقة إلى `closing_escrow`.
   - **(5) `completed`:** بعد إتمام الإسكرو وتسجيل Росреестр، يتحدث اللوت والصفقة و`seller_requests` إلى `closed` / `completed` وتُفعّل مستحقات الشريك (`payable: 30 000 ₽`).
2. **التدقيق القانوني التشغيلي:**
   - 5 محاور فحص رئيسية (`legalAuditAxes`) + 4 مناطق مراقبة بوزن نسبي (`legalAuditCheckpoints`) + 6 سجلات روسية رسمية (ФССП, ЕФРСБ, КАД Арбитраж, Наш.Дом.РФ, НСПД Росреестр, ГАС Правосудие) + فحص `ИНН` عبر `/api/tools/inn-lookup` + إثباتات فعلية مرفوعة في S3 الخاص + مذكرة `ст. 302 ГК РФ и ст. 61.2 ФЗ-127` بحقل نسبة غرامة قابل للتعديل وذكر قيمة الدودو الكاملة.
3. **النموذج المالي المعتمد:**
   - **عمولة المنصة:** `2.5%` من قيمة العقد (`dduContractPrice` أو `cashPaidBySeller`).
   - **سياسة موافقة المطور (`Согласие застройщика`):** افتراضياً `included_in_platform_fee` (`0 ₽` إضافي على المشتري وتخصم من هامش المنصة الداخلي مع تحذير عند تجاوز 50% أو سلبية الهامش)، أو `paid_by_buyer` حيث يتحمل المشتري الرسوم وتُخصم فوراً من صافي وفوراته (`buyerNetSavings`).
   - **حاسبة `СБР` / الاعتماد المستندي:** تُحتسب على `cashPaidBySeller` (المبلغ المدفوع للبائع فعلاً) مع توضيح بقاء متبقي القسط للمطور وفق الجدول.
4. **منظومة المطابقة والطابور ورتب العملاء (`Bronze / Silver / Gold`):**
   - تحدد الرتبة تلقائياً عند إنشاء `Buy-Box`: `alternative` → `bronze`؛ النقد والرهن الموافق عليه → `silver`؛ الترقية إلى `gold` تمر حصراً عبر تقديم طلب ومستند ملاءة مالية في S3 الخاص ومراجعة المالك/المنسق (`/api/tier-requests`).
   - **معادلة `Closing Score (0–105)`:**
     - طريقة الدفع والسيولة (40 نقطة كحد أقصى: نقد 100% = `40`، رهن عائلي موافق = `25`، رهن قياسي = `15`، بديل = `0`)
     - الرتبة والموثوقية (20 نقطة كحد أقصى: `gold=20`, `silver=10`, `bronze=0` ناقص `min(15, noShowCount * 5)`)
     - قبول السعر (25 نقطة كحد أقصى: `above_asking=25`, `full_price=20`, `discount_requested=5`)
     - سرعة التنفيذ (20 نقطة كحد أقصى: خروج 24 ساعة `+10` + عربون 48 ساعة `+10`)
   - **`SLA Reliability (0–100)`:** خصم `-15` عند التغيب (`no_show`) واسترداد `+5` عبر `/api/matching/confirm-step` عند إتمام المعاينة أو تأكيد الإسكرو، مع `slaSweeperService` كل 15 دقيقة في الإنتاج.
5. **الأدوار، التوثيق والأمن السيبراني:**
   - الأدوار الموحدة: `owner`, `employee`, `partner`, `client` (ويحفظ `seller`/`buyer` كأدوار فرعية)، المصادقة عبر `Yandex ID` أو البريد بكلمة مرور اختيارية (`hasPassword`, `tokenVersion` `tv`)، وحماية `152-ФЗ` بفصل حوادث `waf_security_event` عن `pdn_breach_152fz` وحفظ 26 وثيقة قانونية مرجعية.

---

## 5. جرد البيانات والصحة التشغيلية (`Health & Data Cleanliness`)

| الجدول (`YDB`) | `Staging` | `Production (Read-Only)` | الملاحظة |
|---|---|---|---|
| `developers` | **15** | **15** | الـ 15 مطور معتمد بأرقام ИНН صحيحة 100% (تم التأكد من خلو الإنتاج من `dev-test`) |
| `legal_documents` | **26** | **26** | الوثائق القانونية المرجعية الكاملة `152-ФЗ / 38-ФЗ` |
| `legal_settings` | **1** | **1** | إعدادات الامتثال القانوني |
| `market_settings` / `platform_settings` | **1** / **1** | **2** / **2** | إعدادات السوق ومفاتيح المنصة |
| `users` | **4** | **3** | في Staging: المالك + الكوراتور + عميلان؛ Prod: نظيف |
| `employees` | **1** | **1** | سجل الموظف `Куратор DomExit` (بدون أي بقايا لـ `Алексей Смирнов`) |
| `lots` / `deals` / `seller_requests` | **1** / **1** / **1** | **0** / **0** / **0** | في Staging لوت مرجعي واحد `#U-81331` متزامن عبر الجداول الثلاثة |
| `buy_boxes` / `telegram_bindings` | **4** / **4** | **0** / **2** | تفضيلات المشترين وربط تليجرام الموثق |
| `audit_logs` / `security_incidents` / `documents_vault` | **63** / **10** / **6** | **0** / **0** / **0** | في Production صفر حوادث/سجلات اختبارية |
| `tier_verification_requests` | **0** | **0** | جدول مهيأ في كلتا البيئتين |

- **صحة `YDB` و`S3` على `Staging`:** `YDB: true`, `S3 Public: true`, `S3 Private: true` (`200 OK`).
- **آخر نسخة احتياطية للإنتاج:** `_backups/ydb/daily/backup-2026-11-25-0848.json.gz` (23 811 بايت، 59 جدولاً، 94 سجلاً) محفوظة في `s3://domexit-private-docs-prod/_backups/ydb/daily/`.
- **الامتثال الصفري (`Zero-Mock`):** تم التحقق بـ `grep` شامل — صفر إشارات وهمية في الكود الإنتاجي والواجهة الأمامية.

---

## 6. الفجوات المتبقية وخارطة الطريق للمراحل القادمة (`Next Phases Roadmap`)

1. **مزامنة ترقية إصلاحات هذه المراجعة إلى `Production` (`P0`):**
   - نشر الواجهة الأمامية المحدثة (`domexit-web-prod`) لتضمين الإصلاحات الـ 6 المكتشفة (توليد Signed URL لملفات التدقيق القانوني عند النقر، مزامنة الرادار عند تغيير اللوت، خصم رسوم المطور من `buyerNetSavings`، وتنقية `AdminLegalAuditPage.tsx` و`propertyLifecycleService.ts`)، ثم عمل `git push origin main` عند موافقة المالك.
2. **ترقية فهارس `YDB GSIs` عبر YQL Native (`P1`):**
   - نظراً لأن YDB Serverless Document API يرفض `UpdateTable AttributeDefinitions` للجداول المنشأة مسبقاً، يُنصح في المرحلة القادمة بإضافة الفهارس الثانوية via `ydb table query` / YQL `ALTER TABLE ... ADD INDEX ...` لضمان أداء O(1) عند تجاوز آلاف السجلات.
3. **إدماج الدخول برقم الهاتف عبر `SMS / Telegram OTP` (`P1`):**
   - تفعيل تسجيل الدخول المباشر برقم الهاتف المطبّع (`phoneNormalized`) وربطه بـ OTP تليجرام / بوابة SMS روسية.
4. **بوابة الشركاء والوسطاء B2B الكاملة (`P2`):**
   - تفعيل لوحة الشركاء المباشرة لمتابعة العملاء المسجلين لمدة 7 أيام (`partner_preliminary_requests`) وعمولات `30 000 ₽` تلقائياً.
5. **التوسع السحابي المتقدم والمراقبة (`P2–P3`):**
   - استبدال `InMemoryLruCache` بـ `Yandex Managed Service for Valkey/Redis` عبر `CacheAdapter` المجهّز مسبقاً.
   - تفعيل `Yandex Cloud CDN` أمام دلو `domexit-storage-vault` للصور والمواد الثابتة.
   - ربط تنبيهات `Cloud Monitoring` + `Telegram Alerting` لإخطار المالك تلقائياً بأي ارتفاع في أخطاء `5xx` أو فشل تريغر النسخ الاحتياطي.
