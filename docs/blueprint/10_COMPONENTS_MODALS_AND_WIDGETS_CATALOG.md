# الفصل العاشر: دليل المكونات والنوافذ والويدجت (Components, Modals & Widgets Catalog)

يحتوي هذا الفصل على حصر وتوثيق شامل ودقيق بنسبة 100% لكافة المكونات الثلاثين (30 Components) الموزعة في مجلد `src/components/**`. يتضمن التوثيق مواصفات الواجهات البرمجية (Props)، والحالة الداخلية (Internal State)، والوظيفة المعمارية، وتفاصيل التفاعل.

---

## 1. فهرس المكونات العام (30 Component Inventory)

| # | مسار المكون | الوصف المعماري | التصنيف |
|---|---|---|---|
| 1 | `src/components/admin/LegalCmsManager.tsx` | مدير CMS القانوني للسياسات وحساب بصمات التشفير | إدارة المحتوى |
| 2 | `src/components/auth/AdminRouteGuard.tsx` | حارس المسارات الإدارية والتأمين الحصري | أمان وتوجيه |
| 3 | `src/components/auth/AuthModal.tsx` | نافذة تسجيل الدخول والتسجيل وربط Yandex OAuth | مصادقة |
| 4 | `src/components/booking/BookingModal.tsx` | نافذة حجز العقار وتثبيت الوديعة وإعداد مسار الصفقة | تعاملات وحجز |
| 5 | `src/components/catalog/AdvancedFilterDrawer.tsx` | درج التصفية المتقدمة للكتالوج على الأجهزة الذكية | كتالوج وفلترة |
| 6 | `src/components/catalog/LotCard.tsx` | بطاقة العقار الذكية بالكتالوج وشارات التوفير والتحقق | عرض بيانات |
| 7 | `src/components/catalog/QuickMatchModal.tsx` | نافذة المطابقة السريعة للعقار مع المشترين المحتملين | مطابقة وذكاء |
| 8 | `src/components/chat/CuratorChatWidget.tsx` | درج المحادثة اللحظية المباشرة مع منسق العقار | محادثة فورية |
| 9 | `src/components/chat/EscrowBridgeChatModal.tsx` | نافذة المحادثة الخاصة بتسهيلات جسر الإسكرو البنكي | محادثة متخصصة |
| 10 | `src/components/common/BankGatewayErrorBoundary.tsx` | حاجز اعتراض ومعالجة أخطاء بوابات البنوك الشريكة | استقرار وأمان |
| 11 | `src/components/common/Skeletons.tsx` | هياكل التحميل العظمية (Skeleton Loaders) لسرعة FCP | أداء وتجربة |
| 12 | `src/components/common/VirtualizedList.tsx` | قائمة افتراضية فائقة الأداء لعرض مئات العناصر بسلاسة | أداء وتصيير |
| 13 | `src/components/compliance/ConsentCheckboxes.tsx` | خانات الاختيار القانونية الموحدة لـ 152-ФЗ و 38-ФЗ | امتثال قانوني |
| 14 | `src/components/compliance/ConsentGateModal.tsx` | نافذة إجبارية لحظر الاستخدام عند تحديث السياسات القانونية | امتثال وأمان |
| 15 | `src/components/compliance/CookieConsentBanner.tsx` | شريط ملفات تعريف الارتباط القانوني وتصنيف الأغراض | امتثال وخصوصية |
| 16 | `src/components/documents/DocumentVaultModal.tsx` | نافذة مستودع المستندات لرفع وفحص وتنزيل ملفات S3 | إدارة وثائق |
| 17 | `src/components/layout/AdminHeader.tsx` | الترويسة الإدارية العلوية بمؤشر البيئة وتبديل الأدوار | تخطيط إداري |
| 18 | `src/components/layout/AdminSidebar.tsx` | القائمة الجانبية الإدارية بعدادات خط الصفقات | تخطيط إداري |
| 19 | `src/components/layout/PublicLayout.tsx` | التخطيط العام الشامل للموقع العام للزوار والعملاء | تخطيط عام |
| 20 | `src/components/layout/UnifiedNavbar.tsx` | شريط التنقل العلوي العام الموحد مع زر الدخول السريع | تخطيط عام |
| 21 | `src/components/layout/UnifiedFooter.tsx` | التذييل الموحد الغني بروابط الإفصاح والبيانات الرسمية | تخطيط عام |
| 22 | `src/components/legal/SmartLegalDocumentView.tsx` | عارض النصوص القانونية الذكي مع استبدال المتغيرات الحية | عرض قانوني |
| 23 | `src/components/lot/PublicLegalReportModal.tsx` | نافذة التقرير القانوني العام للعقار للمشترين | عرض قانوني |
| 24 | `src/components/lot/SmartMortgageCalculator.tsx` | حاسبة الرهن الذكية لمقارنة فائدة 6% عائلي و 21% عام | حاسبات مالية |
| 25 | `src/components/maps/AddressAutocompleteInput.tsx` | حقل الإدخال الذكي للعناوين بالربط مع خرائط ياندكس | خرائط وإدخال |
| 26 | `src/components/maps/YandexCatalogMap.tsx` | الخريطة الجغرافية المجمعة لكتالوج العقارات (v3) | خرائط تفاعلية |
| 27 | `src/components/maps/YandexLotMap.tsx` | خريطة موقع العقار المنفرد مع محطة المترو والخدمات | خرائط تفاعلية |
| 28 | `src/components/profile/UserProfileModal.tsx` | نافذة إدارة الملف الشخصي للعميل وأرقام التواصل | ملف مستخدم |
| 29 | `src/components/seo/JsonLdStructuredData.tsx` | مولد البيانات المنظمة لمحركات البحث Schema.org | تحسين محركات |
| 30 | `src/components/vip/VipSubscriptionModal.tsx` | نافذة الانضمام لنادي المستثمرين المغلق وعروض VIP | استثمار ومبيعات |

---

## 2. المواصفات الفنية التفصيلية للمكونات

### 2.1. محادثة المنسق المباشرة: `src/components/chat/CuratorChatWidget.tsx`
- **الغرض:** فتح درج جانبي منبثق (Slide-over Drawer) في الشاشات العامة وصفحة العقار يتيح للعميل محادثة المنسق القانوني المخصص للعقار لحظياً.
- **الواجهة البرمجية (Props):**
  ```typescript
  interface CuratorChatWidgetProps {
    isOpen: boolean; // حالة ظهور الدرج
    onClose: () => void; // دالة الإغلاق
    dealId?: string; // معرف الصفقة المرتبط
    lotCode?: string; // كود العقار المرتبط (مثال: "U-62090")
    curatorName?: string; // اسم المنسق (افتراضياً: "Алексей Смирнов")
    curatorAvatar?: string; // رابط صورة المنسق
  }
  ```
- **الحالة الداخلية وإدارة البيانات:**
  - يستعلم من `CuratorChatRepository.getMessages(dealId)`.
  - يشترك في `DatabaseGateway.subscribe` للتحديث التلقائي للرسائل الجديدة دون الحاجة لإعادة تحميل.
  - يدعم إرسال نصوص ورفع مرفقات صور ومستندات عبر زر المشبك التلقائي.
  - يقوم تلقائياً بتمييز الرسائل كمقروءة (`clientRead: true` أو `curatorRead: true`).

---

### 2.2. مستودع المستندات السحابي: `src/components/documents/DocumentVaultModal.tsx`
- **الغرض:** نافذة مركزية منبثقة لإدارة كافة المستندات والملفات الثبوتية المرفوعة للعقار (عقد ДДУ، إشعار سداد، موافقة المطور، بطاقة الهوية).
- **الواجهة البرمجية (Props):**
  ```typescript
  interface DocumentVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    lotCode: string;
    readOnly?: boolean; // وضع القراءة فقط للمشترين قبل التوقيع
    onDocumentsUpdated?: (docs: DocumentMetadata[]) => void;
  }
  ```
- **الميزات الأساسية:**
  - رفع السحب والإفلات (Drag & Drop) للملفات المتعددة.
  - اختيار تصنيف الوثيقة الإلزامي (`category`).
  - التنزيل الفوري عبر الدالة السيرفرلس `s3-download`.
  - فحص نوع الملف وحجمه (الحد الأقصى 25 ميجابايت).

---

### 2.3. بطاقة العقار بالكتالوج: `src/components/catalog/LotCard.tsx`
- **الغرض:** الكارت الأساسي لعرض العقار في شبكة الكتالوج والصفحة الرئيسية.
- **الواجهة البرمجية (Props):**
  ```typescript
  interface LotCardProps {
    lot: Lot; // كائن العقار الكامل
    featured?: boolean; // تمييز العقار بإطار خاص
    onQuickMatch?: (lot: Lot) => void; // فتح نافذة التوفيق السريع
  }
  ```
- **العناصر المعروضة بالكارت:**
  - صورة الغلاف الرئيسية من `curatorApprovedImages`.
  - شارة نسبة التوفير باللون الأخضر الصريح (مثال: `-15%`).
  - شارة الاعتماد: `«214-ФЗ • Проверен»`.
  - السعر المعروض وسعر المطور المشطوب.
  - أقرب محطة مترو والمسافة بالدقائق.
  - زر المفضلة التفاعلي المربوط بـ `useAuth().toggleFavorite`.

---

### 2.4. حاسبة الرهن الذكية: `src/components/lot/SmartMortgageCalculator.tsx`
- **الغرض:** مكون حاسبة تفاعلي مدمج في صفحة العقار لمقارنة برامج التمويل العقاري الروسية.
- **الواجهة البرمجية (Props):**
  ```typescript
  interface SmartMortgageCalculatorProps {
    propertyPrice: number; // سعر العقار بالروبل
    downPaymentPercent?: number; // النسبة الافتراضية للدفعة الأولى (20%)
  }
  ```
- **المنطق الحسابي:**
  - يجلب أسعار الفائدة تلقائياً من `MarketSettingsRepository` (سعر البنك المركزي 21% والرهن العائلي 6%).
  - يحسب الدفعة الشهرية المتساوية (Аннуитетный платеж) وصافي الفوائد التراكمية.
  - يوضح الفارق الشهري الموفر عند الاستفادة من الرهن العائلي المدعوم.

---

### 2.5. حقل الإكمال التلقائي للعناوين والخرائط: `src/components/maps/AddressAutocompleteInput.tsx`
- **الغرض:** حقل إدخال جغرافي متصل بـ Yandex Geocoding API لاقتراح العناوين في موسكو وسانت بطرسبرغ بدقة.
- **الواجهة البرمجية (Props):**
  ```typescript
  interface AddressAutocompleteInputProps {
    value: string;
    onChange: (address: string, coords?: { lat: number; lng: number }) => void;
    placeholder?: string;
    cityCode?: RussianCityCode;
  }
  ```
- **السلوك:**
  - استدعاء مؤجل (Debounced Fetch) لخدمة عناوين ياندكس بعد توقف المستخدم عن الكتابة بـ 300 مللي ثانية.
  - استخراج الإحداثيات الجغرافية (`lat`, `lng`) وتمريرها تلقائياً لمخزن العقار لوضع العلامة على الخريطة.

---

### 2.6. خانات الموافقة القانونية الموحدة: `src/components/compliance/ConsentCheckboxes.tsx`
- **الغرض:** مجموعة خانات الاختيار الإلزامية في كافة الاستمارات للامتثال للقوانين 152-ФЗ و 38-ФЗ.
- **الواجهة البرمجية (Props):**
  ```typescript
  interface ConsentCheckboxesProps {
    state: ConsentState;
    onChange: (nextState: ConsentState) => void;
    showAdConsent?: boolean; // إظهار خانة الرسائل الدعائية (اختيارية)
    disabled?: boolean;
  }
  ```
- **الروابط المتضمنة بالنص:**
  - رابط سياسة معالجة البيانات الشخصية (`/legal/privacy`).
  - رابط شروط الاستخدام (`/legal/terms`).
  - رابط الإقرار بالموافقة على معالجة البيانات (`/legal/consent-pd`).

---

### 2.7. نافذة حظر الاستخدام للتجديد القانوني: `src/components/compliance/ConsentGateModal.tsx`
- **الغرض:** نافذة حظر إجبارية تظهر للمستخدم المسجل عند قيام الإدارة بإجراء تعديل جوهري (Material Change) على إحدى السياسات القانونية في CMS القانوني؛ تمنع استخدام الحساب حتى النقر على `«Принять обновленные условия»`، وتوثق الموافقة الجديدة في `user_consents`.

---

### 2.8. شريط الكوكيز الفيدرالي: `src/components/compliance/CookieConsentBanner.tsx`
- **الغرض:** شريط عائم أسفل الشاشة يظهر للزوار الجدد، يتيح قبول ملفات تعريف الارتباط التقنية الإلزامية أو إدارة تفضيلات التخصيص والتحليلات، ويحفظ الاختيار في `localStorage`.

---

### 2.9. الترويسة والقائمة الجانبية الإدارية: `AdminHeader` & `AdminSidebar`
- **`AdminHeader.tsx`:** تعرض شارة البيئة النشطة (إنتاج/تجربة مع تحذير بصري في التجربة)، وتبويب التبديل السريع للمستخدم، وقائمة التنبيهات وزر تسجيل الخروج.
- **`AdminSidebar.tsx`:** شريط جانبي داكن يحتوي على روابط محطات العمليات (`Pipeline`, `Packaging`, `Legal Audit`, `Matchmaker`, `Closing`, `Brokers`, `Archive Logs`) مع شارات أعداد الحالات النشطة بكل قسم.

---

### 2.10. خرائط ياندكس التفاعلية: `YandexCatalogMap` & `YandexLotMap`
- **`YandexCatalogMap.tsx`:** تعرض مئات العقارات المعروضة على خريطة العاصمة ومحيطها، وتدعم التجميع العنقودي (Clustering) والنقر على المجموعات لتكبير الرؤية، وعرض بطاقة العقار عند النقر.
- **`YandexLotMap.tsx`:** تعرض الموقع المحدد للعقار، مع رسم المسار التقديري لمحطة المترو والمنشآت التعليمية والطبية المحيطة.
