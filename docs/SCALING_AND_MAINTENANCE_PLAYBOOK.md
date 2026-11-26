# دليل التوسع والصيانة التشغيلية (Scaling & Maintenance Playbook) — DomExit

**البيئة الإنتاجية:** `https://domexit.ru` (`etnckg937628mnid7tnb`)  
**بيئة الاختبار:** `Staging` (`etnkpeqnbmb1a6cocipk`)  
**المنطقة السحابية:** `ru-central1` (`b1g46uad3gc3h34k5b0f`)

---

## 1. التنبيه اليدوي الوحيد الحرج قبل `12.01.2027` (إلزامي من وحدة تحكم Yandex Cloud)

تنتهي المنحة الابتدائية (`4 000 ₽`) في **`12.01.2027`**، والرصيد النقدي الحالي `0,00 ₽`. لتفادي توقف `Cloud DNS`, `API Gateway` أو `YDB` تلقائياً:
1. افتح **Yandex Cloud Billing -> Payment methods** واربط بطاقة/حساب سداد فعّال.
2. أنشئ **3 تنبيهات ميزانية (Budgets & Alerts)** على المجلد `b1g46uad3gc3h34k5b0f`:
   - **إنذار مبكر:** `500 ₽/شهر` (تنبيه بريد عند 80% و100%).
   - **إنذار نمو متوسط:** `1,500 ₽/شهر`.
   - **سقف أمان أعلى:** `5,000 ₽/شهر`.

---

## 2. مصفوفة قرارات النمو الـ 9 وإشارات التفعيل الدقيقة

| # | القرار الهندسي | إشارة التفعيل الدقيقة (Trigger) | الإجراء المطلوب |
| :-: | :--- | :--- | :--- |
| **1** | **تفعيل `Yandex Cloud CDN` (`cdn.domexit.ru`)** | طلبات الأصول الثابتة > **`1.1M` طلب/شهر** أو ~**5,000 MAU** | إنشاء CDN-resource أمام `domexit-web-prod` / `domexit-storage-vault`، ضبط `CNAME cdn.domexit.ru`، والبناء بـ `VITE_CDN_BASE_URL=https://cdn.domexit.ru` (الأصول والصور مهيأة مسبقاً عبر `vite.config.ts` و`src/utils/cdnUrl.ts`). |
| **2** | **إضافة كاش موزع (`Managed Valkey / Redis`)** | تجاوز `5,000 MAU` أو ملاحظة انخفاض Cache Hit في `appCache` بسبب التوسع الأفقي لعدة حاويات Cloud Function | استبدال `InMemoryLruCache` عبر واجهة `CacheAdapter` في `backend/src/lib/cache.ts` بعميل `Valkey` داخل نفس الـ VPC. |
| **3** | **ترقية YDB إلى جداول `*_v2` مفهرسة بـ `GSIs` وحذف `v1`** | نمو جداول الفئة A (`lots`, `buyer_applications`, `deals`, `audit_logs`) > **`1,000` سجل** أو ارتفاع استهلاك RU | إنشاء جداول `*_v2` مع `GlobalSecondaryIndexes` عبر `CreateTable` + Backfill + تفعيل `queryByIndex` و`LastEvaluatedKey`، ثم حذف جداول `v1` القديمة بعد 14 يوماً من الاستقرار. |
| **4** | **ضبط نافذة `goldExclusiveHours` للدروب** | عند ارتفاع نسبة المشترين Gold > 25% أو بطء تصريف المخزون | ضبط `goldExclusiveHours` من `0` إلى `12–24` ساعة في إعدادات запуск Дропа (`/admin/matchmaker`) لإعطاء أولوية حصرية لـ Gold قبل موجة Silver. |
| **5** | **ترقية ПЭП من OTP بريد/تليجرام إلى SMS OTP مدفوع** | عند متطلبات قانونية لبنوك شريكة محددة أو > 500 صفقة/شهر | تفعيل مزود SMS روسي (مثل SMS.ru / MTS Exolve) في قناة `deliveryChannel: 'sms'` بجانب Email/Telegram. |
| **6** | **معالجة `Cold Start` لـ Cloud Functions** | ارتفاع زمن P95 لأول طلب بعد خمول > `1,500ms` | تقليص حزم الاستيراد أو تفعيل Provisioned Concurrency (1 حاوية دافئة) في ساعات الذروة. |
| **7** | **الترحيل الجزئي إلى `YQL / Native YDB SDK`** | تجاوز **50,000–100,000 MAU** أو الحاجة لاستعلامات مدى/تجميع معقدة (`RANGE + SUM/COUNT`) | نقل استعلامات التحليلات الثقيلة والفلاتر المركبة إلى جداول YQL علائقية عبر YDB Native SDK. |
| **8** | **تفعيل `Cloud Monitoring` وإجراء `Restore Drill`** | شهرياً (أو قبل أي إطلاق تسويقي كبير) | ضبط لوحات مراقبة لأخطاء 5xx، زمن تنفيذ Functions، واستهلاك YDB RU؛ واختبار استعادة نسخة احتياطية من `domexit-private-docs-prod/_backups/ydb/daily/*` إلى قاعدة `Staging` ربع سنوياً. |
| **9** | **أرشفة `audit_logs` التاريخية** | تجاوز جدول `audit_logs` **`50,000` سجل** أو اقتراب حجم YDB من `1 GB` | تصدير السجلات الأقدم من 180 يوماً إلى `domexit-private-docs-prod/_archive/audit_logs/` (يُرحّل تلقائياً عبر Lifecycle إلى `COLD/ICE`) وحذفها من YDB. |

---

## 3. سياسة Lifecycle وتنظيف الأصول في S3 (مطبّقة آلياً)
- **دلاء المستندات الخاصة (`domexit-private-docs-prod`, `domexit-private-docs-staging`):**
  - `_backups/` -> الانتقال إلى `COLD` بعد **90 يوماً**.
  - `_journal/` -> الانتقال إلى `COLD` بعد **90 يوماً** وإلى `ICE` بعد **180 يوماً**.
  - تنظيف الرفع غير المكتمل `AbortIncompleteMultipartUpload` بعد **7 أيام**.
- **دلاء الويب والصور (`domexit-web-*`, `domexit-storage-vault`, `domexit-public-photos-staging`):**
  - `AbortIncompleteMultipartUpload` بعد **7 أيام**.
  - سكربتات `deploy-web-staging.cjs` و`deploy-web-prod.cjs` تحذف تلقائياً أصول `assets/` القديمة غير الموجودة في `dist/` الحالي والتي يتجاوز عمرها **14 يوماً** (أو > 24 ساعة عند تمرير `--prune-all-stale`).

---

## 4. قائمة التحقق للترقية الإنتاجية القادمة إلى `https://domexit.ru`
1. التحقق من اجتياز جميع اختبارات `Staging` (`master-e2e-verify.mjs` واختبارات Playwright/Chrome) بـ 0 أخطاء.
2. عمل نسخة احتياطية قبل الترقية عبر `backup-prod-ydb.mjs` (دون لمس أي بيانات مستخدمين).
3. بناء ونشر الخادم: `node backend/scripts/deploy-prod.mjs --confirm-prod`.
4. بناء ونشر الواجهة مع تقليم الأصول القديمة: `node infrastructure/scripts/deploy-web-prod.cjs --confirm-prod`.
5. نشر المجدول المحدث (`256m`): `node backend/scripts/deploy-sweeper-prod.mjs --confirm-prod`.
6. تشغيل فحص القراءة فقط على الإنتاج: `npm run verify:prod` والتأكد من `GET https://domexit.ru/api/health` (`200 OK`).
