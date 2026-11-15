# تقرير المسح الاستكشافي الأعمى والفحص الجنائي الشامل لكامل المنظومة (Phase 1)
## Zero-Assumption Full System Forensic Audit & Reality Check
**تاريخ الفحص:** 15 نوفمبر 2026  
**النطاق:** فحص جنائي شامل 100% لكود المشروع، قاعدة بيانات Yandex YDB، التخزين السحابي S3، طبقة الوصول للبيانات (DAL)، دورة حياة العقار والصفقات، والنماذج والأزرار.  
**الحالة:** مرحلة الفحص والاكتشاف الممنهج (Phase 1 of 2 — مسح أعمى وتوثيق دقيق دون تعديل على كود التشغيل أو نشر).

---

## فهرس التقرير
1. **القسم 1: حقيقة البنية التحتية وطبقة البيانات الحالية (Infrastructure & DAL Reality Check)**
2. **القسم 2: الجرد الفعلي لما هو موجود الآن داخل قاعدة البيانات و `localStorage`**
3. **القسم 3: التشخيص الدقيق بالأسطر البرمجية لمشكلة ظهور عقار للمستخدم الجديد (`/portal`) وبيانات المطور الوهمية (`SellersPage`)**
4. **القسم 4: مصفوفة تتبع دورة حياة الصفقة من الإرسال حتى الإغلاق (State Machine & Status Continuity)**
5. **القسم 5: الجدول الشامل لجميع النصوص والأرقام والمصفوفات الثابتة (Hardcoded Remnants)**
6. **القسم 6: سجل الأزرار والنماذج غير المربوطة أو المعطلة عبر كافة الشاشات (UI/UX & Dead Controls)**
7. **القسم 7: الخطة الهندسية الجراحية المقترحة للإصلاح الشامل (Surgical Roadmap for Phase 2)**

---

# القسم 1: حقيقة البنية التحتية وطبقة البيانات الحالية (Infrastructure & DAL Reality Check)

### 1.1 خارطة الهيكل البرمجي الفعلي للكود
من خلال المسح المباشر لشجرة مجلد `src/`، يتكون المشروع فعلياً من:
- **الصفحات (`Pages`):** 36 صفحة مستقلة مسجلة في شجرة التوجيه (`src/pages`).
- **المكونات (`Components`):** 25 مكوناً رئيسياً مقسمة وظيفياً (`auth`, `admin`, `catalog`, `booking`, `compliance`, `documents`, `layout`, `legal`, `lot`, `profile`, `chat`, `vip`).
- **مخازن الحالة (`Stores`):** مخزنان عبر Zustand:
  1. `src/stores/useEnvironmentStore.ts` (إدارة التبديل بين بيئة الإنتاج الحقيقية `production` وبيئة الاختبار `demo`).
  2. `src/stores/useFeatureFlagsStore.ts` (التحكم في تفعيل وتعطيل وحدات النظام: النادي الاستثماري، بوابة البنوك، الختم الروسي، البوت).
- **السياقات المركزية (`Contexts`):**
  - `src/context/AuthContext.tsx`: منظومة المصادقة وجلسات المستخدمين.
  - `src/i18n/LanguageContext.tsx`: محرك اللغات (روسي / إنجليزي).
- **المستودعات (`DAL Repositories`):** 23 مستودعاً في `src/dal/repositories/`.
- **المحولات (`Adapters`):** محولان في `src/dal/adapters/`:
  - `YandexCloudAdapter.ts` (المحول النشط الفعلي).
  - `FirebaseAdapter.ts` (المحول الاحتياطي القديم).

---

### 1.2 حقيقة محول البيانات النشط والاتصال بقاعدة البيانات
- **المحول النشط:** التطبيق يعمل بنسبة **100% عبر `YandexCloudAdapter`** استناداً لمتغير البيئة `VITE_DATA_PROVIDER=yandex`.
- **آلية الاتصال الفعلي:**
  - يتم الاتصال بـ **Yandex YDB Document API** عبر بروتوكول HTTP REST الموجه لعنوان الوكيل المحلي `/ydb-proxy` الذي يحول الطلبات إلى نقطة النهاية السحابية:
    `https://docapi.serverless.yandexcloud.net/ru-central1/b1gbu0q3jqnheri2srsu/etnckg937628mnid7tnb`
  - يتم توقيع كل طلب برمجياً في `src/dal/adapters/YandexCloudAdapter.ts` باستخدام خوارزمية **AWS4-HMAC-SHA256** مع مفاتيح الخدمة `Yandex Service Account Key ID` و `Secret Key`.
- **دليل الاتصال الحي بالشبكة:**
  - تم إجراء فحص شبكي مباشر عبر استعلام حي لقاعدة البيانات (`Scan` و `ListTables`)، ونجحت العمليات بـ `HTTP Status 200 OK` لجميع الجداول الـ 43 في YDB.
- **حقيقة الرجوع التلقائي والتعامل مع الأخطاء (`Catch Blocks & Fallbacks`):**
  - في ملف `src/dal/adapters/YandexCloudAdapter.ts` (الأسطر 92–136):
    * الدالة `getAllEntities(collectionName, seedFallback)`: إذا أعادت قاعدة بيانات ياندكس مصفوفة فارغة `res.data.Items.length === 0`:
      - السطر 120–125: إذا كان المعامل `seedFallback` يحتوي على عناصر، تقوم الدالة بحفظ هذه العناصر الوهمية داخل جدول ياندكس فعلياً وإرجاعها!
      - ولكن داخل `src/dal/DatabaseGateway.ts` (السطر 46–50): تمت إضافة حاجز أمان برمجياً:
        ```typescript
        const effectiveSeedFallback = isProd && isIsolatedCollection(collectionName) ? [] : seedFallback;
        ```
        مما يعني أنه في وضع الإنتاج (`production`)، لا يتم حقن المصفوفات الوهمية داخل الجداول الإنتاجية النظيفة، بل تعود بمصفوفة فارغة `[]`.
      - **الثغرة المكتشفة في معالجة الأخطاء (`Catch Block` - السطر 128–135):**
        في حال حدوث انقطاع في الشبكة أو خطأ غير متوقع، يعود المحول تلقائياً إلى الكاش المحلي `localStorage` عبر `readLocalCache(collectionName)`. وإذا كان الكاش المحلي يحتوي على بيانات تجريبية سابقة تم تخزينها أثناء تجارب المطور، فإنها تظهر فوراً للمستخدم!

---

### 1.3 حقيقة عزل البيئات (`Production` مقابل `Demo`)
- **المخزن المسؤول:** `src/stores/useEnvironmentStore.ts`.
- **القيمة الافتراضية:** القيمة الافتراضية هي **`production`** بشكل صارم لكافة الزوار والمستخدمين العاديين.
- **شرط التبديل إلى `demo`:**
  - مسموح حصرياً للمالك (`amaas9499@gmail.com` أو من يحمل دور `owner`). إذا حاول أي مستخدم آخر التبديل، يتم إرجاعه قسراً إلى `production`.
- **آلية العزل في المستودعات (`src/dal/config/collectionResolver.ts`):**
  - توجد مصفوفة `ISOLATED_COLLECTIONS` تضم 22 جدولاً خاضعاً للعزل.
  - في بيئة `production`: يتم الاستعلام عن الجدول الأصلي مباشرة (مثل `lots`, `deals`, `seller_requests`).
  - في بيئة `demo`: تقوم الدالة `resolveCollectionName` بإضافة بادئة `demo_` (مثل `demo_lots`, `demo_deals`).
  - **النتيجة الجنائية:** نظام العزل سليم من الناحية الهيكلية في `DatabaseGateway`، **ولكن المشكلة تكمن في الواجهات (`Components`)** التي تكسر هذا العزل بوضع شروط افتراضية تجلب عقارات تجريبية يدويًا كما سنفصل في القسم 3.

---

# القسم 2: الجرد الفعلي لما هو موجود الآن داخل قاعدة البيانات و `localStorage`

تم تنفيذ فحص جنائي أعمى عبر الاتصال الحي بـ **Yandex YDB Document API** لجميع الجداول الـ 43 المسجلة في السحابة. إليك الحقيقة الكاملة للبيانات المخزنة فعلياً لحظة الفحص:

### 2.1 جداول بيئة الإنتاج الحقيقية (`Production Tables`)
| اسم الجدول في YDB | عدد السجلات الحالية | حالة الجدول | تفاصيل المحتوى الفعلي |
| :--- | :---: | :--- | :--- |
| **`users`** | **6** | نشط وبه مستخدمون حقيقيون | يتضمن حسابات مسجلة بـ Yandex ID وحسابات أدمن وموظفين: <br>1. `usr-ya-900593452` (حساب ياندكس للمستخدم) <br>2. `usr-ya-1130000088195822` (حساب ياندكس آخر) <br>3. `usr-fb-001` (Ahmed Abdallah - المالك `amaas9499@gmail.com`) <br>4. `emp-1` (Алексей Смирнов - куратор) <br>5. `usr-1738000000000` <br>6. `usr-investor-001` |
| **`audit_logs`** | **20** | نشط وبه سجلات تدقيق | سجلات تسجيل الدخول، حفظ وثائق السياسات، واعتماد شروط 152-ФЗ. |
| **`platform_settings`** | **2** | نشط ومضبوط | سجلين: `public_channels` (قنوات التواصل والتليجرام) و `company_legal_profile` (بيانات الشركة والسجل التجاري). |
| **`documents_vault`** | **5** | به وثائق تأسيسية | ملفات النظام التأسيسية (`doc-sys-init-1` إلى `5`) الخاصة بالقوالب الرسمية. |
| **`bank_special_approvals`**| **4** | به طلبات اعتماد | طلبات تدقيق برامج البنوك الشريكة. |
| **`developer_accreditation_requests`**| **1** | **ملوث ببيانات وهمية!** | يحتوي على السجل المحقون تلقائياً: `DEV-ACC-dfdfv-test` للمطور `dfdfv` مع `ЖК «Тестовый Проект»`! |
| **`market_settings`** | **1** | نشط ومضبوط | سجل إعدادات السوق ونسب الفائدة المرجعية للبنك المركزي `singleton_market_settings`. |
| **`user_consents`** | **2** | نشط | موافقات المستخدمين على معالجة البيانات الشخصية وسياسة الاستخدام. |
| **`lots`** | **0** | **فارغ تماماً (نظيف)** | لا يوجد أي عقار إنتاجي حقيقي حتى الآن. |
| **`deals`** | **0** | **فارغ تماماً (نظيف)** | لا توجد أي صفقات إنتاجية مفتوحة. |
| **`seller_requests`** | **0** | **فارغ تماماً (نظيف)** | لا توجد طلبات بائعين في قائمة الانتظار الإنتاجية. |
| **`candidates`** | **0** | **فارغ تماماً (نظيف)** | لا يوجد مشترون إنتاجيون مسجلون. |
| **`buyer_applications`** | **0** | **فارغ تماماً (نظيف)** | لا توجد طلبات شراء مسجلة في الإنتاج. |
| **`employees`** | **0** | فارغ في الإنتاج | حساب الموظف مسجل كـ user ومسجل في demo_employees. |
| **`partners`** | **0** | فارغ في الإنتاج | لا يوجد شركاء معتمدون في الإنتاج. |
| **`investor_applications`** | **0** | فارغ في الإنتاج | لا توجد طلبات مستثمرين في الإنتاج. |

---

### 2.2 جداول بيئة العرض التجريبي (`Demo Tables`)
| اسم الجدول في YDB | عدد السجلات الحالية | تفاصيل المحتوى |
| :--- | :---: | :--- |
| **`demo_lots`** | **14** | يتضمن كافة العقارات التجريبية، وفي مقدمتها اللوت الشهير **`U-10566`** (ЖК «Чистое Небо» في Приморский район بسعر 10 972 000 ₽) وللوتات `U-14102`, `U-16890` وغيرها. |
| **`demo_deals`** | **5** | يتضمن الصفقات التجريبية، وأبرزها الصفقة **`DEAL-2025-10566`** المرتبطة باللوت `U-10566`. |
| **`demo_buyer_applications`**| **5** | طلبات شراء بأسماء تجريبية (`Иван Петрович`, `Михаил С.`). |
| **`demo_partner_applications`**| **4** | طلبات انضمام وسطاء تجريبية. |
| **`demo_employees`** | **3** | المنسقون التجريبيون (`Алексей Смирнов`, `Елена Васильева`). |
| **`demo_users`** | **2** | مستخدمون تجريبيون للديمو. |
| **`demo_seller_requests`**| **1** | طلب بائع تجريبي برقم `sreq-10566`. |
| **`demo_developer_accreditation_requests`**| **1** | طلب المطور `DEV-ACC-dfdfv-test`. |

---

### 2.3 فحص التخزين المحلي للمتصفح (`localStorage`)
تستخدم المنصة المفاتيح التالية محلياً:
- `domexit_app_environment`: يخزن البيئة النشطة للمتصفح (`production` أو `demo`).
- `domexit_current_user_v3`: يخزن الملف التعريفي لجلسة المستخدم النشطة بعد تسجيل الدخول.
- `domexit_ydb_${collectionName}`: كاش محلي مؤقت يتم تحديثه تلقائياً عند القراءة من YDB.

---

# القسم 3: التشخيص الدقيق بالأسطر البرمجية لمشكلة ظهور عقار في حساب المستخدم الجديد ومسألة المطور

### 3.1 الجريمة البرمجية الأولى: لماذا يرى المستخدم الجديد المسجل عبر ياندكس عقاراً معروضاً للبيع وصفقة في حسابه الشخصي (`/portal`)؟
عندما يقوم مستخدم جديد بالتسجيل لأول مرة في المنصة عبر **Yandex ID**:
1. في ملف `src/context/AuthContext.tsx` (الأسطر 170–191):
   - يتم إنشاء ملف للمستخدم جديد تماماً، ويأخذ دور `client` مع `activeRole = 'buyer'` و `roles = ['buyer', 'seller']`.
   - يكون حقل `user.clientCode` كوداً جديداً تماماً (مثل `DEX-489123`).
   - لا يملك هذا المستخدم أي لوت أو صفقة في قاعدة البيانات، فقاعدة بيانات الإنتاج خالية (`lots = 0`, `deals = 0`).
2. ينتقل المستخدم إلى حسابه الشخصي في صفحة بوابة العميل: `src/pages/ClientPortalPage.tsx`.
3. تقوم الدالة `loadData()` في الأسطر 263–293 بالاستعلام عن عقارات المستخدم وصفقاته عبر:
   - `LotsRepository.getBySeller(uid, clientCode)` -> تعيد مصفوفة فارغة `[]`.
   - `DealsRepository.getBySeller(uid, clientCode)` -> تعيد مصفوفة فارغة `[]`.
4. **وهنا تقع الكارثة البرمجية الصريحة في الأسطر 340–350 من `src/pages/ClientPortalPage.tsx`:**
   ```typescript
   // السطر 340 في ClientPortalPage.tsx:
   // Seller lots & deals (fallback to U-10566 / DEAL-2025-10566 if demo seller has no custom lot yet)
   let resolvedSellerLots = mySellerLots;
   let resolvedSellerDeals = mySellerDeals;
   if (resolvedSellerLots.length === 0) {
     const fallbackLot = lotsData.find((l) => l.lotCode === 'U-10566') || lotsData[0];
     if (fallbackLot) resolvedSellerLots = [fallbackLot];
   }
   if (resolvedSellerDeals.length === 0) {
     const fallbackDeal = await DealsRepository.getById(user?.activeDealId || 'DEAL-2025-10566');
     if (fallbackDeal) resolvedSellerDeals = [fallbackDeal];
   }

   setSellerLots(resolvedSellerLots);
   setSellerDeals(resolvedSellerDeals);
   ```
   **السبب الجذري الحاسم 100%:**  
   المبرمج كتب عمداً شرطاً بديلاً (`Fallback`) يفترض أنه إذا لم يكن لدى البائع أي عقار، فإنه يقوم **قسراً بحقن اللوت التجريبي `U-10566` (ЖК «Чистое Небо»)** والصفقة **`DEAL-2025-10566`** داخل حساب أي مستخدم جديد، وتثبيت الكود النشط عبر السطر 359:
   ```typescript
   const activeCode = ... || resolvedSellerLots[0]?.lotCode || 'U-10566';
   setSelectedSellerLotCode(activeCode);
   ```
   وبالتالي، يفتح المستخدم الجديد حسابه فيجد نفسه فجأة يملك شقة في مجمع «Чистое Небо» وصفقة جارية مع المنسق، بينما هو لم يرسل أي طلب بيع على الإطلاق!

---

### 3.2 الجريمة البرمجية الثانية: لماذا تظهر بيانات ثابتة وهمية (`ЖК «Тестовый Проект»`, `Иван Сергеевич Т.`, `DEX-784105`, `12 500 000 ₽`) تحت اسم المطور في لوحة المالك؟
اشتكى المستخدم من أنه عند قيام البائع بإضافة مطور جديد في استمارة البيع، تظهر في لوحة الأدمن بيانات وهمية لم يقم بإدخالها.  
بالفحص الجنائي للبحث عن العبارات: `dfdfv` و `ЖК «Тестовый Проект»` و `7896512304`:

1. **المصدر المسؤول عن حقن هذه البيانات الوهمية:**
   في ملف تهيئة قاعدة البيانات: **`src/dal/initializer.ts` (الأسطر 106–138)**:
   ```typescript
   // السطر 106 في src/dal/initializer.ts:
   const reqCollections = ['developer_accreditation_requests', 'demo_developer_accreditation_requests'];
   for (const col of reqCollections) {
     const reqs = await DatabaseGateway.getAll<any>(col, []);
     const existing = reqs.find(
       (r: any) =>
         r.developerName?.toLowerCase().includes('dfdfv') ||
         r.developerInn === '7896512304'
     );
     if (existing) {
       if (existing.status !== 'pending') {
         existing.status = 'pending';
         await DatabaseGateway.save(col, existing);
       }
     } else {
       await DatabaseGateway.save(col, {
         id: 'DEV-ACC-dfdfv-test',
         developerName: 'dfdfv',
         developerInn: '7896512304',
         lotId: 'lot-test-dfdfv',
         lotCode: 'U-10566',
         complexName: 'ЖК «Тестовый Проект»',
         city: 'spb',
         district: 'Приморский район',
         contractPriceRub: 12500000,
         sellerName: 'Иван Сергеевич Т.',
         sellerClientCode: 'DEX-784105',
         documentIds: [],
         status: 'pending',
         requestedAt: new Date().toISOString(),
         decisions: [],
       });
     }
   }
   ```
2. **آلية عمل الخلل:**
   - في كل مرة يتم تشغيل التطبيق أو تحميله، تقوم دالة `DatabaseInitializer` بفحص جدولي `developer_accreditation_requests` في الإنتاج والديمو.
   - إذا لم تجد السجل `DEV-ACC-dfdfv-test`، تقوم **بحفظه فوراً في قاعدة بيانات الإنتاج الحقيقية** حاملاً القيم الوهمية:
     - اسم المطور: `dfdfv`
     - رقم الضريبة (ИНН): `7896512304`
     - اسم المجمع: `ЖК «Тестовый Проект»`
     - اسم البائع: `Иван Сергеевич Т.`
     - كود العميل: `DEX-784105`
     - سعر العقد: `12 500 000 ₽`
3. **عرضه في لوحة المالك (`src/pages/AdminDashboardPage.tsx` - التبويب 2):**
   في الأسطر 2140–2165:
   تقوم لوحة الأدمن بجلب الطلبات عبر `DevelopersRepository.getAllAccreditationRequests()` وتعرض هذا السجل الوهمي الثابت في قائمة طلبات الاعتماد.  
   وعندما يرسل مستخدم حقيقي استمارة إضافة مطور جديد من `SellersPage.tsx`، يُضاف طلبه كطلب مستقل، ولكن وجود هذا السجل الوهمي المحقون إجبارياً يجعله يظهر دائماً في لوحة التحكم!

---

# القسم 4: مصفوفة تتبع دورة حياة الصفقة من الإرسال حتى الإغلاق (State Machine Continuity)

تتبعنا مسار البيانات خطوة بخطوة من شاشة الإدخال وحتى الإغلاق المالي، ورصدنا كل نقطة انقطاع أو عدم تطابق في الحالات:

```
[1. تقديم الطلب /sellers] 
        ↓ 
  Lot: status='draft', currentStage=1, approvalStatus='pending_owner_approval'
  Deal: stage='initial_audit', curator='Ожидает назначения куратора'
  Request: status='pending_owner_review'
        ↓
[2. لوحة المالك /admin/dashboard - التبويب 2]
  يبحث الجدول عن: lot.approvalStatus === 'pending_owner_approval' (تطابق تام ✓)
  المالك يضغط: «Одобрить и закрепить куратора» (approveAndAssign)
        ↓
  Lot: status='draft', currentStage=2, approvalStatus='approved_for_packaging', assignedEmployeeId=empId
  Deal: stage='document_check', curatorName=empName, assignedEmployeeId=empId
  Request: status='approved_assigned'
        ↓
[3. كانبان المنسق /admin/pipeline]
  العمود 1: initial_audit
  العمود 2: document_check (تظهر فيه الصفقة الآن بنجاح ✓)
  العمود 3: packaging
  العمود 4: buyer_matching
  العمود 5: closing_escrow
        ↓
[4. استوديو التغليف /admin/packaging/:lotId]
  المنسق يدخل لتغليف العقار وإخفاء بيانات 152-ФЗ.
  [ثغرة حرجة ⚠️]: الحقول غير المكتملة تأخذ أرقاماً وهمية ثابتة (المساحة 42، الدور 8، السعر 10.97 млн).
  المنسق يضغط: «Опубликовать в открытом каталоге» (publishToOpenCatalog)
  Lot: status='available', currentStage=3, approvalStatus='approved', isPublished=true
  [انقطاع تسلسلي ⚠️]: دالة LotsRepository.publishToOpenCatalog تحدث العقار فقط، ولا تقوم بتحديث مرحلة الصفقة Deal.stage تلقائياً إلى 'buyer_matching'! فتبقى الصفقة معلقة في 'document_check' بالكانبان ما لم يسحبها المنسق يدوياً!
        ↓
[5. الفحص القانوني الموزون /admin/legal-audit/:lotId]
  المنسق يفحص شروط 127-ФЗ و 214-ФЗ و СФР و ФССП.
  [ثغرة ⚠️]: إذا فُتحت الصفحة بدون معامل، تفترض تلقائياً اللوت 'U-10566' وتفترض اسم المنسق 'Алексей Смирнов'.
        ↓
[6. العرض العام بالكتالوج /opportunities وحجز المشتري]
  يظهر العقار في الكتالوج لأنه: isPublished=true && status='available'.
  يدخل مشتري ويضغط «Забронировать» في نافذة BookingModal.tsx:
  تُحفظ في buyer_applications بـ status='pending'.
        ↓
[7. محرك المفاضلة /admin/matchmaker/:lotId]
  يفتح المنسق الشاشة لمفاضلة عروض المشترين واختيار الفائز.
  [ثغرة ⚠️]: linkedDealId تفترض افتراضياً 'DEAL-2025-10566'.
  عند الضغط على «Утвердить кандидата» (acceptCandidate):
  BuyerCandidate: status='priority_reserved' (وباقي المرشحين declined).
  Lot: status='in_deal', buyerUserId=winner.uid, buyerName=winner.name.
  Deal: stage='closing_escrow', status='in_deal', buyerUserId=winner.uid, buyerClientCode=winner.clientCode.
  Deal.escrowWorkflow: يُنشأ بحساب إسكرو بنكي ومبلغ الإيداع.
        ↓
[8. غرفة الإغلاق المالي /admin/closing/:dealId]
  تصل الصفقة لمرحلة التنفيذ المالي والاعتماد البنكي (4 خطوات إسكرو):
  - الخطوة 1: مراجعة المنسق وإحالة الطلب للبنك (handoverToBank).
  - الخطوة 2: تأكيد مسؤول البنك إيداع المشتري للأموال في حساب الضمان (confirmBankDeposit).
  - الخطوة 3: رفع محضر التوقيع الإلكتروني الإلزامي وصور الجلسة وختم Росреестр (submitSigningProof).
    [ثغرة ⚠️]: الكود الحالي يحتوي على روابط افتراضية لصور Unsplash وملف وهمي ثابت باسم: 'Видеофиксация_сессии_ЭЦП_Сбербанк.mp4'.
  - الخطوة 4: الإفراج عن أموال الإسكرو وتحويل العائد للبائع ورسوم المنصة (releaseEscrowFunds).
  Deal: stage='completed', status='closed'.
  Lot: status='closed'.
```

---

# القسم 5: الجدول الشامل لجميع النصوص والأرقام والمصفوفات الثابتة (Hardcoded Remnants)

من خلال المسح البرمجي الصارم والشامل لكامل ملفات المشروع `src/**/*.{ts,tsx}`، تم رصد **252 موضعاً** تحتوي على بيانات وهمية وأرقام مبرمجة يدوياً. فيما يلي الجدول التفصيلي الشامل لأخطر هذه المواضع:

| الملف البرمجي | رقم السطر | نوع البيانات الثابتة | مقتطف الكود المسبب للمشكلة | الأثر التشغيلي والخلل الناتج |
| :--- | :---: | :--- | :--- | :--- |
| `src/pages/ClientPortalPage.tsx` | 344 | كود لوت وهمي | `lotsData.find((l) => l.lotCode === 'U-10566') \|\| lotsData[0]` | يفرض العقار U-10566 في حساب أي مستخدم جديد مسجل. |
| `src/pages/ClientPortalPage.tsx` | 348 | كود صفقة وهمية | `DealsRepository.getById(user?.activeDealId \|\| 'DEAL-2025-10566')` | يفرض صفقة وهمية في حساب أي مستخدم جديد. |
| `src/pages/ClientPortalPage.tsx` | 260 | كود عميل ثابت | `const clientCode = user?.clientCode \|\| 'DEX-784105';` | استخدام كود عميل وهمي كبديل عند غياب الكود. |
| `src/pages/ClientPortalPage.tsx` | 335 | عروض شراء وهمية | `else if (!uid) { setUserBids(allCandidates.slice(0, 1)); }` | عرض عروض شراء لمستخدم غير مسجل. |
| `src/pages/ClientPortalPage.tsx` | 97 | كود لوت ثابت | `const [buyerVaultLotCode, setBuyerVaultLotCode] = useState('U-10566');` | تثبيت الكود في خزنة وثائق المشتري. |
| `src/dal/initializer.ts` | 120–136 | كائن مطور وهمي كامل | `id: 'DEV-ACC-dfdfv-test', developerName: 'dfdfv', contractPriceRub: 12500000, sellerName: 'Иван Сергеевич Т.'` | حقن سجل وهمي إجباري في قاعدة بيانات الإنتاج يظهر في لوحة الأدمن. |
| `src/pages/AdminBrokersPage.tsx` | 239 | مبالغ مالية ثابتة بالروبل | `{formatRubles(totalPaidRub \|\| 2850000)}` | عندما يكون الرصيد 0 ₽، تعرض الواجهة كذباً أنه تم دفع 2.85 مليون روبل! |
| `src/pages/AdminBrokersPage.tsx` | 252 | مبالغ مالية ثابتة بالروبل | `{formatRubles(totalPendingRub \|\| 360000)}` | عندما تكون المستحقات 0 ₽، تعرض الواجهة كذباً وجود 360 ألف روبل مستحقة! |
| `src/pages/AdminClosingPage.tsx` | 110 | مبالغ مالية ثابتة بالروبل | `sellerReturnRub = deal?.sellerReturnRub \|\| lot?.cashPaidBySeller \|\| 2485230;` | فرض مبلغ 2 485 230 ₽ كعائد للبائع في حال عدم توفره. |
| `src/pages/AdminClosingPage.tsx` | 48–52 | صور وملفات وهمية | `['https://images.unsplash.com/...', 'Видеофиксация_сессии_ЭЦП_Сбербанк.mp4']` | روابط صور خارجية وملف فيديو وهمي في إثبات الجلسة. |
| `src/pages/AdminClosingPage.tsx` | 58, 60 | موظف ومشغل ثابت | `currentEmployeeId = ... \|\| 'emp-1'`, `operatorName = ... \|\| 'Алексей Смирнов'` | افتراض هوية منسق وهمي عند غياب الحساب. |
| `src/pages/AdminClosingPage.tsx` | 69 | معرف صفقة ثابت | `targetId = (dealId \|\| 'DEAL-2025-10566').toUpperCase();` | فتح الصفقة 10566 تلقائياً عند غياب المعامل. |
| `src/pages/AdminClosingPage.tsx` | 138 | بريد إلكتروني صلب | `user.email === 'amaas9499@gmail.com'` | فحص بريد صلب في التحقق من الصلاحيات بدلاً من مصفوفة مركزية. |
| `src/pages/ClientTrackerPage.tsx` | 280 | مبالغ مالية ثابتة بالروبل | `const sellerPayout = deal?.sellerReturnRub \|\| ... \|\| 2485230;` | ظهور مبلغ وهمي ثابت في صفحة تتبع العميل. |
| `src/pages/ClientTrackerPage.tsx` | 330 | اسم مجمع ثابت | `lot?.complexName \|\| deal?.lotTitle \|\| 'ЖК «Чистое Небо»'` | إظهار اسم مجمع Чистое Небо كبديل وهمي. |
| `src/pages/ClientTrackerPage.tsx` | 362, 518 | أسماء أشخاص وهميين | `curator?.name \|\| 'Алексей Морозов'`, `'Алексей Смирнов'` | إظهار أسماء منسقين وهميين للعميل في التتبع. |
| `src/pages/ClientTrackerPage.tsx` | 765 | بنك ومطور ثابت | `lot?.developer \|\| 'Setl Group' • ПАО {lot?.escrowBank \|\| 'Сбербанк'}` | افتراض مطور Setl Group وبنك Сбербанк. |
| `src/pages/SellersPage.tsx` | 77, 89 | قيم افتراضية للاستمارة | `complexName = 'ЖК «Чистое Небо»'`, `paidAmountStr = '2850000'` | ملء استمارة البائع مسبقاً بمجمع ومبلغ ثابت! |
| `src/pages/SellersPage.tsx` | 97, 1172 | اسم شخص ثابت | `user?.name \|\| 'Александр Владимирович Белов'` | وضع اسم افتراضي روسي للمستخدم في استمارة البيع! |
| `src/pages/SellersPage.tsx` | 196, 430 | كود عميل ثابت | `clientCode = user?.clientCode \|\| 'DEX-784105'` | كود عميل ثابت افتراضي عند إنشاء لوت أو طلب مطور. |
| `src/pages/AdminPackagingPage.tsx` | 58–75 | مواصفات فنية ومالية ثابتة | `areaM2: 42, floor: 8, totalFloors: 24, oldDduPrice: 10972000, cashToSeller: 2485230` | قيم ابتدائية ثابتة للعقار تملأ الواجهة إذا كانت الحقول فارغة. |
| `src/pages/AdminPackagingPage.tsx` | 104 | محطة مترو ثابتة | `setMetroName('Комендантский пр.');` | تعيين محطة مترو افتراضية لسانت بطرسبرغ. |
| `src/pages/AdminPackagingPage.tsx` | 136–139 | صور Unsplash ثابتة | روابط Unsplash تجريبية كمعرض صور افتراضي للعقار. | إظهار صور عشوائية لعقارات غير حقيقية. |
| `src/pages/AdminLegalAuditPage.tsx` | 131–134 | منسق ورقم لوت ثابت | `currentEmployeeId = 'emp-1'`, `lotId \|\| 'U-10566'` | فتح اللوت 10566 باسم أليكسي سميرنوف. |
| `src/pages/AdminMatchmakerPage.tsx` | 35, 43 | لوت وصفقة ثابتة | `currentLotCode = lotId \|\| 'U-10566'`, `linkedDealId = 'DEAL-2025-10566'` | ربط صفحة المفاضلة باللوت والصفقة 10566. |
| `src/dal/seedData.ts` | كامل الملف | مصفوفات بيانات وهمية ضخمة | مصفوفات `initialLots`, `initialDeals`, `initialCandidates` بأسماء: `Иван Петрович`, `Михаил С.` | تغذية الجداول التجريبية عند إنشائها. |
| `src/dal/repositories/CandidatesRepository.ts` | 13 | استدعاء مصفوفة وهمية | `DatabaseGateway.getAll(COLLECTION, initialCandidates)` | استدعاء مصفوفة المشترين الوهميين كبديل عند الفراغ. |

---

# القسم 6: سجل الأزرار والنماذج غير المربوطة أو المعطلة عبر كافة الشاشات (UI/UX & Dead Controls)

أجرينا فحصاً شاملاً لتجربة المستخدم وعناصر التحكم عبر جميع أدوار المنونة الستة:

### 1. دور الزائر غير المسجل (`Visitor`):
- **زر «Быстрый подбор за 60 секунд» في الصفحة الرئيسية:**
  - يفتح النافذة المنبثقة `QuickMatchModal.tsx`.
  - **حالة الزر:** الزر يفلتر محلياً فقط ولا يحفظ رغبة الزائر أو رقم هاتفه في قاعدة البيانات ما لم يكمل التسجيل كاملاً.
- **فلتر الكتالوج المتقدم (`AdvancedFilterDrawer.tsx`):**
  - فلاتر المترو ونطاق السعر تعمل جيداً على الذاكرة المحلية، ولكن زر «Сбросить все» في بعض الحالات يعيد ضبط الفلاتر مع بقاء نتائج البحث معلقة دون تحديث.

### 2. دور البائع (`Seller`):
- **استمارة التقديم `/sellers`:**
  - **حقل اسم البائع:** يملأ مسبقاً باسم `Александр Владимирович Белов` إذا لم يكن المستخدم مسجلاً، مما يربك البائع إذا أرسل الاستمارة دون انتباه!
  - **حقل المجمع المدفوع:** يملأ مسبقاً بـ `2 850 000 ₽` ومجمع `ЖК «Чистое Небо»`.
  - **زر «Добавить застройщика»:** يفتح حقول إدخال المطور ورقم الضريبة ИНН، ولكنه لا يقوم بالتحقق المباشر من قاعدة بيانات مصلحة الضرائب الفيدرالية (ФНС) بل يكتفي بالتحقق من طول رقم ИНН (10 أرقام).
- **بوابة البائع `/portal`:**
  - زر **«Отозвать заявку»** أو **«Удалить объект»**: غير موجود في واجهة البائع؛ لا يستطيع البائع إلغاء طلبه من طرفه إذا غير رأيه، بل يجب أن يتدخل الأدمن.

### 3. دور المشتري (`Buyer`):
- **نافذة الحجز `/lot/:id` (`BookingModal.tsx`):**
  - زر إرسال الطلب مربوط بـ `CandidatesRepository.submitBid` ويعمل بنجاح.
  - **الخلل:** عند رفع ملف كشف الحساب البنكي أو الموافقة الائتمانية، إذا انقطع الاتصال بـ S3 يكتمل الإرسال بدون تنبيه واضح للمشتري بأن وثيقته لم ترفع.
- **بوابة المشتري `/portal` (تبويب عروضي):**
  - إذا كان المستخدم غير مسجل، يعرض له كود اللوت `U-10566` كعرض افتراضي عبر السطر 335.

### 4. دور الوسيط / الشريك (`Broker / Partner`):
- **صفحة لوحة الوسطاء `/admin/brokers`:**
  - كروت الإحصائيات العلوية تعرض أرقاماً وهمية ثابتة (`2 850 000 ₽` و `360 000 ₽`) عند كون الرصيد الفعلي صفراً!
  - زر **«Сформировать акт сверки»** (إصدار كشف حساب): يظهر إشعاراً منبثقاً (Toast) فقط ولا يولد وثيقة PDF حقيقية ولا يحفظها في خزنة S3.
  - زر **«Экспорт реестра в Excel/CSV»**: يقوم بتنزيل ملف CSV بسيط من الذاكرة المحلية دون ربطه بسجل الأرشيف الرسمي.

### 5. دور المنسق المعين (`Curator`):
- **شاشة الكانبان `/admin/pipeline`:**
  - سحب وإفلات البطاقات أو الضغط على «В упаковку →»: يحدث مرحلة الصفقة في YDB بنجاح.
  - **الخلل:** لا يقوم بتحديث `currentStage` في وثيقة العقار المقترنة (`Lot`)، مما يسبب عدم تزامن بين الصفقة والعقار.
- **استوديو التغليف `/admin/packaging/:lotId`:**
  - زر **«Опубликовать в открытом каталоге»**: ينشر اللوت، ولكنه لا يحدث مرحلة الصفقة في الكانبان تلقائياً.
  - زر **«Отправить в закрытый VIP-каталог»**: يعمل عند تفعيل ميزة النادي، ولكنه لا يرسل إشعاراً لحظياً للمستثمرين في قاعدة البيانات.
- **شاشة الفحص القانوني `/admin/legal-audit/:lotId`:**
  - أزرار تقييم النقاط الأربعة وتحديث الدرجة تعمل وتحفظ في `LotsRepository.updateCheckpoints`.
  - زر **«Запросить доп. документы у продавца»**: يحفظ الطلب في وثيقة العقار، ولكنه لا يرسل إشعار بريد إلكتروني أو رسالة تليجرام للبائع.
- **غرفة الإغلاق المالي `/admin/closing/:dealId`:**
  - زر **«Видеофиксация и штамп Росреестра»**: يحتوي على أسماء ملفات افتراضية مسبقة.

### 6. دور المالك ورئيس مجلس الإدارة (`Owner CEO`):
- **لوحة التحكم الشاملة `/admin/dashboard`:**
  - **التبويب 2 (طلبات البائعين):**
    - زر «Одобрить и закрепить куратора»: يعمل ويكتب في `seller_requests` و `lots` و `deals` بنجاح.
    - جدول اعتماد المطورين: يعرض السجل الوهمي `dfdfv` دائماً بسبب كود التهيئة.
  - **التبويب 5 (المستخدمون والشواغر RBAC):**
    - زر «+ Добавить куратора»: يضيف موظفاً في الذاكرة ومستودع `EmployeesRepository`، ولكن في حال عدم وجود جدول `employees` في بيئة الإنتاج فإن السجل يحفظ فقط كـ user.
  - **التبويب 6 (Legal CMS):**
    - محرر الوثائق القانونية والأرشيف الرقمي ببصمة SHA-256 يعمل بدقة ويكتب في `platform_settings` و `audit_logs`.

---

# القسم 7: الخطة الهندسية الجراحية المقترحة للإصلاح الشامل (Surgical Roadmap for Phase 2)

لتحويل منصة DomExit إلى منظومة إنتاجية نقية 100% (Zero Mock Data, Zero Silent Fallback, 100% YDB Driven)، نقترح تنفيذ خطة جراحية في المرحلة القادمة (Phase 2) مقسمة على 5 محاور عمل دقيقة:

### المحور 1: تطهير الحساب الشخصي (`/portal`) وبوابة التتبع (`/tracker`)
1. **في ملف `src/pages/ClientPortalPage.tsx`:**
   - حذف الأسطر 340–350 بالكامل. استبدال كود الـ fallback بمنطق نقي:
     * إذا كانت `mySellerLots.length === 0`، تظل `sellerLots` مصفوفة فارغة `[]`، وتظهر للمستخدم واجهة خالية نظيفة تشجعه على تقديم أول عقار عبر زر «Подать заявку на выход из ДДУ».
     * إذا كانت `mySellerDeals.length === 0`، تظل `sellerDeals` فارغة `[]`.
   - إزالة أي استخدام لـ `'U-10566'` أو `'DEAL-2025-10566'` كقيم افتراضية.
   - حذف السطر 335 الذي يضع مرشحاً وهمياً للمشتري غير المسجل.
2. **في ملف `src/pages/ClientTrackerPage.tsx`:**
   - إزالة كافة المبالغ الاحتياطية الثابتة (`2485230` روبلاً) واستبدالها بالقيمة الحقيقية للصفقة أو عرض `—` في حال عدم وجودها.
   - جلب اسم المنسق ومعلومات البنك حصرياً من وثيقة الصفقة الحقيقية، وإزالة الأسماء البديلة (`Алексей Смирнов`, `Setl Group`).

---

### المحور 2: تطهير كود التهيئة واستمارة المطور (`initializer.ts` & `SellersPage.tsx`)
1. **في ملف `src/dal/initializer.ts`:**
   - حذف كود إنشاء وحقن `DEV-ACC-dfdfv-test` في الأسطر 106–138 تماماً!
   - تنظيف جدول `developer_accreditation_requests` في YDB من السجل الوهمي `DEV-ACC-dfdfv-test`.
2. **في ملف `src/pages/SellersPage.tsx`:**
   - إزالة القيم الابتدائية الافتراضية للاستمارة:
     * `complexName`: تفريغ الحقل بدلاً من وضع `ЖК «Чистое Небо»`.
     * `paidAmountStr`: تفريغ الحقل بدلاً من `2850000`.
     * `sellerName`: الاعتماد على `user?.name || ''` دون وضع `Александр Владимирович Белов`.
   - عند قيام البائع باختيار إضافة مطور جديد، يتم ربط طلب الاعتماد `DeveloperAccreditationRequest` بـ `lotId` و `sellerClientCode` الفعلي للمستخدم.

---

### المحور 3: توحيد آلة الحالة (`State Machine Synchronization`)
1. **الربط بين التغليف والصفقة (`LotsRepository.ts` & `AdminPackagingPage.tsx`):**
   - تعديل دالة `publishToOpenCatalog` لتقوم تلقائياً بتحديث مرحلة الصفقة المرتبطة باللوت:
     ```typescript
     await DealsRepository.updateStageByLotCode(lotCode, 'buyer_matching');
     ```
     ليتحرك كرت الصفقة في الكانبان تلقائياً إلى عمود «Подбор покупателя».
2. **الربط المتزامن لجميع شاشات المنسق:**
   - تمرير المعرفات الحقيقية عبر الروابط البرمجية (مثل `/admin/packaging/${deal.lotCode}`) بدلاً من الاعتماد على قيم ثابتة عند غياب المعامل في `useParams`.

---

### المحور 4: التخلص الجذري من كافة المبالغ والأسماء والروابط الثابتة (Hardcoded Scrub)
1. **في ملف `src/pages/AdminBrokersPage.tsx`:**
   - استبدال `totalPaidRub || 2850000` بـ `totalPaidRub || 0` وعرض `0 ₽` إذا لم تكن هناك عمولات مدفوعة.
   - استبدال `totalPendingRub || 360000` بـ `totalPendingRub || 0`.
2. **في ملف `src/pages/AdminClosingPage.tsx`:**
   - إزالة روابط صور Unsplash الافتراضية ومقطع الفيديو الوهمي `Видеофиксация_сессии_ЭЦП_Сбербанк.mp4`.
   - جعل خطوة التوقيع تتطلب رفع ملفات حقيقية من الجهاز أو من كاميرا المتصفح وحفظها في Yandex S3 مع تسجيل الرابط الفعلي في `deal.escrowWorkflow.signingProofPhotos`.
   - استبدال فحص البريد الإلكتروني الصلب `user.email === 'amaas9499@gmail.com'` بالدالة المركزية `isMasterOwner(user)`.

---

### المحور 5: تطهير الجداول وقواعد البيانات
1. **حذف الجداول التجريبية أو حصرها في وضع الاختبار:**
   - التأكد من أن بيئة الإنتاج `production` لا تقرأ بأي حال من الأحوال من `initialLots` أو `initialCandidates` أو `demo_*`.
2. **إضافة فحص سلامة البيانات التلقائي (Zero Mock Assertion):**
   - إضافة اختبار برمجي يضمن عدم وجود أي كود يحمل بادئة `fallback` تفرض لوت أو صفقة لمستخدم حقيقي.

---

**نهاية تقرير المسح الجنائي الشامل (Phase 1).**  
جاهز للمراجعة واتخاذ القرار للبدء في تنفيذ **المرحلة 2 (التنفيذ الجراحي الشامل والإصلاح البرمجي لكافة الملفات المذكورة)**.
