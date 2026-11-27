# الفصل الثاني: البنية التحتية السحابية، أمان التخزين وهندسة التكاليف والتوسع (FinOps & Scaling)

> **النسخة المرجعية:** `v3.0.0-ai-ready` | **البيئة السحابية:** Yandex Cloud (`ru-central1`)  
> **مجلد الموارد السحابية:** `b1g46uad3gc3h34k5b0f` | **الحساب السحابي:** `b1gbu0q3jqnheri2srsu`

---

## 1. جرد كامل للبنية السحابية في Yandex Cloud (`Cloud Infrastructure Inventory`)

تعتمد منصة DomExit معمارية سحابية سيادية كاملة تعمل بدون خوادم تقليدية (**100% Serverless Architecture**) داخل المنطقة الجغرافية الروسية **`ru-central1`** في مراكز بيانات `Yandex Cloud`. 

تتوزع موارد المنصة عبر بيئتين معزولتين تماماً: بيئة الاختبار والتحقق قبل النشر (**`Staging`**) وبيئة التشغيل والإنتاج الرسمي المباشر (**`Production`**). يضمن هذا العزل عدم تأثر صفقات الإنتاج الحية بأي تجارب تطويرية.

### 1.1 جدول مقارنة الموارد السحابية بين بيئتي الإنتاج والاختبار

| نوع المورد السحابي (`Resource Type`) | بيئة الإنتاج الرسمي (`Production`) | بيئة الاختبار والتأهيل (`Staging`) | الغرض الوظيفي والمعايير التشغيلية الدقيقة |
|:---|:---|:---|:---|
| **بوابة التطبيقات (`API Gateway`)** | `domexit-gw-prod`<br>المعرف: `d5dsuuhvetioe2hp0q7i` | `domexit-gw-staging`<br>المعرف: `d5dpccovifu701p9lvga` | نقطة الدخول الموحدة للإنترنت، توجيه المسارات، توزيع الأصول، وخدمة الـ SPA. |
| **النطاق العام المربوط (`Domain`)** | `https://domexit.ru` | `https://d5dpccovifu701p9lvga.bu9mdbe1.apigw.yandexcloud.net` | النطاق الرسمي المسجل مع شهادة SSL مجانية عبر Certificate Manager. |
| **دالة الخادم الرئيسية (`API Function`)** | `domexit-api-prod` (`d4eouspb2d0s8dfguf1h`)<br>الإصدار النشط: **`d4eeplnoj8m2mi1gkegr`** | `domexit-api-staging` (`d4ep633b03be8trc7d28`)<br>الإصدار النشط: **`d4en6uo2m203nbsgu8a3`** | `Node.js 22`، ذاكرة `256MB`، مهلة `30s`، نقطة الدخول `index.handler`. معالجة كافة طلبات المنطق التجاري وحساب التقييمات. |
| **دالة العامل الخلفي (`AI Worker Function`)** | `domexit-ai-worker-prod` (`d4e26vvks8t21bvq758d`)<br>الإصدار النشط: **`d4e3jtdepm0odhcmv8m7`** | `domexit-ai-worker-staging` (`d4e731k05cblu6n8q42l`) | `Node.js 22`، ذاكرة `512MB`، مهلة `180s`، نقطة الدخول `ai-worker.handler`. معالجة مهام YMQ وVision OCR غير المتزامنة. |
| **دالة مراقبة المهام (`SLA Sweeper Function`)** | `domexit-sla-sweeper-prod` (`d4eag6buonjeslfpan73`)<br>الإصدار النشط: **`d4e82t1nfn1s9685qbqr`** | تشغيل يدوي عبر نقطة النهاية `/api/matching/run-sla-sweep` | `Node.js 22`، ذاكرة `256MB`، مهلة `120s`، نقطة الدخول `sweeper.handler`. فحص مهل المعاينات والـ SLA وإسقاط الصفقات كل 15 دقيقة. |
| **مشغل المراقبة الزمني (`SLA Timer Trigger`)** | `domexit-sla-sweeper-trigger`<br>المعرف: `a1sbuqn63f9cmamjeqp7` | غير مجدول | جدول زمني UTC دوري: `0/15 * * * ? *` (كل 15 دقيقة) لاستدعاء دالة المراقبة بحساب الخدمة. |
| **دالة النسخ الاحتياطي (`Backup Function`)** | `domexit-backup-prod` (`d4edb2l5n6gcpfbnl3b0`) | تشغيل عند الطلب من لوحة الإدارة | `Node.js 22`، ذاكرة `256MB`، مهلة `180s`، نقطة الدخول `backup.handler`. تفريغ جداول YDB الـ 24 وضغطها في S3. |
| **مشغل النسخ الاحتياطي (`Backup Timer Trigger`)** | `domexit-backup-daily-trigger`<br>المعرف: `a1sqlo5a1el40u9tmqdn` | غير مجدول | جدول زمني يومي: `0 2 * * ? *` (الساعة 02:00 UTC يومياً) لأخذ لقطة كاملة وتخزينها في `_backups/`. |
| **طابور الرسائل الرئيسي (`YMQ Main Queue`)** | `domexit-ai-ocr-prod`<br>المعرف: `dj6000000161lpjf04o2` | `domexit-ai-ocr-staging`<br>المعرف: `dj6000000161578o04o2` | طابور رسائل قياسي لاستقبال مهام قراءة وتدقيق مستندات `ДДУ` و`ЕГРН` مع حجب الرؤية 180 ثانية. |
| **طابور الرسائل المتعثرة (`YMQ DLQ`)** | `domexit-ai-ocr-prod-dlq`<br>المعرف: `dj6000000161lpi204o2` | `domexit-ai-ocr-staging-dlq`<br>المعرف: `dj6000000161574g04o2` | عزل الرسائل المتعثرة تلقائياً بعد 3 محاولات فاشلة (`maxReceiveCount: 3`) لمنع تكرار الاستدعاء واستنزاف الرصيد. |
| **مشغل طابور الرسائل (`YMQ Trigger`)** | `domexit-ai-ocr-prod-trigger`<br>المعرف: `a1si4drl86642t2cfmch` | `domexit-ai-ocr-staging-trigger`<br>المعرف: `a1s45g3s1tjj6ashfdjh` | استدعاء دالة `domexit-ai-worker-*` بحزمة فردية (`batchSize: 1`) فور وصول رسالة جديدة للطابور. |
| **قاعدة بيانات `YDB Document API`** | `etnckg937628mnid7tnb`<br>(قاعدة الإنتاج الرسمية) | `etnkpeqnbmb1a6cocipk`<br>(قاعدة الاختبار والتأهيل) | معمارية Serverless بلا خوادم، 24 جدولاً مفهرساً بـ `GSIs` + 12 جدول `v1` في الإنتاج كشبكة أمان للرجوع اللحظي. |
| **دلو الواجهة الثابتة (`S3 Web Bucket`)** | `domexit-web-prod`<br>المعرف: `e3ee0fvjrlrqk90lhisk` | `domexit-web-staging`<br>المعرف: `e3emnvf6sqq64u08u383` | كائنات SPA المجمعة، ملفات JS/CSS المضغوطة بـ Gzip وBrotli مع تقليم آلي للأصول القديمة. |
| **دلو الصور العامة (`S3 Public Photos`)** | `domexit-storage-vault`<br>المعرف: `e3eu2590sfc7ns5pl81u` | `domexit-public-photos-staging`<br>المعرف: `e3eu7144e782g68e9r7s` | صور العقارات والمخططات، متاح للقراءة العامة (`read: true, list: false`) مع سياسات CORS وتوليد مصغرات WebP. |
| **دلو الوثائق الخاصة (`S3 Private Vault`)** | `domexit-private-docs-prod`<br>المعرف: `e3ekefg6qiu4q8vfr2e3` | `domexit-private-docs-staging`<br>المعرف: `e3eh7v7k67b37fsqh23c` | وثائق `152-ФЗ` المشفرة، كشوف الحسابات، النسخ الاحتياطية، ونصوص OCR وفهارس RAG (روابط Presigned فقط). |

---

### 1.2 حسابات الخدمة وصلاحيات الهوية والوصول (`IAM Roles & Service Accounts`)
تعتمد المنصة مبدأ **«أقل الصلاحيات الضرورية» (`Principle of Least Privilege`)** مع وجود حسابي خدمة محددين بدقة:

#### أ. حساب التشغيل الرئيسي (`domexit-runtime-sa` — المعرّف: `aje70eogmpm04c84rsnl`):
هو الحساب المسؤول عن تشغيل كافة دوال الخادم، إدارة التخزين السحابي، استدعاء الذكاء الاصطناعي، والتعامل مع الطوابير. يتم تعيين الأدوار الخمسة التالية له على مستوى المجلد `b1g46uad3gc3h34k5b0f`:
1. **`ai.vision.user`:** يتيح استدعاء واجهات `Yandex Vision OCR API` للتعرف الضوئي على المستندات واستخراج النصوص والبيانات المحاسبية.
2. **`ai.languageModels.user`:** يتيح استدعاء نماذج `YandexGPT Pro` و`YandexGPT Lite` ونموذج التضمين الشعاعي `YandexGPT Embeddings`.
3. **`ymq.admin`:** يتيح إنشاء وتعديل طوابير `YMQ`، وإرسال واستقبال وحذف الرسائل من الطابورين الرئيسي والمتعثر.
4. **`storage.editor`:** يتيح القراءة والكتابة والرفع وتوليد روابط Presigned URLs المشفرة على مستوى دلاء التخزين الستة في S3.
5. **`serverless.functions.invoker`:** يتيح لبوابة `API Gateway` وتريغرات `Cron / YMQ` استدعاء دوال الخادم بتوثيق سحابي داخلي مشفر.

#### ب. حساب خدمة البريد الإلكتروني (`domexit-postbox-sa` — المعرّف: `ajefccvsjg8fnkpgj5ed`):
مخصص حصرياً للتعامل مع خادم البريد السحابي `Yandex Cloud Postbox` عبر منفذ `SMTP 465` لإرسال رسائل التحقق وتنبيهات الصفقات ورموز `OTP` الخاصة بالتوقيع الإلكتروني.

---

## 2. هندسة بوابة التطبيقات ونظام أسماء النطاقات والشهادات (`API Gateway, DNS & SSL`)

### 2.1 تحليل المسارات السحابية في مواصفة `apigw-prod.yaml`
تتولى بوابة `Yandex API Gateway` (`domexit-gw-prod`) إدارة حركة الدخول بالكامل، حيث تفصل بين خدمة الملفات الثابتة عبر التخزين السحابي وخدمة المسارات الديناميكية عبر دوال الخادم دون المرور بأي خادم ويب وسيط مثل Nginx أو Apache:

```yaml
openapi: 3.0.0
info:
  title: DomExit API Gateway Production
  version: 1.0.0
paths:
  # 1. فحص صحة الخادم السحابي
  /api/health:
    get:
      summary: Health check
      operationId: healthCheck
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: d4eouspb2d0s8dfguf1h
        service_account_id: aje70eogmpm04c84rsnl

  # 2. توجيه كافة مسارات الخادم الديناميكية
  /api/{proxy+}:
    x-yc-apigateway-any-method:
      summary: Backend API Router
      operationId: apiRouter
      parameters:
        - name: proxy
          in: path
          required: false
          schema:
            type: string
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: d4eouspb2d0s8dfguf1h
        service_account_id: aje70eogmpm04c84rsnl

  # 3. خدمة الأصول الثابتة المقسمة والمحزومة بـ Vite مع كاش طويل الأمد
  /assets/{file+}:
    get:
      summary: Static assets
      operationId: staticAssets
      parameters:
        - name: file
          in: path
          required: true
          schema:
            type: string
      x-yc-apigateway-integration:
        type: object_storage
        bucket: domexit-web-prod
        object: assets/{file}
        service_account_id: aje70eogmpm04c84rsnl

  # 4. الصفحة الرئيسية للتطبيق
  /:
    get:
      summary: Root Web Page
      operationId: rootPage
      x-yc-apigateway-integration:
        type: object_storage
        bucket: domexit-web-prod
        object: index.html
        service_account_id: aje70eogmpm04c84rsnl

  # 5. خريطة الموقع التفاعلية الديناميكية لـ Yandex SEO
  /sitemap.xml:
    get:
      summary: Dynamic Sitemap
      operationId: dynamicSitemap
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: d4eouspb2d0s8dfguf1h
        service_account_id: aje70eogmpm04c84rsnl

  # 6. التوجيه الداخلي الأحادي لـ React Router (SPA Fallback)
  /{file+}:
    get:
      summary: Web Static SPA Fallback
      operationId: webStatic
      parameters:
        - name: file
          in: path
          required: false
          schema:
            type: string
      x-yc-apigateway-integration:
        type: object_storage
        bucket: domexit-web-prod
        object: '{file}'
        error_object: index.html
        service_account_id: aje70eogmpm04c84rsnl
```

#### تحليل الآلية الهندسية لخدمة الواجهة (`SPA Routing Logic`):
- عند طلب المستخدم لأي مسار فرعي (مثل `https://domexit.ru/journal` أو `https://domexit.ru/opportunities`):
  تبحث البوابة أولاً عن ملف يطابق الاسم داخل الدلو `domexit-web-prod`؛ وإذا لم تجد ملفاً فيزيائياً يطابق المسار (لأن الصفحات مسارات وهمية مدارة بواسطة `react-router-dom`)، تُفعل البوابة خاصية **`error_object: index.html`** فتعيد صفحة البداية مع رمز الاستجابة `200 OK`، ليقوم كود الجافاسكربت في المتصفح بقراءة المسار وعرض الصفحة المطلوبة دون أي وميض أو خطأ `404`.

---

### 2.2 سجلات النطاق وشهادات الأمان وخدمة البريد (`Cloud DNS, SSL & Postbox`)

1. **نظام أسماء النطاقات السحابي (`Cloud DNS`):**
   - **المنطقة السحابية:** `domexit-ru-zone` (`dnsdb9agcsdq3fn2n87q`) لنطاق `domexit.ru`.
   - **خوادم الأسماء الموثوقة:** `ns1.yandexcloud.net.` و`ns2.yandexcloud.net.`.
2. **شهادة التشفير وإدارتها آلياً (`Certificate Manager`):**
   - **معرف الشهادة:** `fpqivftt1kmksg779uab` (`domexit-ru-cert`) بحالة **`ISSUED`**.
   - **التجديد الآلي (`Automated ACME DNS-01 Challenge`):** تم ضبط سجلين من نوع `CNAME` لتجديد شهادة `Let's Encrypt` تلقائياً دون أي تدخل يدوي:
     - `_acme-challenge.domexit.ru.` -> `fpqivftt1kmksg779uab.cm.yandexcloud.net.`
     - `_acme-challenge.www.domexit.ru.` -> `fpqivftt1kmksg779uab.cm.yandexcloud.net.`
3. **منظومة البريد السحابي الموثوق (`Yandex Cloud Postbox`):**
   - **عنوان الإرسال الرسمي:** `no-reply@domexit.ru`.
   - **خادم النقل:** `postbox.cloud.yandex.net` عبر منفذ التشفير الآمن **`465 (SMTPS)`**.
   - **سجل إثبات الهوية ومكافحة الانتحال (`SPF Record`):**
     `v=spf1 include:_spf.postbox.cloud.yandex.net ~all`
   - **سجل سياسة التقارير والعزل (`DMARC Record`):**
     `v=DMARC1; p=quarantine; rua=mailto:postmaster@domexit.ru`
   - **سجلات التوقيع المشفر للمجال (`DKIM CNAMEs`):**
     - `egtdvfr0l58otcmiol03-1._domainkey.domexit.ru.` -> `egtdvfr0l58otcmiol03-1.dkim.pstbx.ru.`
     - `egtdvfr0l58otcmiol03-2._domainkey.domexit.ru.` -> `egtdvfr0l58otcmiol03-2.dkim.pstbx.ru.`
4. **عناوين إعادة التوجيه لتوثيق الهوية (`Yandex OAuth Redirect URIs`):**
   - الإنتاج: `https://domexit.ru/api/auth/yandex/callback`
   - الاختبار: `https://d5dpccovifu701p9lvga.bu9mdbe1.apigw.yandexcloud.net/api/auth/yandex/callback`

---

## 3. هندسة كائنات التخزين السحابية الستة (`Object Storage S3 Architecture`)

تمتلك المنصة 6 دلاء تخزين موزعة بدقة (3 للإنتاج و3 للاختبار)، وتخضع لسياسات أمنية ورقابية وفترات احتفاظ بالبيانات (`Data Lifecycle`) صارمة لمنع تسريب الوثائق ولخفض تكاليف التخزين تلقائياً.

### 3.1 جدول مواصفات دلاء التخزين الستة

| اسم الدلو السحابي | البيئة | الصلاحيات العامة (`Public ACL`) | سياسة `CORS` والوصول | الغرض الوظيفي والمحتويات |
|:---|:---:|:---:|:---|:---|
| **`domexit-web-prod`** | إنتاج | `read: false, list: false` | محمي، متاح عبر بوابة API Gateway | كود الواجهة الأمامية، الأصول، وملفات الـ SPA المحزومة. |
| **`domexit-storage-vault`** | إنتاج | `read: true, list: false` | يسمح بـ `GET, HEAD` من `domexit.ru` | صور اللوتات العامة، مخططات الأدوار، وصور المعاينة. |
| **`domexit-private-docs-prod`** | إنتاج | `read: false, list: false` | مغلق 100% (روابط مشفرة Presigned فقط) | عقود `ДДУ`، جوازات السفر، كشوف الحساب، والنسخ الاحتياطية. |
| **`domexit-web-staging`** | اختبار | `read: false, list: false` | متاح عبر بوابة API Gateway Staging | كود واجهة بيئة الاختبار. |
| **`domexit-public-photos-staging`** | اختبار | `read: true, list: false` | متاح لقراءة الصور في بيئة الاختبار | صور لوتات بيئة الاختبار. |
| **`domexit-private-docs-staging`** | اختبار | `read: false, list: false` | مغلق 100% | وثائق اختبار 152-ФЗ المشفرة لبيئة الاختبار. |

---

### 3.2 البنية الشجرية للمجلدات داخل الدلو الخاص (`S3 Private Vault Directory Topology`)
تُنظم الملفات داخل الدلو المشفر `domexit-private-docs-prod` وفق شجرة مسارات صارمة تعتمد التجزئة الوظيفية:

```
domexit-private-docs-prod/
├── documents/                            # المستندات المرفوعة من البائعين والمشترين
│   └── lot-{lotCode}/                    # مجلد خاص لكل لوت عقاري
│       ├── ddu_contract_{id}.pdf         # عقد المشاركة في البناء الأصلي
│       ├── developer_settlement_{id}.pdf # كشف سداد كامل الثمن للمطور
│       ├── egrn_extract_{id}.pdf         # مستخرج السجل العقاري الرسمي
│       └── passport_{userId}.pdf         # وثائق إثبات الهوية الشخصية
├── _backups/                             # النسخ الاحتياطية الآلية لقواعد بيانات YDB
│   └── ydb/
│       └── daily/                        # النسخ اليومية المضغوطة
│           └── backup-{YYYY-MM-DD-HHmm}.json.gz
├── _journal/                             # السجل المحاسبي والرقابي غير القابل للتعديل
│   └── events-{YYYY-MM}.jsonl.gz         # أرشيف أحداث المنصة وحركات الصفقات
├── _ai_ocr/                              # مخرجات التعرف الضوئي على المستندات
│   └── transcripts/
│       └── job-{ocrJobId}.json.gz        # تفريغ النصوص الكامل لكل صفحة وجداول الديون
├── _ai_rag/                              # الفهرس الشعاعي المعرفي للكونسيرج الذكي
│   └── knowledge_index.json.gz           # مقاطع المعرفة الموثوقة مع متجهات 256 بعداً
├── _kyc_protocols/                       # بروتوكولات التحقق الأمني من الأطراف (KYC)
│   └── checks/
│       └── check-{inn_or_passportHash}.json # تقارير المحاكم والإفلاس والضرائب (كاش 30 يوماً)
└── _analytics/                           # مستودع تحليلات ذكاء الأعمال
    └── datalens/
        └── export-{YYYY-MM-DD}.csv       # بيانات الصفقات والمؤشرات مطهرة بنسبة 100% من PII
```

---

### 3.3 قواعد دورة الحياة وتخفيض التكاليف السحابية (`S3 Lifecycle Policies`)
تُطبق سياسات دورة الحياة آلياً على كائنات التخزين لترحيل البيانات التاريخية إلى وسائط التخزين البارد والأرشيفي لتقليص فاتورة التخزين بنسبة تصل إلى **`70%`**:

```
[رفع الملف (Standard Storage)] ──(بعد 90 يوماً)──> [التخزين البارد (COLD Storage)] ──(بعد 180 يوماً)──> [التخزين الأرشيفي الجليدي (ICE Storage)]
```

1. **النسخ الاحتياطية (`_backups/`):**
   - الانتقال تلقائياً إلى التخزين البارد (**`COLD Storage Class`**) بعد **90 يوماً**.
   - الحذف التلقائي للنسخ القديمة بعد **365 يوماً**.
2. **سجلات الرقابة والتدقيق (`_journal/`):**
   - الانتقال إلى التخزين البارد (**`COLD`**) بعد **90 يوماً**.
   - الانتقال إلى التخزين الأرشيفي شديد البرودة (**`ICE Storage Class`**) بعد **180 يوماً** مع الاحتفاظ بها لمدة 3 سنوات امتثالاً للتقادم القضائي التجاري.
3. **تنظيف عمليات الرفع غير المكتملة (`AbortIncompleteMultipartUpload`):**
   - الحذف التلقائي الإلزامي بعد **7 أيام** لكافة أجزاء الملفات العالقة التي لم يكتمل رفعها عبر كافة الدلاء الستة لمنع تراكم المساحات الميتة غير المرئية.

---

### 3.4 آلية فحص الأمان وتقليم الأصول الثابتة القديمة (`Security Scan & Assets Pruning`)
ينفذ سكربت النشر `deploy-web-prod.cjs` خطوتين أمنيتين وتشغيليتين حاسمتين قبل وأثناء رفع الملفات إلى `domexit-web-prod`:

#### أ. الفحص الأمني التلقائي لمجلد الحزمة (`Post-Build Security Scan`):
يمسح السكربت كافة ملفات `dist/` البرمجية (`.js`, `.html`, `.json`) ضد مصفوفة تعبيرات نمطية صارمة (`FORBIDDEN_PATTERNS`) لمنع تسريب أي أسرار:
```javascript
const FORBIDDEN_PATTERNS = [
  /YCPeO8/i,                             // بادئة مفاتيح الوصول الثابتة
  /docapi\.serverless\.yandexcloud\.net/i,// نقاط النهاية المباشرة لـ YDB
  /JWT_SIGNING_SECRET/i,                 // مفتاح توقيع جلسات JWT
  /service_account_id/i,                 // معرفات الحسابات الخاصة
  /private_key_id/i,                     // مفاتيح التشفير الخاصة
];
```
إذا تطابق أي ملف في الحزمة مع هذه الأنماط، يتوقف النشر فوراً برمز خطأ أمني ويمنع الرفع لسحابة الإنتاج.

#### ب. خوارزمية تقليم الأصول القديمة (`pruneStaleAssets`):
عند كل بناء للواجهة، تتولد أسماء ملفات جديدة برمز تجزئة فريد. لمنع تضخم الدلو السحابي، ينفذ السكربت الخوارزمية التالية:
1. بناء مجموعة مسارات الإصدار الجديد الحالية (`keepSet`).
2. مسح مجلد `assets/` بالكامل عبر `ListObjectsV2Command`.
3. حساب عمر الملف؛ فإذا لم يكن الملف موجوداً في `keepSet` وتجاوز عمره **14 يوماً** (أو **24 ساعة** عند تمرير الراية الإلزامية `--prune-all-stale`)، يُجمع ضمن مصفوفة الحذف.
4. إرسال أمر الحذف المجمع `DeleteObjectsCommand` بحزم تصل إلى 1,000 كائن لكل طلب.

#### ج. جدول تعيين أنواع الوسائط وترويسات الكاش (`MIME Mapping & Cache-Control`):

| امتداد الملف (`Extension`) | نوع الوسائط المعتمد (`Content-Type`) | ترويسة الكاش السحابي (`Cache-Control Header`) |
|:---|:---|:---|
| `.html` | `text/html; charset=utf-8` | `no-cache, no-store, must-revalidate` (تحديث فوري دائماً) |
| `.js`, `.mjs` (داخل `assets/`) | `application/javascript; charset=utf-8` | `public, max-age=31536000, immutable` (سنة كاملة لكاش المتصفح) |
| `.css` (داخل `assets/`) | `text/css; charset=utf-8` | `public, max-age=31536000, immutable` |
| `.json` | `application/json; charset=utf-8` | `public, max-age=86400` (يوم واحد) |
| `.png`, `.jpg`, `.webp`, `.svg` | `image/png`, `image/webp`, `image/svg+xml` | `public, max-age=31536000, immutable` |
| `.woff2`, `.woff`, `.ttf` | `font/woff2`, `font/woff`, `font/ttf` | `public, max-age=31536000, immutable` |
| `sitemap.xml`, `robots.txt` | `application/xml`, `text/plain` | `no-cache, no-store, must-revalidate` |

---

## 4. هندسة طوابير الرسائل والمعالجة غير المتزامنة (`YMQ & AI Worker Architecture`)

تعتمد معالجة وفحص مستندات `ДДУ` الثقيلة (التي قد تصل إلى 30 صفحة) على خط معالجة غير متزامن (**`Asynchronous Decoupled Pipeline`**) يعزل زمن استجابة المتصفح عن عمليات الذكاء الاصطناعي ويحمي الميزانية من الانهيار:

```
[المتصفح/العميل]
       │
       ▼ (1. رفع المستند وإرسال المعرف)
[دالة API: domexit-api-prod]
       │
       ▼ (2. وضع رسالة المهمة في الطابور)
[طابور الرسائل: domexit-ai-ocr-prod] ──(في حال الفشل 3 مرات)──> [طابور الموتى: domexit-ai-ocr-prod-dlq]
       │
       ▼ (3. تريغر YMQ Trigger: batchSize = 1)
[دالة العامل: domexit-ai-worker-prod]
       │
       ├─► (4. قراءة الملف من S3 المشفر)
       ├─► (5. إرسال الصفحات إلى Yandex Vision OCR)
       ├─► (6. استخراج البنود والديون وحفظ النتيجة في YDB)
       └─► (7. إشعار الموظف المسؤول عبر Telegram Bot)
```

### 4.1 إعدادات الأمان المالي والتشغيلي لطوابير `YMQ`
1. **طابور الرسائل الرئيسي (`domexit-ai-ocr-prod`):**
   - **النوع:** Standard Message Queue.
   - **فترة حجب الرؤية (`VisibilityTimeout`):** تم ضبطها على **`180 ثانية`**، وهي مطابقة تماماً لأقصى مهلة تنفيذ مسموحة لدالة العامل الخلفي (`180s Execution Timeout`). يضمن هذا التوافق عدم إعادة تسليم نفس الرسالة إلى عامل آخر أثناء استمرار العامل الأول في معالجة المستند.
   - **حجم الدفعة المستدعاة (`Batch Size = 1`):** تسحب الدالة رسالة واحدة فقط في كل استدعاء، لمنع استهلاك الذاكرة وتفادي تجاوز حد الـ `512MB` عند معالجة مستندات متعددة في نفس الوقت.
2. **طابور الرسائل المتعثرة (`domexit-ai-ocr-prod-dlq`):**
   - **سياسة إعادة التوجيه (`Redrive Policy - maxReceiveCount: 3`):** في حال حدوث خطأ غير متوقع أثناء معالجة المستند (مثل ملف PDF تالف أو خطأ في الاتصال)، يعيد النظام المحاولة حتى مرتين؛ وإذا فشل للمرة الثالثة، تُنقل الرسالة فوراً إلى `DLQ`.
   - **الحماية من الحلقات اللانهائية واستنزاف الرصيد (`Infinite Loop Prevention`):** يمنع طابور `DLQ` تكرار معالجة الملفات المعطوبة إلى ما لا نهاية، مما يحمي رصيد المنصة في Yandex Cloud من التآكل المفاجئ.
3. **سقوف الأمان اليومية الصارمة (`Safety Caps`):**
   - **`DAILY_OCR_PAGES_CAP: 200`:** سقف أمان أقصى لمعالجة 200 صفحة OCR يومياً، يوقف النظام آلياً فور تجاوزه لمنع الهجمات أو فواتير الاستخدام غير المنضبط.
   - **`MAX_PAGES_PER_DOC: 15`:** الحد الأقصى المسموح بقراءته من أي مستند واحد هو 15 صفحة، مع التركيز على الصفحات القانونية والمحاسبية الأولى والأخيرة.

---

### 4.2 كود توقيع طلبات SQS بالمعيار السحابي الرابع (`AWS Signature Version 4 Implementation`)
لتفادي الاعتماد على حزم برمجية ضخمة داخل سكربتات التهيئة، ينفذ سكربت `setup-ai-worker-prod.mjs` خوارزمية توقيع طلبات HTTP القياسية لـ SQS (`AWS4-HMAC-SHA256`) باستخدام مكتبة `crypto` الأصلية في Node.js:

```javascript
function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

async function sqsRequest(pathStr, params) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const endpoint = 'https://message-queue.api.cloud.yandex.net';
  const url = new URL(pathStr, endpoint);
  const form = new URLSearchParams(params).toString();
  const hashedPayload = crypto.createHash('sha256').update(form).digest('hex');
  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${url.host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', url.pathname, '', canonicalHeaders, signedHeaders, hashedPayload].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/sqs/aws4_request`,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const sigKey = getSignatureKey(sk, dateStamp, region, 'sqs');
  const sig = crypto.createHmac('sha256', sigKey).update(stringToSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${ak}/${dateStamp}/${region}/sqs/aws4_request, SignedHeaders=${signedHeaders}, Signature=${sig}`;

  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Amz-Date': amzDate,
      Authorization: auth,
    },
    body: form,
  });
}
```

---

## 5. المرجع الشامل لمتغيرات البيئة السحابية (`Environment Variables Reference`)

> [!IMPORTANT]
> **قاعدة الأمان الصارم (`Zero Secrets Policy`):** يُحظر نهائياً تدوين أو تخزين أي مفاتيح تشفير أو كلمات مرور أو رموز وصول سرية داخل هذا التوثيق أو داخل مستودع الشفرة. يوضح الجدول التالي **أسماء المتغيرات، وظائفها الهندسية، قيمها الافتراضية، ومواقع ضبطها فقط**.

| اسم المتغير البرمجي (`Variable Name`) | النوع والبيئة (`Type & Env`) | الحالة (`Status`) | الوصف المعماري والوظيفي | الأثر الفني في حال غياب المتغير |
|:---|:---:|:---:|:---|:---|
| **`APP_ENV`** | `String` (كافة البيئات) | **إلزامي** | يحدد بيئة التشغيل الحالية (`staging` أو `production`). | يتوقف الخادم أو يفترض `staging` كإجراء أمان. |
| **`YDB_DOCAPI_ENDPOINT`** | `URL` (سحابي) | **إلزامي** | عنوان الاتصال بواجهة YDB Document API المتوافقة مع DynamoDB SDK. | فشل فوري في تشغيل الخادم وانهيار كافة استعلامات البيانات. |
| **`YDB_REGION`** | `String` | اختياري | المنطقة الجغرافية السحابية لقاعدة البيانات (الافتراضي: `ru-central1`). | يعتمد الافتراضي `ru-central1`. |
| **`YC_ACCESS_KEY_ID`** | `String` (سحابي) | **إلزامي** | معرف مفتاح الوصول الثابت لحساب الخدمة IAM للتخاطب مع S3 وYDB. | فشل توثيق كافة طلبات التخزين وقواعد البيانات. |
| **`YC_SECRET_ACCESS_KEY`** | `String` (سحابي) | **إلزامي** | الرمز السري التابع لمفتاح الوصول السحابي المشفر. | رفض الوصول الفوري برمز خطأ `403 AccessDenied`. |
| **`S3_PUBLIC_BUCKET`** | `String` | **إلزامي** | اسم دلو الصور والمخططات العامة (`domexit-storage-vault`). | فشل رفع واستعراض صور الشقق والواجهات. |
| **`S3_PRIVATE_BUCKET`** | `String` | **إلزامي** | اسم الدلو المشفر المخصص لوثائق 152-ФЗ والنسخ الاحتياطية. | فشل رفع مستندات التدقيق وتوقف خط OCR. |
| **`S3_ENDPOINT`** | `URL` | اختياري | عنوان خدمة كائنات التخزين (الافتراضي: `https://storage.yandexcloud.net`). | يعتمد العنوان السحابي القياسي لياندكس. |
| **`JWT_SIGNING_SECRET`** | `String` (سحابي) | **إلزامي** | مفتاح التوقيع الرقمي المشفر لإنشاء والتحقق من رموز جلسات JWT. | توقف تسجيل الدخول وتوليد رمز خطأ `500`. |
| **`JWT_SIGNING_SECRET_PROD`** | `String` (إنتاج) | **إلزامي للإنتاج** | مفتاح التوقيع الخاص المعزول لبيئة الإنتاج الرسمية. | فشل تشغيل سكربت النشر `deploy-prod.mjs`. |
| **`YANDEX_OAUTH_CLIENT_ID`** | `String` | **إلزامي** | معرف تطبيق Yandex ID المعتمد لتسجيل دخول المستخدمين. | تعطل تسجيل الدخول السريع عبر حساب ياندكس. |
| **`YANDEX_OAUTH_CLIENT_SECRET`**| `String` | **إلزامي** | الرمز السري لتطبيق Yandex ID لاستبدال كود التحقق برمز الوصول. | فشل مسار استكمال تسجيل الدخول OAuth Callback. |
| **`PUBLIC_BASE_URL`** | `URL` | **إلزامي** | النطاق الأساسي العام للمنصة (`https://domexit.ru` في الإنتاج). | توليد روابط خاطئة ومشاكل في ترويسات CORS. |
| **`YANDEX_REDIRECT_URI`** | `URL` | اختياري | عنوان إعادة التوجيه لـ Yandex ID (يُبنى تلقائياً من النطاق الأساسي). | رفض تسجيل الدخول من خوادم ياندكس لعدم تطابق العنوان. |
| **`TELEGRAM_BOT_TOKEN`** | `String` | اختياري | رمز الوصول الخاص ببوت التليجرام الرسمي للمنصة. | توقف إرسال الإشعارات ورموز OTP عبر التليجرام. |
| **`TELEGRAM_BOT_USERNAME`** | `String` | اختياري | المعرف البرمجي للبوت (الافتراضي: `DomExitOfficialBot`). | تعطل أزرار الربط التلقائي في واجهة المستخدم. |
| **`TELEGRAM_WEBHOOK_SECRET`** | `String` | اختياري | الرمز السري المشفر للتحقق من أن طلبات التليجرام الواردة مرسلة رسمياً. | رفض معالجة أوامر التليجرام برمز `403`. |
| **`DADATA_API_KEY`** | `String` | اختياري | مفتاح الوصول لواجهة `DaData.ru` المجانية للبحث عن العناوين والبنوك. | توقف الإكمال التلقائي لعناوين الشقق والتحقق من ИНН. |
| **`YMQ_OCR_QUEUE_URL`** | `URL` (سحابي) | اختياري/موصى | عنوان طابور رسائل معالجة المستندات `domexit-ai-ocr-*`. | تعطل معالجة الـ OCR غير المتزامنة وتراكم المهام. |
| **`YC_FOLDER_ID`** | `String` | اختياري | معرف المجلد السحابي في Yandex Cloud (`b1g46uad3gc3h34k5b0f`). | استخدام المعرف الافتراضي الثابت في التكوين. |
| **`DAILY_OCR_PAGES_CAP`** | `Number` | اختياري | السقف اليومي لصفحات OCR (الافتراضي: `200` صفحة). | اعتماد القيمة الافتراضية الآمنة 200. |
| **`MAX_PAGES_PER_DOC`** | `Number` | اختياري | أقصى عدد صفحات يُقرأ من المستند الواحد (الافتراضي: `15` صفحة). | اعتماد القيمة الافتراضية 15. |
| **`YDB_USE_V2_TABLES`** | `Boolean` | **إلزامي (true)** | راية تفعيل استخدام معمارية جداول `v2` المفهرسة بـ `GSIs`. | في حال ضبطه على `false`، يعود النظام لجداول `v1`. |
| **`EMAIL_PROVIDER`** | `String` | اختياري | مزود خدمة البريد (`postbox` أو `console`). | يعتمد `postbox` في حال توفر بيانات SMTP. |
| **`POSTBOX_SMTP_USER`** | `String` | اختياري | اسم مستخدم حساب خدمة Postbox لإرسال البريد. | تعطيل إرسال البريد الحقيقي واستخدام وحدة التحكم. |
| **`POSTBOX_SMTP_PASS`** | `String` | اختياري | كلمة مرور حساب خدمة Postbox المشفرة. | فشل المصادقة مع خادم SMTP. |

---

## 6. هندسة التكلفة السحابية وخريطة التوسّع التشغيلي (`FinOps & Scaling Roadmap`)

### 6.1 ميكانيكا الفاتورة السحابية والحصص المجانية (`Yandex Cloud Billing Mechanics`)
صُممت منصة DomExit لتكون ذات كفاءة مالية فائقة (**Zero-Idle-Cost**)، حيث لا تدفع المنصة أي روبل في أوقات خمول الزوار:

1. **دوال الحوسبة (`Serverless Functions`):**
   - الحصة المجانية الشهرية: **أول 1,000,000 استدعاء مجاناً** شهرياً، وأول **`800,000 GB-seconds` مجاناً**.
   - ما زاد عن ذلك: تكلفة لا تتجاوز `0.12 ₽` لكل مليون طلب، و`0.0016 ₽` لكل جيجابايت/ثانية.
2. **قواعد بيانات `YDB Serverless`:**
   - الحصة المجانية الشهرية: **أول 1,000,000 وحدة طلب (Request Units - RU)** مجاناً، وأول **1 جيجابايت تخزين مجاناً**.
   - الفهرسة الذكية عبر `GSIs`: تحمي من استهلاك `RU` الزائد عن طريق القراءة المباشرة من الفهرس بدلاً من المسح الكامل للجدول (`Table Scan`).
3. **تخزين الكائنات (`Object Storage`):**
   - الحصة المجانية: أول **`1 GB` تخزين شهرياً مجاناً**.
   - التكلفة اللاحقة: التخزين القياسي `~2.1 ₽/GB/شهر`، بينما التخزين البارد والأرشيفي ينخفض إلى `~0.8–0.4 ₽/GB/شهر`.
4. **محركات الذكاء الاصطناعي (`Vision OCR & YandexGPT`):**
   - الحصة المجانية لـ OCR: أول **`1,000` صفحة شهرياً مجاناً**.
   - YandexGPT Lite: تكلفة رمزية تقدر بـ `0.02 ₽` لكل ألف رمز (قروش معدودة لكل تحليل).

---

### 6.2 نقاط التحول الهندسية والمالية من 100 إلى 100,000 مستخدم نشط شهرياً (`MAU`)

```
 [100 - 3,000 MAU]        [3,000 - 15,000 MAU]        [15,000 - 50,000 MAU]        [50,000 - 100,000+ MAU]
 ─────────────────        ────────────────────        ─────────────────────        ───────────────────────
  تكلفة شبه صفرية          تفعيل شبكة CDN              إضافة كاش موزع Valkey        تفعيل Provisioned Concurrency
  داخل الـ Free Tier       خفض تكلفة Egress            حماية قواعد YDB              والترحيل الجزئي لـ YQL Native
```

| مرحلة النمو (`Scale Tier`) | عدد المستخدمين النشطين (`MAU`) | إشارة التحول الدقيقة (`Trigger Indicator`) | الإجراء الهندسي الإلزامي (`Required Engineering Action`) |
|:---|:---|:---|:---|
| **المرحلة 1: الانطلاق** | `100 – 3,000 MAU` | البداية الأولية والتسجيلات الأولى. | - العمل بالكامل داخل الحصص المجانية (الفاتورة تقارب `0 ₽/شهر`).<br>- تفعيل التنبيه المبكر في Billing عند وصول الاستهلاك إلى `500 ₽`. |
| **المرحلة 2: نمو الأصول** | `3,000 – 5,000 MAU` | طلبات الأصول الثابتة والصور تتجاوز **`1.1M` طلب/شهر**. | **تفعيل شبكة توزيع المحتوى `Yandex Cloud CDN` (`cdn.domexit.ru`):**<br>- إنشاء CDN Resource وتوجيهه لدلو الصور والواجهة.<br>- خفض زمن تحميل الصور بنسبة 60% وتقليل تكلفة خروج البيانات من S3. |
| **المرحلة 3: التوسع والضغط** | `15,000 – 20,000 MAU` | انخفاض نسبة Cache Hit في الذاكرة المحلية بسبب التوسع لعدة حاويات متزامنة. | **إضافة كاش موزع (`Managed Valkey / Redis`):**<br>- استبدال `InMemoryLruCache` بكاش موزع مركزي عبر واجهة `CacheAdapter` لتقليص استهلاك `RU` في YDB بنسبة 85%. |
| **المرحلة 4: تنظيف v1** | بعد 14–30 يوماً من استقرار الإنتاج | استقرار كافة عمليات v2 دون أي حاجة للتراجع. | **حذف جداول `v1` القديمة الـ 12:**<br>- تحرير مساحة التخزين في YDB وتقليص التكاليف الأرشيفية بعد التأكد من اكتمال الترحيل. |
| **المرحلة 5: الذروة والسرعة** | `50,000 – 100,000 MAU` | ارتفاع زمن البداية الباردة (`Cold Start P95`) للدوال بعد فترات الخمول لأكثر من `1.5 ثانية`. | **تفعيل الحوسبة الدافئة المحجوزة (`Provisioned Concurrency`):**<br>- إبقاء حاوية واحدة دافئة لدالة `domexit-api-prod` في أوقات ذروة تداول الصفقات (من 10:00 إلى 20:00 بتوقيت موسكو). |
| **المرحلة 6: الحجم المؤسسي** | `> 100,000 MAU` | تزايد الحاجة لاستعلامات التجميع المالية والتقارير الإحصائية المعقدة (`SUM/COUNT/GROUP`). | **الترحيل الجزئي إلى محرك `YQL Native SDK`:**<br>- نقل استعلامات التحليلات الثقيلة والفلاتر متعددة الأبعاد إلى جداول YQL علائقية مع الإبقاء على Document API للمعاملات السريعة. |

---

### 6.3 بروتوكول الترقية والنشر الإنتاجي الآمن ذو الخطوات السبع (`Zero-Downtime Deployment Protocol`)

لضمان سلامة البيئة التشغيلية ومنع أي أخطاء مفاجئة قد تعطل الصفقات الحية على `https://domexit.ru`، تتبع المنصة بروتوكول نشر صارم لا يمكن تخطي أي مرحلة منه:

```
[1. Staging E2E Tests] ──> [2. Pre-Deploy Backup] ──> [3. Build & Deploy Worker]
                                                              │
[6. Git Tag & Push] <── [5. 12 Smoke Tests] <── [4. Deploy Backend & Frontend]
```

1. **الخطوة 1: الاختبار الشامل على بيئة التأهيل (`Staging E2E Verification`):**
   - تنفيذ كافة سيناريوهات التحقق الشامل على `Staging` (`npm run verify:staging`) والتأكد من اجتيازها بنسبة 100% ودون أي خطأ برمجي.
2. **الخطوة 2: النسخ الاحتياطي الاستباقي للإنتاج (`Pre-Migration Backup`):**
   - استدعاء دالة النسخ الاحتياطي الإنتاجية `domexit-backup-prod` عبر السكربت المخصص وحفظ ملف اللقطة الكامل في `domexit-private-docs-prod/_backups/ydb/daily/*` قبل لمس أي شفرة في الإنتاج.
3. **الخطوة 3: حزم ونشر دالة العامل والخلفيات (`Deploy Worker & Sweeper`):**
   - تجميع واختبار دالة العامل الخلفي `domexit-ai-worker-prod` ونشرها مع راية الأمان الإلزامية:
     `node backend/scripts/deploy-ai-worker-prod.mjs --confirm-prod`
   - تجميع ونشر دالة المراقبة المحدثة:
     `node backend/scripts/deploy-sweeper-prod.mjs --confirm-prod`
4. **الخطوة 4: نشر دالة الخادم الرئيسية وبوابة التطبيقات (`Deploy API & Gateway`):**
   - تشغيل سكربت النشر الإنتاجي:
     `node backend/scripts/deploy-prod.mjs --confirm-prod`
   - يتحقق السكربت من بناء الحزم، تحديث مواصفة `apigw-prod.yaml` بمعرف الدالة، وتطبيق التعديل على البوابة ونشر إصدار الدالة مع حقن متغيرات البيئة المشفرة.
5. **الخطوة 5: بناء ونشر وتقليم أصول الواجهة الأمامية (`Deploy Web & Prune Stale Assets`):**
   - فحص الأمان البرمجي وتأكيد خلو حزمة `dist/` من أي أسرار، ثم رفع الملفات وتقليم الأصول المهجورة:
     `node infrastructure/scripts/deploy-web-prod.cjs --confirm-prod --prune-all-stale`
6. **الخطوة 6: الفحص الحي الإثني عشر للقراءة فقط (`12 Production Smoke Tests`):**
   - تنفيذ فحص الدخان الحي عبر مسار `node infrastructure/scripts/test-prod-smoke.mjs` ضد النطاق الحي `https://domexit.ru`، والتأكد من نجاح كافة الاختبارات الإثني عشر وتأكيد قفل ميزات `AI Lab` للجمهور.
7. **الخطوة 7: التوثيق والتوسيم والمزامنة مع المستودع (`Git Tag & Push`):**
   - تحديث التقرير المرجعي الشامل للحالة، إنشاء وسم الإصدار الجديد، ودفعه للمستودع:
     `git tag -a v3.0.0-ai-ready -m "Release v3.0.0-ai-ready"`
     `git push origin main --tags`

---

## 7. سيناريوهات الطوارئ وخطة التعافي من الكوارث (`Disaster Recovery & Failure Scenarios`)

تتضمن المعمارية السحابية خطط تعافٍ دقيقة ومجربة لمواجهة السيناريوهات الطارئة الثلاثة الأكثر حرجاً:

### السيناريو 1: تعطل أو خلل برمجي مفاجئ في دالة الخادم الرئيسية (`API Function Regression`)
- **الأعراض:** ارتفاع معدل أخطاء `500 Internal Server Error` أو انهيار مسار حيوي.
- **إجراء التعافي اللحظي (< 60 ثانية):**
  نظراً لأن منصة Yandex Serverless تحتفظ بسجل الإصدارات السابقة وتعيّن لكل منها معرّفاً مستقلاً، يكفي الرجوع للإصدار المستقر السابق:
  ```bash
  yc serverless function version list --function-name domexit-api-prod
  # توجيه البوابة للإصدار المستقر عبر تعديل apigw-prod.yaml أو تفعيل الإصدار السابق
  ```
  أو إعادة نشر التعديل بعد اختباره محلياً باستخدام السكربت المؤتمت.

### السيناريو 2: تلف أو عبث بقواعد بيانات YDB (`Database Corruption / Accidental Loss`)
- **الأعراض:** اختفاء سجلات أو تلف في بيانات الجداول.
- **إجراء التعافي (< 15 دقيقة):**
  1. سحب أحدث نسخة احتياطية مضغوطة من المسار المحمي:
     `domexit-private-docs-prod/_backups/ydb/daily/backup-{YYYY-MM-DD-HHmm}.json.gz`
  2. تشغيل سكربت استعادة البيانات المتوافق مع معمارية Document API لإعادة حقن السجلات في الجداول الـ 24 بطريقة الإيداع غير التدميري (`PutItem Idempotency`).

### السيناريو 3: هجوم إغراق أو استنزاف مفاجئ لموارد الذكاء الاصطناعي (`AI Resource Exhaustion Attack`)
- **الأعراض:** محاولات مكثفة لاستدعاء OCR أو GPT تؤدي لاقتراب الفاتورة من سقف الأمان.
- **إجراء التعافي الفوري (< 1 ثانية):**
  1. يدخل المالك إلى لوحة الإدارة السريعة ويضغط على مفتاح التعطيل العام: **`masterLabEnabled = false`**.
  2. يُبطل الكاش المحلي فورياً عبر `memoryCache.del('ai_lab_config')`، فتتوقف كافة استدعاءات نماذج الذكاء الاصطناعي على الفور وتعود دوال النظام لإرجاع رمز المنع `403 LabDisabled` دون استهلاك أي وحدة معالجة سحابية إضافية.

---

## 8. خلاصة الفصل وجاهزية البنية التحتية
يقدم هذا الفصل الدليل الهندسي والتشغيلي المكتمل للبنية السحابية لمنصة **DomExit** في `Yandex Cloud (ru-central1)`، ويثبت أن المنظومة مُصممة وفق معايير الحوسبة السحابية الحديثة الخالية من الخوادم، ومحصنة بسياسات تخزين بالغة الصرامة تمتثل لقوانين الخصوصية وتكافح الهدر المالي عبر أتمتة دورات الحياة والتقليم المستمر، مع مسار توسع واضح يستوعب حتى 100,000 مستخدم نشط بكفاءة واستقرار تام.

في **الجزء الثاني (الفصلين 03 و04)**، سننتقل إلى تشريح **قواعد بيانات `YDB v2`، نموذج الفهارس الثانوية العالمية (`GSIs`) بالتفصيل لجميع الجداول الـ 24**، يليه **التشريح المعماري الكامل لـ Serverless API ومسارات دوال الخادم الـ 14**.
