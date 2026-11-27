# الفصل 09: الفحص الجنائي المعماري للترابط، سجل الثغرات والأخطاء، وفجوة البيئات والترقيات المستقبلية

---

## 9.1 منهجية التدقيق الجنائي المعماري (Forensic Audit Methodology)

يمثّل هذا الفصل وقفة صدق ومصارحة هندسية مطلقة، بعيداً عن أي مديح عام أو افتراضات غير مختبرة. الغرض منه هو إخضاع كامل مستودع DomExit (`d:/DomExit1.2`) لفحص جنائي دقيق وعميق من واقع الكود الفعلي (`Real Code Inspection`) لاكتشاف أي خلل، أو حلقة مفقودة في الترابط بين الواجهة والخلفية، أو مسار استعلام غير مُحسّن، أو ثغرة أمنية كامنة، أو عدم تطابق في أسماء الحقول، أو تعارض بين إصدارات قواعد البيانات.

اعتمد الفحص الجنائي على 5 أدوات وتحليلات حتمية:
1. **الفحص النمطي البرمجي الثنائي (TypeScript Static Typechecking):** تشغيل `tsc --noEmit` للواجهة الأمامية (`npm run typecheck`) والخلفية السحابية (`npm --prefix backend run typecheck`). أظهر الفحص نجاح كلا المشروعين بنسبة خلو من الأخطاء 100% (Zero TypeScript Errors).
2. **فحص سلاسل الترابط الست (The 6-Loop End-to-End Wiring Audit):** تتبع مسار كل ميزة برمجية من قاعدة البيانات وحتى بكسلات الشاشة.
3. **التنقيب عن مسارات المسح الشامل المتبقية (Remaining scanAll Mining):** حصر كافة المواقع التي ما زالت تستدعي `ydb.scanAll` بدلاً من الفهارس الثانوية العالمية `queryByIndex`.
4. **تدقيق الأمان والخصوصية (152-ФЗ & XSS Security Audit):** فحص حقن HTML، ومسارات استدعاء API، وحواجز تسريب البيانات الشخصية.
5. **فحص الانحراف بين البيئات (Staging vs. Production Drift Analysis):** مطابقة الالتزامات والجداول السحابية الحالية على بيئة الاختبار مع ما هو منشور فعلياً على النطاق الرسمي `https://domexit.ru`.

---

## 9.2 مصفوفة الترابط الشامل لوحدات الذكاء الاصطناعي (End-to-End Wiring Matrix)

تتطلب كل ميزة استثمارية أو قانونية ذكية في DomExit اكتمال **الحلقات الست الإلزامية** لكي تُعتبر مربوطة وجاهزة للعمل الإنتاجي بنسبة 100%:
- **الحلقة 1 (قاعدة البيانات):** تعريف الجدول وحقوله والفهارس الثانوية (GSIs) في `backend/src/lib/ydbV2Schema.ts`.
- **الحلقة 2 (المنطق المعماري):** منطق الأعمال والمعالجة الحسابية في `backend/src/modules/` أو `backend/src/lib/`.
- **الحلقة 3 (المسارات وحواجز الأمان):** نقطة النهاية (REST Endpoint) وحواجز الصلاحيات في `backend/src/index.ts` وملفات `backend/src/routes/*.ts`.
- **الحلقة 4 (بوابة العميل):** دالة استدعاء العميل المؤطرة بالأنواع في `src/services/apiClient.ts`.
- **الحلقة 5 (واجهة المستخدم):** المكونات والصفحات التفاعلية في الواجهة الأمامية (`src/pages/*`, `src/components/*`).
- **الحلقة 6 (البيئة والتراخيص):** المتغيرات البيئية والتراخيص السحابية في `infrastructure/cloud-manifest.json` وسكربتات النشر.

```
       [الحلقة 1: قاعدة البيانات] YDB v2 Table & GSIs (ydbV2Schema.ts)
                                  │
                                  ▼
       [الحلقة 2: المنطق المعماري] Core Business Logic (backend/src/modules/*)
                                  │
                                  ▼
       [الحلقة 3: مسار الخادم] REST Endpoint & RBAC Guards (backend/src/routes/*)
                                  │
                                  ▼
       [الحلقة 4: عميل الواجهة] Typed API Client Gateway (src/services/apiClient.ts)
                                  │
                                  ▼
       [الحلقة 5: واجهة المستخدم] React Pages & Component State (src/pages/*)
                                  │
                                  ▼
       [الحلقة 6: بيئة السحابة] Cloud IAM, DNS & Env Configuration (cloud-manifest)
```

### 9.2.1 جدول الفحص التفصيلي للحلقات الست عبر الـ 18 ميزة

| الوحدة / الميزة البرمجية | الحلقة 1 (YDB v2) | الحلقة 2 (Module) | الحلقة 3 (Route) | الحلقة 4 (apiClient) | الحلقة 5 (Frontend UI) | الحلقة 6 (Deploy/Env) | الحكم الهندسي النهائي |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **لوحة تحكم مختبر الذكاء الاصطناعي (AI Lab)** | `system_settings_v2` | `aiFeatureFlags.ts` | `/api/ai/config` | `aiLab.getConfig`<br>`aiLab.updateConfig` | `AiLabControlTab.tsx`<br>`useAiFeatureFlags.ts` | `YC_FOLDER_ID`<br>`ENABLE_AI_LAB_BETA` | **✅ سليم ومربوط 100%** |
| **استكمال العناوين والشركات (DaData)** | `lots_v2` | `dadataService.ts` | `/api/ai/dadata/*` | `aiLab.suggestAddress`<br>`aiLab.lookupParty` | `AddressAutocompleteInput.tsx`<br>`LegalRadarPanel.tsx` | `DADATA_API_KEY`<br>(0 ₽ Free Tier) | **✅ سليم ومربوط 100%** |
| **مزامنة فائدة البنك المركزي (CBR.ru)** | `market_settings_v2` | `cbrSyncService.ts` | `/api/ai/cbr/sync` | `aiLab.syncCbrRate` | `AiLabControlTab.tsx`<br>تحديث آلي بالسويبر | موجز مفتوح<br>`cbr.ru/rss` | **✅ سليم ومربوط 100%** |
| **جسر أبحاث الوكلاء (Agent Bridge)** | `agent_tasks_v2`<br>`market_benchmarks_v2` | `agentBridgeService.ts` | `/api/ai/agent-bridge/*` | `aiLab.getTasks`<br>`aiLab.createTask` | `AiAgentBridgePanel.tsx`<br>`AdminPackagingPage.tsx` | `AGENT_BRIDGE_SECRET`<br>`YC_AI_IAM_TOKEN` | **✅ سليم ومربوط 100%** |
| **قراءة المستندات (Vision OCR + YMQ)** | `ocr_jobs_v2`<br>`S3 OCR Text` | `yandexVisionOcrClient.ts`<br>`ocrQueueService.ts` | `/api/ai/ocr/jobs` | `aiLab.startOcrJob`<br>`aiLab.getOcrJobs` | `InlineSellerDocumentsPanel.tsx` | `YMQ_OCR_QUEUE_URL`<br>`aiWorker.ts` | **✅ سليم ومربوط 100%** |
| **مساعد تدقيق ДДУ القانوني (Copilot)** | `ai_legal_analyses_v2` | `dduLegalCopilotService.ts` | `/api/ai/legal-copilot/*` | `aiLab.analyzeDduContract`<br>`aiLab.getLegalAnalyses` | `AdminLegalAuditPage.tsx` | `YC_FOLDER_ID`<br>`YC_AI_IAM_TOKEN` | **✅ سليم ومربوط 100%** |
| **فاحص ملاءة المشتري (Buyer Proof)** | `ai_buyer_verifications_v2` | `buyerProofAiService.ts` | `/api/ai/buyer-verify/*` | `aiLab.verifyBuyerProof` | `TierVerificationTab.tsx` | `YC_FOLDER_ID`<br>`YC_AI_IAM_TOKEN` | **✅ سليم ومربوط 100%** |
| **مزامنة تشييد Наш.Дом.РФ (ЕИСЖС)** | `eiszh_projects_v2` | `nashDomSyncService.ts` | `/api/ai/eiszh/*` | `aiLab.syncEiszh`<br>`aiLab.getEiszhProjects` | `AiLabControlTab.tsx`<br>تكامل داخلي مع AVM | واجهة مفتوحة<br>`xn--80az8a.xn--d1aqf.xn--p1ai` | **✅ سليم ومربوط 100%** |
| **محرك تقييم التنازل الحتمي (AVM v1)** | `avm_valuations_v2` | `avmValuationEngine.ts` | `/api/ai/avm/*` | `aiLab.estimateAvm`<br>`aiLab.getAvmHistory` | `AvmValuationCard.tsx`<br>`SellerAvmQuickCard.tsx` | حتمي 0 ₽<br>بدون مفاتيح خارجية | **✅ سليم ومربوط 100%** |
| **فاحص جودة الصور والخصوصية (Photo QA)** | `ai_packaging_results_v2` | `photoQaService.ts` | `/api/ai/packaging/photo-qa` | `aiLab.runPhotoQa` | `AiPackagingStudioPanel.tsx` | `YC_AI_IAM_TOKEN`<br>Yandex Vision | **✅ سليم ومربوط 100%** |
| **مُثري المترو والبنية التحتية (Geo Infra)** | `lots_v2` | `geoInfrastructureService.ts`| `/api/ai/packaging/geo-enrich`| `aiLab.enrichGeo` | `AiPackagingStudioPanel.tsx` | قاموس غير متصل<br>0 ₽ Baseline | **✅ سليم ومربوط 100%** |
| **كاتب النصوص الاستثمارية (Listing Copy)** | `ai_packaging_results_v2` | `aiListingCopyService.ts` | `/api/ai/packaging/generate-copy`| `aiLab.generateListingCopy` | `AiPackagingStudioPanel.tsx` | `YC_FOLDER_ID`<br>YandexGPT Pro | **✅ سليم ومربوط 100%** |
| **رادار القوانين والتشريعات الروسية** | `legislative_radar_v2` | `legislativeRadarService.ts` | `/api/ai/radar/*` | `aiLab.scanRadar`<br>`aiLab.getRadarItems` | `AiLegislativeRadarPanel.tsx` | 6 موجزات رسمية<br>`YandexGPT Lite` | **✅ سليم ومربوط 100%** |
| **محرك سيو المجلة وبوابة جودة YMYL** | `journal_articles_v2` | `journalSeoService.ts`<br>`contentDraftService.ts`| `/api/ai/journal/*`<br>`/api/public/*` | `aiLab.publishJournalArticle`<br>`aiLab.getPublicJournalArticles`| `JournalListPage.tsx`<br>`JournalArticlePage.tsx` | `PUBLIC_BASE_URL`<br>`TELEGRAM_CHANNEL_ID` | **✅ سليم ومربوط 100%** |
| **كونسيرج الذكاء الاصطناعي (S3 Vector RAG)** | `ai_concierge_sessions_v2`<br>`S3 knowledge_index` | `ragConciergeService.ts`<br>`ragKnowledgeIndexer.ts` | `/api/ai/concierge/*` | `aiLab.sendConciergeMessage`<br>`aiLab.applyConciergeBuyBox` | `DomExitConciergeWidget.tsx`<br>`AiConciergeAdminPanel.tsx` | `S3_PRIVATE_BUCKET`<br>`text-search-doc` | **✅ سليم ومربوط 100%** |
| **فحص الأطراف والسجلات الروسية (KYC)** | `kyc_checks_v2`<br>`S3 _kyc_protocols` | `kycOrchestratorService.ts`<br>`apiCloudAdapter.ts` | `/api/ai/kyc/*`<br>`/api/legal-core/v1/kyc/*`| `aiLab.runKycCheck`<br>`aiLab.getKycProtocolUrl`| `LegalRadarPanel.tsx`<br>`AiLabControlTab.tsx` | `APICLOUD_API_KEY`<br>`CHECKO_API_KEY` | **✅ سليم ومربوط 100%** |
| **تصدير ذكاء الأعمال لـ DataLens (Zero-PII)**| `S3 _analytics/datalens` | `datalensExportService.ts` | `/api/ai/datalens/*` | `aiLab.exportDataLensSnapshots`| `AiLabControlTab.tsx`<br>نافذة فجر السويبر | `S3_PRIVATE_BUCKET`<br>بوابة Zero-PII | **✅ سليم ومربوط 100%** |
| **واجهة النواة القانونية المعزولة (legal-core v1)**| جداول `legal-core` | `backend/src/modules/legal-core/`| `/api/legal-core/v1/*` | مستقلة عن العميل الداخلي<br>(B2B API مخصص) | مواصفة OpenAPI 3.0<br>جاهزة للمستهلكين | `LEGAL_CORE_TENANT_KEY`<br>`X-Tenant-Id` | **✅ سليم ومربوط 100%** |

### 9.2.2 التشريح العميق لسلاسل الربط (Code-Level Wiring Traces)

1. **سلسلة تدقيق عقود ДДУ القانونية (DDU Legal Copilot Trace):**
   - **قاعدة البيانات:** جدول `ai_legal_analyses_v2` في `backend/src/lib/ydbV2Schema.ts:165` مزود بمفتاح أساسي `id` وفهرس ثانوي عالمي `lotCode-createdAt-index`.
   - **المنطق:** خدمة `backend/src/modules/legal-core/dduLegalCopilotService.ts` تحمّل نصوص OCR من S3 وتقتطع السياق إلى 22 ألف حرف وتستدعي `yandexGptClient.ts` (نموذج Pro) وتولد مذكرة المادة 61.2 ومحاور التدقيق الخمسة.
   - **المسار:** مسار `POST /api/ai/legal-copilot/analyze` ومسار `GET /api/ai/legal-copilot/analyses` في `backend/src/routes/aiLab.ts:864-920`.
   - **العميل:** دالة `apiClient.aiLab.analyzeDduContract()` ودالة `apiClient.aiLab.getLegalAnalyses()` في `src/services/apiClient.ts:996-1010`.
   - **الواجهة:** صفحة التدقيق القانوني `src/pages/AdminLegalAuditPage.tsx` تستدعي الدالتين وتعرض بطاقة المحاور مع إمكانية اعتماد المذكرة القانونية أو تصديرها.
2. **سلسلة التقييم العقاري الحتمي (AVM Valuation Trace):**
   - **قاعدة البيانات:** جدول `avm_valuations_v2` في `backend/src/lib/ydbV2Schema.ts:182` مفهرس بـ `complexKey-createdAt-index` و`lotCode-createdAt-index`.
   - **المنطق:** محرك `backend/src/modules/proptech-ai/avmValuationEngine.ts` يدمج فائدة `market_settings` و`market_benchmarks` و`eiszh_projects` وينتج نطاق الخروج السريع في 14 يوماً.
   - **المسار:** `POST /api/ai/avm/estimate` و`GET /api/ai/avm/history` في `backend/src/routes/aiLab.ts:1136-1215`.
   - **العميل:** دالة `apiClient.aiLab.estimateAvm()` في `src/services/apiClient.ts:1075-1090`.
   - **الواجهة:** بطاقة التقييم `src/components/admin/packaging/AvmValuationCard.tsx` وبطاقة البائع السريعة `src/components/sellers/SellerAvmQuickCard.tsx`.
3. **سلسلة رادار التشريعات والمجلة (Legislative Radar & Journal Trace):**
   - **قاعدة البيانات:** جدولا `legislative_radar_v2` و`journal_articles_v2` في `ydbV2Schema.ts:198-230`.
   - **المنطق:** `legislativeRadarService.ts` يمسح 6 موجزات حكومية ويفرز بـ `yandexgpt-lite`، و`journalSeoService.ts` يطبق بوابة جودة YMYL ويولد sitemap.xml وrss.xml.
   - **المسار:** `/api/ai/radar/*` و`/api/ai/journal/*` و`/api/public/*` في `aiLab.ts` و`publicJournal.ts`.
   - **العميل:** دوال `apiClient.aiLab.getRadarItems()`, `generateRadarDraft()`, `publishJournalArticle()` في `apiClient.ts:1170-1300`.
   - **الواجهة:** لوحة تحكم الرادار `AiLegislativeRadarPanel.tsx`، وصفحات المجلة العامة `JournalListPage.tsx` و`JournalArticlePage.tsx`.

---

## 9.3 سجل الأخطاء والثغرات والتعارضات المكتشفة فعلياً (Verified Findings Registry)

خلال الفحص الجنائي للكود، تم حصر وتوثيق كافة الملاحظات الفنية وتقسيمها حسب درجة خطورتها وتأثيرها التشغيلي وفق نظام التصنيف القياسي المعترف به في هندسة البرمجيات:
- **`P0` (حرج للغاية — يجب معالجته قبل وضع أول روبل حقيقي في الإنتاج):** يؤثر على الأمان أو سلامة الصفقات أو يهدد بانهيار الأداء مع زيادة البيانات.
- **`P1` (مهم — يُوصى بمعالجته في أول دورة صيانة سريعة):** تحسين في استهلاك الموارد، سد ثغرات نظرية، أو حماية ضد تراكم البيانات المؤقتة.
- **`P2` (تحسين جودة الكود وتجربة المطور):** تنظيف للملفات، تقليل التكرار، ورفع كفاءة المعالجة.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Verified Findings Registry                      │
├───────┬──────────────────────────────────────┬─────────────────────────┤
│ فئة P0 │ 2 ملاحظات معمارية حرجة                 │ الأداء في الجداول الكبيرة│
│ فئة P1 │ 4 ملاحظات أمنية وتشغيلية مهمة         │ الثغرات النظرية والـ TTL │
│ فئة P2 │ 3 ملاحظات تنظيف وترشيد موارد          │ ملفات وسكربتات منسية    │
└───────┴──────────────────────────────────────┴─────────────────────────┘
```

### 9.3.1 الملاحظات الحرجة (Category P0 Findings)

#### [FINDING-P0-01] استعلامات المسح الكامل المتبقية في مسارات التفاوض والمطابقة (`matching.ts`)
- **الملف المصدري:** `backend/src/routes/matching.ts`
- **أرقام الأسطر الفعلية:** 909، 1312، 1484، 1952، 2491، 2550، 2623، 2731، 2790، 2853.
- **التوصيف الفني:**
  على الرغم من تدشين فهارس ثانوية عالمية (GSIs) متطورة في `ydbV2Schema.ts` لجداول `deals` و`buyer_applications` و`seller_requests` (مثل `buyerUserId-createdAt-index` و`lotCode-createdAt-index` و`status-createdAt-index`)؛ إلا أن عدداً من المسارات في `matching.ts` تستدعي `ydb.scanAll('deals', 500)` أو `ydb.scanAll('buyer_applications', 500)` ثم تقوم بالتصفية عبر الذاكرة بواسطة دالة `.filter()`.
  
  مثال من السطر 909:
  ```typescript
  // backend/src/routes/matching.ts:909
  const myApplications = ydb.isV2TablesEnabled()
    ? await ydb.queryByIndex<BuyerApplication>({ ... })
    : ((await ydb.scanAll<BuyerApplication>('buyer_applications', 500)) || []).filter(
        (a) => a.userId === authUser.id
      );
  ```
  ومع ذلك، في السطر 1952 و2491 و2731:
  ```typescript
  // backend/src/routes/matching.ts:1952
  const allDeals = await ydb.scanAll<any>('deals', 300);
  const userDeals = allDeals.filter(d => d.buyerUserId === authUser.id || d.sellerUserId === authUser.id);
  ```
- **الأثر التشغيلي:**
  في بيئة الاختبار الحالية بحجم بضع مئات من السجلات لا تظهر المشكلة؛ ولكن عند الانتقال للإنتاج ووصول السجلات لعشرات الآلاف، ستؤدي هذه الاستعلامات إلى بطء شديد في استجابة خادم Serverless (ارتفاع زمن الاستجابة إلى > 2500 مللي ثانية) واستهلاك غير مبرر لوحدات قراءة YDB الروبلية.
- **الحل البرمجي المقترح:**
  تحويل كافة الاستدعاءات داخل مسارات `/my-deals` و`/applications` إلى الاستعلام عبر الفهرس الثانوي المعياري مباشرة:
  ```typescript
  // الحل التصحيحي الموصى به:
  const userDeals = await ydb.queryByIndex<any>({
    tableName: 'deals',
    indexName: 'buyerUserId-createdAt-index',
    hashKey: 'buyerUserId',
    hashValue: authUser.id,
    scanIndexForward: false,
    limit: 50,
  });
  ```

#### [FINDING-P0-02] حقن HTML دون تعقيم عبر `dangerouslySetInnerHTML` في صفحة المقالات المعرفية
- **الملف المصدري:** `src/pages/knowledge/ArticleDetailPage.tsx`
- **رقم السطر الفعلي:** السطر 251 (`dangerouslySetInnerHTML={{ __html: article.content }}`)
- **التوصيف الفني:**
  يتم حقن متن المقال المعرفي `article.content` مباشرة في شجرة DOM دون تمريره عبر مكتبة تعقيم متخصصة مثل `DOMPurify` أو `sanitize-html`.
  ```tsx
  // src/pages/knowledge/ArticleDetailPage.tsx:251
  <div
    className="text-slate-700 leading-relaxed text-sm sm:text-base space-y-6"
    dangerouslySetInnerHTML={{ __html: article.content }}
  />
  ```
- **الأثر التشغيلي:**
  على الرغم من أن المقالات يكتبها حالياً مديرو المنصة، إلا أن وجود نافذة حقن خام يفتح ثغرة XSS مخزنة (Stored Cross-Site Scripting) في حال تم اختراق حساب أحد المحررين، أو في حال تغذية المقالات عبر موجز خارجي غير موثوق، مما قد يؤدي لسرقة رموز الجلسات (JWT Tokens) الخاصة بالمستخدمين.
- **الحل البرمجي المقترح:**
  تثبيت واستدعاء مكتبة التعقيم الصريحة `dompurify`:
  ```tsx
  import DOMPurify from 'dompurify';
  <div
    className="text-slate-700 leading-relaxed text-sm sm:text-base space-y-6"
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
  />
  ```

---

### 9.3.2 الملاحظات المهمة (Category P1 Findings)

#### [FINDING-P1-01] تخزين مصفوفة إلغاء التكرار في ذاكرة الخادم اللحظية لـ Telegram Webhook
- **الملف المصدري:** `backend/src/routes/telegram.ts`
- **أرقام الأسطر الفعلية:** 19 إلى 32 (`seenUpdates = new Set<number>()`).
- **التوصيف الفني:**
  تعتمد دالة `isDuplicateUpdate()` على حلقة ذاكرة محلية في الذاكرة الحية لـ Node.js تتسع لـ 500 معرف تحديث (`update_id`). نظراً لأن الخادم يعمل كدالة سحابية Serverless (قد تتوسع تلقائياً لتشغيل مثيلات متوازية متعددة Concurrent Instances)، فإن كل مثيل يمتلك ذاكرته المنفصلة. إذا أرسلت خوادم Telegram نفس التحديث لمثيل مختلف فسيتم تمريره مرتين، مما قد يسبب تكرار الردود أو تكرار العمليات.
- **الحل البرمجي المقترح:**
  تخزين `update_id` في جدول `rate_limits_v2` بمفتاح `tg_update:{updateId}` مع خاصية وقت الحياة TTL محدد بـ 3600 ثانية لضمان إلغاء التكرار الموزع عبر كافة المثيلات السحابية.

#### [FINDING-P1-02] تراكم جلسات كونسيرج الذكاء الاصطناعي القديمة دون أرشفة تلقائية
- **الملف المصدري:** `backend/src/modules/proptech-ai/ragConciergeService.ts`
- **التوصيف الفني:**
  يتم حفظ جلسات المحادثة للمستخدمين والزوار المجهولين في جدول `ai_concierge_sessions_v2` دون وجود مهمة حذف دوري للجلسات المتروكة التي تجاوزت مدة 30 يوماً والتي لم تسفر عن إنشاء صندوق شراء Buy-Box، مما يؤدي لتضخم حجم الجدول بمحادثات زوار غير مكتملة.
- **الحل البرمجي المقترح:**
  إضافة مهمة تنظيف دورية للجلسات القديمة المنتهية داخل نافذة الفجر لكاسح اتفاقيات مستوى الخدمة `slaSweeperService.ts` لحذف أي جلسة مجهولة مر عليها أكثر من شهر.

#### [FINDING-P1-03] عمليات مسح كاملة في معالجات لوحات مفاتيح Telegram OS
- **الملف المصدري:** `backend/src/lib/telegramCallbacks.ts`
- **أرقام الأسطر الفعلية:** 294، 429، 572، 720، 829.
- **التوصيف الفني:**
  عند ضغط المشرف على بعض الأزرار التفاعلية مثل استعراض المهام أو اللوتات النشطة، يتم استدعاء `ydb.scanAll('lots', 500)` ثم تصفيتها يدوياً بدلاً من الاستعلام المباشر عبر الفهرس الثانوي لحالة المرحلة `status-createdAt-index`.
- **الحل البرمجي المقترح:**
  توجيه الاستعلامات في `telegramCallbacks.ts` لتعمل حصراً عبر `ydb.queryByIndex` المعتمدة على الفهارس الثانوية العالمية.

#### [FINDING-P1-04] غياب مؤشر انتهاء الصلاحية التلقائي لمستندات الملاءة المالية
- **الملف المصدري:** `backend/src/lib/slaSweeperService.ts`
- **التوصيف الفني:**
  على الرغم من أن السويبر يراقب حصرية الموجة الذهبية (Task 1) وإغلاق الطرح (Task 2)، إلا أن مواعيد انتهاء صلاحية موافقات الائتمان العقاري (`mortgage_approval`) للمشترين لا تخضع لتصنيف خفض الرتبة التلقائي عند انتهاء تاريخ وثيقة البنك المعتمدة دون تجديد.
- **الحل البرمجي المقترح:**
  تفعيل مهمة فحص صلاحية مستندات الملاءة المالية وإرجاع الفئة الذهبية إلى الفضية تلقائياً عند انتهاء صلاحية قرار البنك.

---

### 9.3.3 ملاحظات تحسين الجودة والأداء (Category P2 Findings)

1. **[FINDING-P2-01] سكربتات الاختبار المؤقتة في مجلد البنية التحتية:**
   - وجود ملفات اختبارية مثل `test-packaging-studio-local.mjs` و`test-legal-core-kyc-datalens.ts` في مجلد `infrastructure/scripts/`. يجب أرشفة هذه الملفات أو نقلها إلى مجلد اختبارات مخصص `tests/` لمنع التشتت أثناء عمليات النشر.
2. **[FINDING-P2-02] ضغط صور الواجهة في المتصفحات القديمة:**
   - تستخدم الواجهة أدوات `imageOptimizer.ts` و`imageCompressor.ts` للضغط إلى صيغة WebP عبر Canvas. في حال تشغيل متصفحات محمولة قديمة جداً لا تدعم WebP، لا يوجد ارتداد تلقائي (Fallback) إلى صيغة JPEG المضغوطة، مما قد يسبب خطأ صامتاً أثناء رفع الصور.
3. **[FINDING-P2-03] نظام التنبيه الاستباقي لسقف استهلاك الرموز اليومي:**
   - يكتفي عميل `yandexGptClient.ts` بقطع الخدمة عند وصول السقف `DAILY_GPT_CALLS_CAP`. يُوصى بإرسال تنبيه وقائي إلى Telegram المالك عند بلوغ نسبة 80% من الحصة اليومية لتفادي التوقف المفاجئ للمشرفين في منتصف أوقات العمل.

---

## 9.4 تقييم الفجوة بين بيئتي الاختبار والإنتاج (Staging vs. Production Drift Audit)

أظهر الفحص المقارن بين بيئة الاختبار المحدثة على Yandex Cloud ومستودع الإنتاج المنشور على النطاق الرسمي `https://domexit.ru` النقاط المحورية التالية:

```
                      ┌─────────────────────────────────┐
                      │    مقارنة الفجوة المعمارية       │
                      │     Staging vs. Production      │
                      └────────────────┬────────────────┘
                                       │
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
┌─────────────────────────────┐             ┌─────────────────────────────┐
│ بيئة الاختبار (Staging)     │             │ بيئة الإنتاج (Production)   │
│ - 24 جدولاً في YDB v2        │             │ - 20 جدولاً أساسياً         │
│ - GSIs مفعلة ومختبرة        │             │ - الترحيل إلى v2 قيد الجدولة│
│ - جميع ميزات AI Lab مبنية   │             │ - ميزات AI مقفلة افتراضياً  │
│ - S3 RAG Vector Index موجود │             │ - كود v2.0.0 المستقر        │
└─────────────────────────────┘             └─────────────────────────────┘
```

### 9.4.1 مقارنة تفصيلية لجرد المكونات السحابية

| المكون السحابي | بيئة الاختبار (Staging) | بيئة الإنتاج الحالية (Prod v2.0.0) | المستهدف في ترقية v3.0.0 |
| :--- | :--- | :--- | :--- |
| **جداول YDB والـ GSIs** | 24 جدولاً مع 14 فهرساً ثانوياً مفعلة بالكامل | 20 جدولاً تقليدياً بدون فهارس ثانوية كاملة | تشغيل `migrate-ydb-v2.mjs` لإنشاء الـ 24 جدولاً والفهارس |
| **دالة API الخادم الرئيسية** | `domexit-api-staging` (Node.js 20 - 512MB) | `domexit-api-prod` (Node.js 20 - 1024MB) | تحديث كود الدالة ليشمل مسارات `/api/ai/*` و`/api/legal-core/v1/*` |
| **عامل الذكاء الاصطناعي السحابي** | `domexit-ai-worker-staging` | غير مفعل بعد | إنشاء `domexit-ai-worker-prod` وربطه بطابور OCR |
| **طوابير الرسائل السحابية YMQ**| `domexit-staging-ocr-queue` | غير مفعل بعد | إنشاء `domexit-prod-ocr-queue` وتعيين Dead-Letter Queue |
| **فهرس RAG المتجهي في S3** | `_ai_rag/knowledge_index.json.gz` موجود | غير موجود بعد | تشغيل سكربت `test-concierge-rag.mjs` لرفع الفهرس المبدئي |
| **مفاتيح AI Lab الافتراضية** | `owner_only` أو `staff_only` للاختبار | مقفلة تماماً `off` | إطلاقها بوضع `owner_only` ثم فتحها تدريجياً للجمهور |

### 9.4.2 قائمة الفحوصات العشرة الإلزامية قبل الترقية الإنتاجية (Pre-Flight Checklist)

1. [ ] التأكد من تشغيل النسخ الاحتياطي اليدوي التام لقاعدة بيانات الإنتاج الحالية وتأكيده في S3: `backups/pre-cutover-*.json.gz`.
2. [ ] تشغيل سكربت `infrastructure/scripts/migrate-ydb-v2.mjs --confirm-prod` للتحقق من اكتمال إنشاء الـ 24 جدولاً والـ 14 مؤشراً ثانوياً عالمياً.
3. [ ] التأكد من تمرير متغيرات البيئة السرية الخاصة بـ Yandex Cloud AI (`YC_FOLDER_ID`, `YC_AI_IAM_TOKEN`).
4. [ ] التحقق من أن مفتاح `AI_LAB_MASTER_SWITCH` مضبوط على `true`، ولكن جميع المفاتيح الفرعية في `ai_feature_flags` مضبوطة على `owner_only`.
5. [ ] التأكد من ضبط سقف استدعاء الذكاء الاصطناعي اليومي `DAILY_GPT_CALLS_CAP=200` في الإنتاج كحاجز حماية FinOps.
6. [ ] فحص صلاحية نطاق البريد الرسمي للرسائل التلقائية عبر Yandex Postbox وتأكيد سجلات DKIM وSPF وDMARC.
7. [ ] التأكد من حظر مسار `cleaner.dadata.ru` نهائياً واستخدام `suggestions.dadata.ru` الحصري المجاني.
8. [ ] تشغيل سكربت فحص سلامة نقاط النهاية المرجعي `infrastructure/scripts/test-prod-smoke.mjs`.
9. [ ] التحقق من صلاحية خطاف الويب لـ Telegram Bot ومطابقة الترويسة السرية `X-Telegram-Bot-Api-Secret-Token`.
10. [ ] مراجعة سياسات دورة حياة التخزين (S3 Lifecycle Rules) في الدلاء الستة لمنع تراكم الملفات المؤقتة.

---

## 9.5 خريطة التحديثات المستقبلية ذات العائد الاستثماري الأعلى (High-ROI Upgrades Roadmap)

بعد استقرار الإصدار v3.0.0 في بيئة الإنتاج، تم تحديد 10 تحسينات تقنية وتجارية استراتيجية ذات عائد استثماري مباشر لرفع كفاءة المنصة وتوسيع هوامش الربحية:

```
                                ┌───────────────────────────┐
                                │   High-ROI 10 Upgrades    │
                                └─────────────┬─────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
┌──────────────────┐                ┌──────────────────┐                 ┌──────────────────┐
│  التحسينات       │                │  الأداء          │                 │  القانون والامتثال│
│  التجارية        │                │  والبنية         │                 │  والأتمتة        │
└────────┬─────────┘                └────────┬─────────┘                 └────────┬─────────┘
         │                                   │                                    │
         ├─ 1. تسويق legal-core كـ SaaS      ├─ 2. Yandex Valkey (Redis) كاش     ├─ 6. SpeechKit للمشرفين
         ├─ 8. ربط Rosreestr المباشر        ├─ 3. Yandex Cloud CDN للوسائط      ├─ 7. AVM v2 بالتعلم الآلي
         └─ 9. أتمتة حسابات الضمان البنكي   └─ 5. WebSockets للمطابقة اللحظية    └─ 4. دخول موحد بـ Telegram
```

1. **تحويل النواة القانونية `legal-core v1` إلى منتج B2B LegalTech SaaS مستقل:**
   - استثمار العزل المعماري الحالي لخدمات تدقيق ДДУ، ومذكرات الإفلاس 61.2 127-ФЗ، وفحص الأطراف KYC، ورادار التشريعات لتقديمها كواجهة اشتراكات سحابية مدفوعة لمكاتب المحاماة الروسية والوكالات العقارية، مما يفتح مسار دخل جديد تماماً للمشروع دون أي تكلفة تطوير إضافية.
2. **استبدال الذاكرة المحلية المؤقتة بـ Yandex Managed Valkey / Redis:**
   - توفير طبقة تخزين مؤقت وموزعة بين كافة دوال Serverless السحابية لمزامنة عدادات الاستخدام اللحظية وحماية الـ Rate Limiting وإلغاء تكرار رسائل Telegram على مستوى النظام بالكامل بدلاً من مصفوفة الذاكرة المحلية.
3. **تفعيل شبكة توزيع المحتوى العالمية (Yandex Cloud CDN):**
   - توزيع صور الواجهة وكتالوج الفرص الاستثمارية عبر خوادم الحافة (Edge Servers) في مختلف المدن الروسية، مما يقلص زمن تحميل صور الشقق من 1.2 ثانية إلى أقل من 150 مللي ثانية، ويوفر من تكاليف نقل بيانات S3 الخارجة.
4. **تأكيد الهوية المزدوج عبر Telegram Login Widget بدلاً من الرسائل النصية المكلفة:**
   - اعتماد تسجيل الدخول المباشر بنقرة واحدة عبر حساب Telegram الموثق، مما يرفع معدلات التحويل للزوار الجدد ويخفض تكاليف إرسال رسائل SMS إلى صفر روبل.
5. **التحديث اللحظي للغرف ومطابقة العروض عبر WebSockets / Server-Sent Events:**
   - استبدال آلية الاستطلاع الدوري (SWR Polling) بتدفق لحظي مباشر للرسائل وعروض الشراء في غرف الإغلاق وغرف المحادثات، مما يلغي مئات آلاف طلبات الـ HTTP غير الضرورية شهرياً.
6. **تحويل الملاحظات الصوتية إلى نصوص عبر Yandex SpeechKit:**
   - تمكين المشرفين والمحامين من تسجيل تقارير المعاينة والتدقيق القانوني صوتياً عبر تطبيق Telegram أثناء وجودهم الميداني في مواقع الإنشاء، وتحويلها آلياً إلى نصوص وتغذيتها في بطاقة اللوت.
7. **محرك التقييم العقاري المتقدم AVM v2 بنماذج التعلم الآلي المعززة (CatBoost):**
   - بعد تجميع آلاف الصفقات المغلقة، تدريب نموذج انحدار شجري فائق الدقة باستخدام مكتبة Yandex CatBoost المحلية لتقدير السعر العادل للتنازل بناءً على 40 معياراً تفصيلياً مع الحفاظ على شفافية معادلة الشرح.
8. **الربط الإلكتروني المباشر مع بوابة التسجيل العقاري الحكومي (Росреестр):**
   - أتمتة إيداع عقود التنازل الرقمية الموقعة بـ ПЭП مباشرة في البوابة الفيدرالية للتوثيق العقاري دون الحاجة للمراجعة اليدوية لمراكز الخدمات الحكومية (МФЦ).
9. **التكامل المصرفي المباشر لفتح حسابات الضمان بضغطة زر (API Escrow Gateway):**
   - الربط المباشر مع واجهات كبرى البنوك الروسية الحاضنة لحسابات الإسكرو (Сбербанк, ВТБ, ДОМ.РФ) لتوليد أرقام حسابات الإيداع والاستعلام اللحظي عن تمام التوريد النقدي.
10. **لوحة تحليلات المستثمر المتطورة (Secondary Market IRR Portfolio Tracker):**
    - توفير واجهة مخصصة لكبار المستثمرين العقاريين لحساب معدل العائد الداخلي السنوي (IRR)، وتتبع توزيعات الأرباح المتوقعة عند إعادة بيع عقود التنازل قبل تسليم المفاتيح.
