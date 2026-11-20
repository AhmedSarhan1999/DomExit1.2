# الفصل 2: حزم التقنيات وإعدادات البناء ومتغيرات البيئة (Tech Stack, Config & Environment)

---

## 1. جدول حزم المشروع الكامل (Dependencies Inventory)

يعتمد تطبيق **DomExit** على أحدث إصدارات بيئة العمل React 19 وبناء Vite 8، مقسمة بدقة وفق جدول الاعتماديات في `package.json`:

### أ. حزم وقت التشغيل الأساسية (Runtime Dependencies)

| الحزمة (Package) | الإصدار (Version) | الدور التقني والوظيفي في التطبيق |
| :--- | :--- | :--- |
| `react` | `^19.3.1` | مكتبة واجهة المستخدم الأساسية لإدارة شجرة المكونات وتحديثات الـ DOM التفاعلية. |
| `react-dom` | `^19.3.1` | محول التصيير لربط React ببيئة متصفح الويب وإدارة الـ Portal. |
| `react-router-dom` | `^7.18.4` | مكتبة التوجيه من الجيل السابع لإدارة مسارات الـ SPA، وحماية المسارات الإدارية، والتوجيه التلقائي. |
| `zustand` | `^5.0.16` | مكتبة إدارة الحالة العامة الخفيفة وعالية الأداء (إدارة البيئات، ومفاتيح الميزات، والملفات التعريفية). |
| `lucide-react` | `^1.59.0` | حزمة الأيقونات المتجهة الموحدة للتطبيق (أيقونات الأمان، المؤشرات، الأسهم، والملاحة). |
| `@aws-sdk/client-s3` | `^3.1173.0` | عميل AWS S3 الرسمي المستخدم للاتصال الآمن بحاوية **Yandex Object Storage** المتوافقة مع بروتوكول S3 API. |
| `@aws-sdk/s3-request-presigner` | `^3.1173.0` | أداة توليد الروابط الموقعة مسبقاً (Presigned URLs) لتنزيل وعرض المستندات والصور بأمان. |
| `@aws-sdk/client-dynamodb` | `^3.1173.0` | العميل الرسمي للتواصل مع واجهة **Yandex YDB Document API** المتوافقة مع بروتوكول DynamoDB v4. |
| `@aws-sdk/lib-dynamodb` | `^3.1173.0` | مكتبة التبسيط للتعامل مع كائنات جافاسكريبت المباشرة دون الحاجة للتحويل اليدوي لخصائص DynamoDB. |
| `firebase` | `^13.0.0` | حزمة Firebase SDK كطبقة احتياطية (Fallback Adapter) في بيئة التطوير المحلية ومزامنة الأحداث القديمة. |

### ب. حزم التطوير والبناء (Dev Dependencies)

| الحزمة (Dev Package) | الإصدار (Version) | الدور التقني والوظيفي |
| :--- | :--- | :--- |
| `vite` | `^8.3.4` | أداة التجميع والتطوير فائقة السرعة للمشروع (Bundler & Dev Server). |
| `@vitejs/plugin-react` | `^6.1.2` | إضافة Vite الرسمية لدعم تجميع JSX/TSX والتحويل السريع (Fast Refresh). |
| `tailwindcss` | `^4.3.3` | إطار عمل التصميم والتنسيق الذري من الجيل الرابع (Tailwind v4). |
| `@tailwindcss/vite` | `^4.3.3` | إضافة محرك Tailwind v4 المباشر المدمج داخل معمارية Vite للتجميع الفوري دون بطء. |
| `typescript` | `~7.0.2` | لغة البرمجة الأساسية ونظام التحقق الصارم من الأنواع (Type Safety). |
| `postcss` | `^8.5.31` | معالج CSS النهائي لدعم البادئات التلقائية والتحسين. |
| `autoprefixer` | `^10.6.1` | إضافة إضافة بادئات المتصفحات لضمان التوافق مع كافة المنصات والمتصفحات الحديثة. |
| `oxlint` | `^1.88.0` | مدقق جودة الكود البرمجي فائق السرعة المبني بلغة Rust. |
| `@types/react` | `^19.3.0` | تعريفات الأنواع للغة TypeScript الخاصة بمكتبة React 19. |
| `@types/react-dom` | `^19.3.0` | تعريفات الأنواع للغة TypeScript الخاصة بمكتبة React DOM 19. |
| `@types/node` | `^24.19.2` | تعريفات الأنواع البرمجية لبيئة تشغيل Node.js ودوال السيرفر. |

---

## 2. تحليل ملفات التهيئة والبناء (Configuration Files Analysis)

### أ. ملف `vite.config.ts`
يحتوي الملف على معمارية تجميع متقدمة تشمل:
1. **إضافة الضغط الأصلي المدمج (`nativeCompressionPlugin`):**  
   تقوم بالإضافة عند إتمام التجميع (`closeBundle`) بفحص مجلد `dist/` وتوليد ملفات مضغوطة مسبقاً بتقنيتي:
   - **Gzip (.gz)** بمستوى ضغط أقصى (`level: 9`).
   - **Brotli (.br)** بمستوى جودة أقصى (`quality: 11`).  
   يتم تطبيق الضغط على كافة الملفات التي يتجاوز حجمها 512 بايت لصيغ `.js`, `.css`, `.html`, `.svg`, `.json`.
2. **استراتيجية تقسيم الحزم البرمجية (`manualChunks`):**  
   لتجنب الحزم الضخمة وتسريع وقت التحميل الأولي، تم تقسيم الكود تلقائياً إلى:
   - `vendor-react`: تضم `react`, `react-dom`, `react-router`.
   - `vendor-icons`: تضم `lucide-react`.
   - `vendor-firebase`: تضم مكتبة `firebase`.
   - `vendor-lib`: تضم باقي الاعتماديات الخارجية.
3. **البروكسي المحلي للتطوير (`server.proxy`):**  
   - تحويل مسار `/ydb-proxy/*` إلى `https://docapi.serverless.yandexcloud.net`.
   - تحويل مسار `/yandex-passport-proxy/*` إلى `https://login.yandex.ru`.

### ب. ملف `netlify.toml`
يحدد قواعد استضافة الإنتاج والأمان على منصة Netlify:
1. **أمر البناء ومجلد النشر والدوال:**
   - `command = "npm run build"`
   - `publish = "dist"`
   - `functions = "netlify/functions"`
2. **درع حماية الملفات الصارم (Strict File Shield Redirects):**
   - حجب فوري بإرجاع 404 لأي محاولة وصول للملفات الحساسة:  
     `/.env*`, `/.git/*`, `/*.sql`, `/*.bak`, `/node_modules/*`, `/package.json`, `/tsconfig.json`.
3. **توجيه البروكسي الخلفي (Edge Proxies):**
   - `/ydb-proxy/*` -> `https://docapi.serverless.yandexcloud.net/:splat` (status 200).
   - `/s3-proxy/*` -> `https://storage.yandexcloud.net/:splat` (status 200).
   - `/yandex-passport-proxy/*` -> `https://login.yandex.ru/:splat` (status 200).
   - توجيه الـ SPA العام: `/*` -> `/index.html` (status 200).
4. **ترويسات الأمان والامتثال (Security Headers & CSP):**
   - `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`.
   - `X-Frame-Options`: `DENY`.
   - `X-Content-Type-Options`: `nosniff`.
   - `Referrer-Policy`: `strict-origin-when-cross-origin`.
   - `Content-Security-Policy`: سياسة شاملة تسمح بالاتصال فقط بنطاقات ياندكس الرسمية (`*.yandexcloud.net`, `*.yandex.ru`, `*.yandex.net`, `yastatic.net`), وتمنع تضمين الموقع داخل إطارات خارجية (`frame-ancestors 'none'`).
5. **سياسات التخزين المؤقت للمتصفح (Cache-Control):**
   - `/index.html`: `public, max-age=0, must-revalidate` (لضمان وصول المستخدمين لأحدث إصدار فوراً).
   - `/assets/*`, `/*.svg`, `/*.woff2`: `public, max-age=31536000, immutable` (تخزين مؤقت لمدة عام كامل للملفات المهشّمة).

### ج. ملفات `tsconfig.json` و `tsconfig.app.json`
- الهدف البرمجي: `target: "es2023"`.
- المكتبات المضمنة: `lib: ["ES2023", "DOM"]`.
- نمط التجميع: `moduleResolution: "bundler"`.
- تفعيل الوضع الصارم: `strict: true`, `noFallthroughCasesInSwitch: true`.
- محول JSX: `jsx: "react-jsx"`.

### د. ملف `index.html`
- يدعم التوافق مع 152-ФЗ بعدم استدعاء أي خطوط خارجية (Google Fonts) والاعتماد التام على حزمة خطوط النظام المحلية (`System Font Stack`).
- يحتوي على **هيكل تحميل ثابت فوري (Instant Static Shell)** مدمج بأنماط CSS داخلية لتوفير أول ظهور للمحتوى في أقل من 300 مللي ثانية (FCP < 300ms) حتى قبل انتهاء تحميل حزم الجافاسكريبت.

---

## 3. كتالوج متغيرات البيئة الكامل (Environment Variables Catalog)

يوثق الجدول التالي كافة المتغيرات المعتمدة في النظام، ونطاقها (واجهة مستخدم أو سيرفر)، والهدف الدقيق منها، وقيمتها الافتراضية عند غيابها:

| اسم المتغير (Variable Name) | النطاق (Scope) | نوع البيانات والصيغة | الوظيفة والدور التقني بالتفصيل | القيمة الافتراضية / السلوك عند الغياب |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_DATA_PROVIDER` | Client (Vite) | `'yandex' \| 'firebase'` | يحدد المحول الافتراضي لقاعدة البيانات في `DatabaseGateway`. | القيمة الافتراضية هي `'yandex'`. |
| `VITE_YANDEX_YDB_DOCAPI_ENDPOINT` | Client (Vite) | URL (`https://...`) | نقطة نهاية واجهة Document API لقاعدة بيانات Yandex YDB. | تستخدم القيمة الافتراضية الموجهة عبر البروكسي `/ydb-proxy`. |
| `VITE_YANDEX_STORAGE_ENDPOINT` | Client / Server | URL (`https://...`) | نقطة نهاية خادم تخزين الكائنات Yandex Object Storage. | `https://storage.yandexcloud.net`. |
| `VITE_YANDEX_STORAGE_BUCKET` | Client / Server | String (Bucket Name) | اسم الحاوية السحابية المخصصة لتخزين مستندات وصور المنصة. | `domexit-storage-vault`. |
| `VITE_YANDEX_ACCESS_KEY_ID` | Client / Server | String (Key ID) | معرف مفتاح الوصول الثابت (Static Access Key) لحساب خدمة Yandex Service Account. | يتم جلبه من متغيرات البيئة المشتركة. |
| `VITE_YANDEX_SECRET_ACCESS_KEY` | Client / Server | String (Secret Key) | المفتاح السري المشفر لحساب خدمة Yandex Cloud للتحقق وتوقيع AWS Signature v4. | يتم جلبه من متغيرات البيئة المشتركة. |
| `VITE_YANDEX_REGION` | Client / Server | String (`ru-central1`) | المنطقة الجغرافية لخوادم ياندكس السحابية داخل روسيا الاتحادية. | `ru-central1`. |
| `VITE_YANDEX_MAPS_API_KEY` | Client (Vite) | String (API Key) | مفتاح الربط الرسمي لمكتبة خرائط ياندكس الإصدار الثالث (`Yandex Maps JS API v3`). | ضروري لتحميل خريطة الكتالوج وخريطة تفاصيل العقار. |
| `VITE_YANDEX_GEOCODER_API_KEY` | Client (Vite) | String (API Key) | مفتاح واجهة الترميز الجغرافي (`Yandex Geocoder HTTP API`) لتحويل العناوين لإحداثيات. | يستخدم في نموذج إضافة العقار للبائع والتحقق من الموقع. |
| `VITE_YANDEX_SUGGEST_API_KEY` | Client (Vite) | String (API Key) | مفتاح واجهة الإكمال التلقائي لعناوين الشوارع ومحطات المترو (`Yandex Geosuggest API`). | يستخدم في مكون `AddressAutocompleteInput`. |
| `VITE_YANDEX_OAUTH_CLIENT_ID` | Client (Vite) | String (Client ID) | المعرف العام لتطبيق تسجيل الدخول الموحد ببطاقة الهوية الروسية (`Yandex ID OAuth 2.0`). | يستخدم في نافذة تسجيل الدخول `AuthModal`. |
| `VITE_YANDEX_OAUTH_REDIRECT_URI` | Client (Vite) | URL (`https://...`) | رابط إعادة التوجيه المعتمد بعد إتمام المصادقة عبر بوابة Yandex ID. | `https://domexit-official.netlify.app`. |
| `YANDEX_ACCESS_KEY_ID` | Server (Netlify) | String (Key ID) | متغير الخادم المطابق لـ `VITE_YANDEX_ACCESS_KEY_ID` المستخدم داخل الدوال السحابية. | احتياطي لمفتاح السيرفر. |
| `YANDEX_SECRET_ACCESS_KEY` | Server (Netlify) | String (Secret Key) | متغير الخادم المطابق لـ `VITE_YANDEX_SECRET_ACCESS_KEY` داخل الدوال السحابية. | احتياطي للمفتاح السري. |
| `YANDEX_STORAGE_BUCKET` | Server (Netlify) | String (Bucket Name) | متغير الخادم لاسم حاوية التخزين في دوال `s3-upload` و `s3-download`. | `domexit-storage-vault`. |
| `YANDEX_STORAGE_ENDPOINT` | Server (Netlify) | URL (`https://...`) | متغير الخادم لنقطة نهاية التخزين في الدوال السحابية. | `https://storage.yandexcloud.net`. |
| `YANDEX_REGION` | Server (Netlify) | String (`ru-central1`) | متغير الخادم لمنطقة التخزين السحابي الروسية. | `ru-central1`. |
| `DEV` | Client (Vite) | Boolean (`true \| false`) | متغير داخلي من Vite يحدد ما إذا كان التطبيق يعمل في وضع التطوير المحلي أو الإنتاج. | يحدد تفعيل السجلات ومحاكاة المعاملات المحلية. |
