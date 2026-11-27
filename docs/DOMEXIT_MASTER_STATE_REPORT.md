# التقرير المرجعي الشامل لحالة منصة DomExit (Master State Report — `v3.0.0-ai-ready`)

**تاريخ الإصدار:** 2026-11-27  
**نطاق المراجعة:** الإطلاق الإنتاجي الرسمي الشامل لـ `DomExit v3.0.0-ai-ready` إلى `https://domexit.ru`:
1. النسخ الاحتياطي الاستباقي الكامل لقاعدة الإنتاج قبل الترحيل (`domexit-backup-prod` -> `domexit-private-docs-prod/_backups/ydb/daily/backup-2026-11-27-0720.json.gz`).
2. ترحيل قاعدة بيانات الإنتاج الرسمية `etnckg937628mnid7tnb` إلى معمارية `YDB v2` المفهرسة بـ `Global Secondary Indexes (GSIs)` لـ 24 جدولاً مع الحفاظ التام بنسبة 100% على كافة جداول `v1` كشبكة أمان دون حذف أي سجل.
3. تدشين خط المعالجة غير المتزامن للذكاء الاصطناعي السيادي: طوابير `YMQ` الإنتاجية (`domexit-ai-ocr-prod` و`domexit-ai-ocr-prod-dlq`) ودالة العامل الخلفية `domexit-ai-worker-prod` وتريغر الرسائل `domexit-ai-ocr-prod-trigger`.
4. نشر دالة الخادم الرئيسية `domexit-api-prod` (مع تفعيل `YDB_USE_V2_TABLES=true` وربط YMQ) ودالة الفحص الآلي `domexit-sla-sweeper-prod` وتحديث مواصفة بوابة التطبيقات `apigw-prod.yaml` مع مسار `/sitemap.xml` التفاعلي.
5. بناء ونشر الواجهة الأمامية إلى `domexit-web-prod` مع التقليم الآلي للأصول واجتياز الفحص الأمني بنسبة 0 تسريبات.
6. قفل جميع ميزات `AI Lab` الـ 11 افتراضياً على `owner_only` / `off` لضمان أقصى سرعة وثبات وتوافق مع `152-ФЗ`.
7. اجتياز 12 اختبار تحقق وقراءة فقط حي على `https://domexit.ru` بنسبة نجاح 100% (12/12).

---

## 1. الملخص التنفيذي ومصفوفة البيئات السحابية (`Yandex Cloud ru-central1` — Folder: `b1g46uad3gc3h34k5b0f`)

### 1.1 حالة المستودع وGit
- **الفرع النشط:** `main` | **وسم الإصدار المرجعي:** `v3.0.0-ai-ready`
- **حالة التزامن (`Local = Staging = Production = GitHub`):** متطابق 100%.
- **سجل الالتزامات الـ 11 المرقاة من حزم الذكاء الاصطناعي وترحيل YDB v2:**
  - `09c022d` — `feat(ydb-v2): implement global secondary indexes (GSIs) and v2 table schemas across all 24 domains`
  - `7d7dc27` — `feat(ai-lab-core): establish sovereign ru-central1 proptech ai lab module with owner rbac and dadata/cbr integrations`
  - `c1e1945` — `feat(agent-bridge): add external agent research bridge, 152-FZ gateway, and market benchmarks table`
  - `6bfa099` — `feat(ocr-pipeline): add yandex vision ocr async engine with ymq queue and background worker`
  - `ebcf2db` — `feat(legal-copilot): add yandexgpt ddu contract risk audit and buyer solvency scoring`
  - `cb15f79` — `feat(proptech-avm): sync open data from eiszh and add automated valuation model (avm v1)`
  - `4d35c24` — `feat(packaging-studio): add ai packaging studio with vision watermarking detection, metro enrichment and yandexgpt copywriter`
  - `ffc0086` — `feat(legislative-radar): add russian legal radar monitor with yandexgpt lite triage and dual-output compliance alerts`
  - `5c2929e` — `feat(journal-seo): build domexit journal (/journal), dynamic sitemap, rss, ymyl quality gate, and telegram publishing`
  - `f015b65` — `feat(ai-concierge): sovereign zero-cost s3 vector rag concierge with yandexgpt embeddings and interactive buy-box`
  - `08c8b99` — `feat(legal-core): add 1-click rbac kyc/kyb adapter, zero-pii datalens export, and isolated legal-core facade with openapi spec`

---

### 1.2 مصفوفة مقارنة البيئات السحابية (`ru-central1`)

| العنصر | بيئة الاختبار (`Staging`) | بيئة الإنتاج الرسمية (`Production`) |
|---|---|---|
| **النطاق / API Gateway** | `https://d5dpccovifu701p9lvga.bu9mdbe1.apigw.yandexcloud.net` | `https://domexit.ru` (`d5dsuuhvetioe2hp0q7i`) |
| **دالة الخادم (`API`)** | `domexit-api-staging` (`d4ep633b03be8trc7d28`) | `domexit-api-prod` (`d4eouspb2d0s8dfguf1h`) — الإصدار **`d4eeplnoj8m2mi1gkegr`** (`256m`, `nodejs22`, `ACTIVE`) |
| **دالة العامل الخلفي (`AI Worker`)** | `domexit-ai-worker-staging` (`d4e731k05cblu6n8q42l`) | `domexit-ai-worker-prod` (`d4e26vvks8t21bvq758d`) — الإصدار **`d4e3jtdepm0odhcmv8m7`** (`512m`, `180s`, `ACTIVE`) |
| **دالة المراقبة (`SLA Sweeper`)** | عبر نقطة نهاية يدوية / اختبارية | `domexit-sla-sweeper-prod` (`d4eag6buonjeslfpan73`) — الإصدار **`d4e82t1nfn1s9685qbqr`** (`256m`, `ACTIVE`) |
| **تريغر SLA Cron** | غير مجدول تلقائياً | `a1sbuqn63f9cmamjeqp7` (`0/15 * * * ? *` — كل 15 دقيقة UTC) |
| **طوابير الرسائل (`YMQ`)** | `domexit-ai-ocr-staging` + `domexit-ai-ocr-staging-dlq` | `domexit-ai-ocr-prod` + `domexit-ai-ocr-prod-dlq` |
| **تريغر طابور YMQ** | `a1sgve2u7p81u2b24s4l` | `a1si4drl86642t2cfmch` (`domexit-ai-ocr-prod-trigger`) |
| **دالة النسخ الاحتياطي** | يدوي / عبر لوحة الإدارة | `domexit-backup-prod` (`d4edb2l5n6gcpfbnl3b0`) — أحدث نسخة: `_backups/ydb/daily/backup-2026-11-27-0720.json.gz` (`23,651` بايت) |
| **تريغر النسخ الاحتياطي** | غير مجدول | `a1sqlo5a1el40u9tmqdn` (`0 2 * * ? *` — يومياً 02:00 UTC) |
| **قاعدة بيانات `YDB`** | `etnkpeqnbmb1a6cocipk` (`YDB v2` مفهرسة بالكامل) | `etnckg937628mnid7tnb` (`YDB v2` مفهرسة بـ 24 جدولاً + 12 جدول `v1` كشبكة أمان) |
| **دلو الويب الثابت (`S3`)** | `domexit-web-staging` | `domexit-web-prod` (`233` ملفاً — `3.46 MB` بعد التقليم الأمني الشامل) |
| **دلو الصور العامة (`S3 Public`)** | `domexit-public-photos-staging` (`read: true`) | `domexit-storage-vault` (`read: true`, `list: false`, CORS يشمل `domexit.ru`) |
| **دلو الوثائق الخاصة (`S3 Private`)** | `domexit-private-docs-staging` (`read: false`) | `domexit-private-docs-prod` (`read: false`, `list: false`, امتثال صارم لـ 152-ФЗ) |
| **وضع ميزات الذكاء الاصطناعي (`AI Lab`)** | مفعّلة للاختبار التدريجي | **مقفلة 100% افتراضياً (`owner_only` / `off`) للجمهور** |
| **حالة المنصة العامة** | جاهزة ومطابقة | **مباشرة وسريعة ومستقرة 100% على https://domexit.ru** |

---

## 2. نتائج الفحص الحي الإنتاجي (12 Production Smoke Tests)

تم تنفيذ الاختبارات الإثني عشر الحية عبر طلبات قراءة فقط (`Read-Only`) ضد النطاق الرسمي `https://domexit.ru`:

| # | اسم الاختبار والهدف | المسار والطريقة | الحالة المتوقعة | النتيجة الحية | زمن الاستجابة | الحالة |
| :-: | :--- | :--- | :-: | :-: | :-: | :---: |
| **1** | التحقق من صحة الخادم والبيئة | `GET /api/health` | `200 OK`, `ok: true`, `env: production` | `200 OK` (`ok=true, env=production, region=ru-central1`) | 240ms | ✅ PASS |
| **2** | فحص كتالوج العقارات على جداول `YDB v2` | `GET /api/data/lots` | `200 OK`, `items: []` | `200 OK` (`isArray=true, itemsCount=0`) | 64ms | ✅ PASS |
| **3** | تطابق بيانات المطورين المعتمدين (15 مطوراً) | `GET /api/data/developers` | `200 OK`, `15 items`, `testDevPresent: false` | `200 OK` (`developersCount=15, testDevPresent=false`) | 82ms | ✅ PASS |
| **4** | قراءة إعدادات السوق وفائدة البنك المركزي | `GET /api/data/market_settings` | `200 OK`, `cbrKeyRatePercent: 23%` | `200 OK` (`cbrKeyRate=23%, buyerCommission=2.5%`) | 57ms | ✅ PASS |
| **5** | أمان وضبط الوضع الافتراضي لـ `AI Lab` | `GET /api/ai/config` | `200 OK`, `masterLabEnabled: false`, all locked | `200 OK` (`masterLabEnabled=false, all11FeaturesLocked=true`) | 143ms | ✅ PASS |
| **6** | خريطة الموقع التفاعلية الديناميكية لـ Yandex SEO | `GET /sitemap.xml` | `200 OK`, XML `urlset` schema | `200 OK` (`isSitemapXml=true, length=903 bytes`) | 136ms | ✅ PASS |
| **7** | بوابة حماية المجلة (قفل النشر العام افتراضياً) | `GET /api/public/journal` | `403 Forbidden`, `JOURNAL_NOT_PUBLIC_YET` | `403 Forbidden` (`JOURNAL_NOT_PUBLIC_YET`) | 77ms | ✅ PASS |
| **8** | بوابة حماية موجز الأخبار RSS | `GET /api/public/rss.xml` | `403 Forbidden`, `JOURNAL_NOT_PUBLIC_YET` | `403 Forbidden` (`JOURNAL_NOT_PUBLIC_YET`) | 136ms | ✅ PASS |
| **9** | بوابة حماية الكونسيرج الذكي للزوار | `POST /api/public/ai/concierge/chat` | `403 Forbidden` (بسبب `owner_only`) | `403 Forbidden` (محمي كما هو مطلوب) | 82ms | ✅ PASS |
| **10** | تأمين Webhook جسر الوكلاء الخارجيين | `POST /api/public/ai/agent-bridge/webhook` | `403 Forbidden` (غير مصرح) | `403 Forbidden` (محمي تماماً) | 83ms | ✅ PASS |
| **11** | فحص الواجهة الأمامية والصفحة الرئيسية | `GET /` | `200 OK`, HTML مع `<div id="root">` | `200 OK` (`hasRoot=true, length=4159 bytes`) | 267ms | ✅ PASS |
| **12** | التوجيه الداخلي الأحادي (SPA Fallback) | `GET /journal` | `200 OK`, HTML مع `<div id="root">` | `200 OK` (`isSpaHtml=true, length=4159 bytes`) | 169ms | ✅ PASS |

**المحصلة الإجمالية:** **12 من 12 اختباراً ناجحة بنسبة 100%**.

---

## 3. وضع جداول YDB v2 وتأمين البيانات

1. **جداول الإنتاج النشطة (`*_v2`):**
   - تعمل المنصة الإنتاجية رسمياً الآن عبر المتغير `YDB_USE_V2_TABLES=true`.
   - تم إنشاء وتفعيل جميع الفهارس الثانوية العالمية (`GSIs`) لـ 24 جدولاً (تغطي المستخدمين، اللوتات، الصفقات، طلبات الملاءة، تدقيق العقود، مسودات المجلة، فهارس البحث، إلخ).
   - تم ترحيل بيانات الحسابات والمطورين بنسبة 100% تطابق ودون أي فقدان للبيانات.
2. **شبكة الأمان (`Rollback Net`):**
   - تم الإبقاء على كافة جداول `v1` الـ 12 دون حذف أي جدول أو سجل منها.
   - في حال الرغبة في التراجع اللحظي (Rollback)، يكفي ضبط المتغير `YDB_USE_V2_TABLES=false` وإعادة نشر دالة الإنتاج، لتعود المنصة للعمل على جداول `v1` فوراً.
   - يُنصح بالإبقاء على جداول `v1` لمدة تتراوح بين 14 و30 يوماً قبل أرشفتها أو حذفها.

---

## 4. إرشادات التحكم الإداري المستقبلي بميزات الذكاء الاصطناعي (`AI Lab`)

كافة ميزات الذكاء الاصطناعي مهيأة ومقفلة افتراضياً لضمان عدم استهلاك أي موارد دون رغبة المالك:
- لفتح أي ميزة (مثل المجلة العامة، الكونسيرج الذكي، التدقيق التلقائي للعقود، رادار التشريعات، إلخ)، ادخل إلى لوحة التحكم الإدارية عبر:
  `https://domexit.ru/admin/ai-lab`
- يمكنك ترقية وضع أي ميزة من `owner_only` إلى `employees` أو `public` بضغطة زر وحفظ الإعدادات لحظياً دون الحاجة لإعادة نشر الكود.
