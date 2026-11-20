# الفصل 3: شجرة الدلائل والجرد الشامل لملفات المشروع (Directory Tree & File Inventory)

## 1. الشجرة الكاملة للمشروع بنسبة 100% (Complete Directory Tree)

`	ext
├── .claude\state\vscode\windows.json
├── .hurc-harness\state\session\index.json
├── .netlify\functions\manifest.json
├── .netlify\netlify.toml
├── .netlify\state.json
├── .oxlintrc.json
├── db_performance_indexes.sql
├── index.html
├── netlify\functions\s3-download.ts
├── netlify\functions\s3-upload.ts
├── netlify.toml
├── package-lock.json
├── package.json
├── scripts\append_missing_raw_contents.py
├── scripts\executeProductionPurge.ts
├── scripts\purgeAndSegregateFirestore.ts
├── scripts\seed_26_legal_documents.py
├── security_rls_policies.sql
├── src\App.css
├── src\App.tsx
├── src\components\admin\LegalCmsManager.tsx
├── src\components\auth\AdminRouteGuard.tsx
├── src\components\auth\AuthModal.tsx
├── src\components\booking\BookingModal.tsx
├── src\components\catalog\AdvancedFilterDrawer.tsx
├── src\components\catalog\LotCard.tsx
├── src\components\catalog\QuickMatchModal.tsx
├── src\components\chat\CuratorChatWidget.tsx
├── src\components\chat\EscrowBridgeChatModal.tsx
├── src\components\common\BankGatewayErrorBoundary.tsx
├── src\components\common\Skeletons.tsx
├── src\components\common\VirtualizedList.tsx
├── src\components\compliance\ConsentCheckboxes.tsx
├── src\components\compliance\ConsentGateModal.tsx
├── src\components\compliance\CookieConsentBanner.tsx
├── src\components\documents\DocumentVaultModal.tsx
├── src\components\layout\AdminHeader.tsx
├── src\components\layout\AdminSidebar.tsx
├── src\components\layout\PublicLayout.tsx
├── src\components\layout\UnifiedFooter.tsx
├── src\components\layout\UnifiedNavbar.tsx
├── src\components\legal\SmartLegalDocumentView.tsx
├── src\components\lot\PublicLegalReportModal.tsx
├── src\components\lot\SmartMortgageCalculator.tsx
├── src\components\maps\AddressAutocompleteInput.tsx
├── src\components\maps\YandexCatalogMap.tsx
├── src\components\maps\YandexLotMap.tsx
├── src\components\profile\UserProfileModal.tsx
├── src\components\seo\JsonLdStructuredData.tsx
├── src\components\vip\VipSubscriptionModal.tsx
├── src\context\AuthContext.tsx
├── src\dal\adapters\FirebaseAdapter.ts
├── src\dal\adapters\YandexCloudAdapter.ts
├── src\dal\cache\requestDeduplicator.ts
├── src\dal\cache\SWRCache.ts
├── src\dal\config\collectionResolver.ts
├── src\dal\DatabaseGateway.ts
├── src\dal\firebase.ts
├── src\dal\initializer.ts
├── src\dal\interfaces\IDatabaseAdapter.ts
├── src\dal\interfaces\IStorageAdapter.ts
├── src\dal\repositories\AnalyticsRepository.ts
├── src\dal\repositories\AuditLogsRepository.ts
├── src\dal\repositories\BankPortalRepository.ts
├── src\dal\repositories\CandidatesRepository.ts
├── src\dal\repositories\CompanyProfileRepository.ts
├── src\dal\repositories\CuratorChatRepository.ts
├── src\dal\repositories\DealsRepository.ts
├── src\dal\repositories\DevelopersRepository.ts
├── src\dal\repositories\EmployeesRepository.ts
├── src\dal\repositories\EscrowBridgeRepository.ts
├── src\dal\repositories\FAQRepository.ts
├── src\dal\repositories\InvestorClubRepository.ts
├── src\dal\repositories\KnowledgeRepository.ts
├── src\dal\repositories\LegalPoliciesRepository.ts
├── src\dal\repositories\LegalRepository.ts
├── src\dal\repositories\LotsRepository.ts
├── src\dal\repositories\MarketSettingsRepository.ts
├── src\dal\repositories\PartnerRequestsRepository.ts
├── src\dal\repositories\PartnersRepository.ts
├── src\dal\repositories\PublicChannelsRepository.ts
├── src\dal\repositories\SecurityIncidentsRepository.ts
├── src\dal\repositories\SellerRequestsRepository.ts
├── src\dal\repositories\UserConsentsRepository.ts
├── src\dal\repositories\UsersRepository.ts
├── src\dal\scripts\initYandexTables.ts
├── src\dal\scripts\migrateToSandbox.ts
├── src\dal\seedData.ts
├── src\dal\StorageService.ts
├── src\dal\telemetry\securityLogger.ts
├── src\dal\telemetry\slowQueryTracer.ts
├── src\data\legalAuditAxes.ts
├── src\data\russianBanks.ts
├── src\data\russianGeography.ts
├── src\hooks\useDebounce.ts
├── src\hooks\useStreamingResponse.ts
├── src\i18n\LanguageContext.tsx
├── src\i18n\translations.ts
├── src\index.css
├── src\main.tsx
├── src\pages\AdminArchiveLogsPage.tsx
├── src\pages\AdminBrokersPage.tsx
├── src\pages\AdminClosingPage.tsx
├── src\pages\AdminCuratorProfilePage.tsx
├── src\pages\AdminDashboardPage.tsx
├── src\pages\AdminInvestorsPage.tsx
├── src\pages\AdminLegalAuditPage.tsx
├── src\pages\AdminMatchmakerPage.tsx
├── src\pages\AdminPackagingPage.tsx
├── src\pages\AdminPartnersBotPage.tsx
├── src\pages\AdminPipelinePage.tsx
├── src\pages\BankPortalPage.tsx
├── src\pages\ClientPortalPage.tsx
├── src\pages\ClientTrackerPage.tsx
├── src\pages\HomePage.tsx
├── src\pages\HowItWorksPage.tsx
├── src\pages\InvestorsPage.tsx
├── src\pages\knowledge\ArticleDetailPage.tsx
├── src\pages\knowledge\FAQPage.tsx
├── src\pages\knowledge\KnowledgeHubPage.tsx
├── src\pages\legal\ConsentAdsPage.tsx
├── src\pages\legal\ConsentDistributionPage.tsx
├── src\pages\legal\ConsentPdPage.tsx
├── src\pages\legal\LegalArchivePage.tsx
├── src\pages\legal\LegalArchiveSnapshotPage.tsx
├── src\pages\legal\LegalDocumentReaderPage.tsx
├── src\pages\legal\LegalIndexPage.tsx
├── src\pages\legal\PrivacyPolicyPage.tsx
├── src\pages\legal\TermsOfServicePage.tsx
├── src\pages\LotDetailsPage.tsx
├── src\pages\OpportunitiesPage.tsx
├── src\pages\PartnersPublicPage.tsx
├── src\pages\SellersPage.tsx
├── src\pages\StoryPage.tsx
├── src\pages\VerifyCertificatePage.tsx
├── src\pages\VipCatalogPage.tsx
├── src\services\propertyLifecycleService.ts
├── src\services\yandexMapsService.ts
├── src\store\useEnvironmentStore.ts
├── src\store\useFeatureFlagsStore.ts
├── src\stores\useCompanyProfileStore.ts
├── src\stores\useEnvironmentStore.ts
├── src\stores\useFeatureFlagsStore.ts
├── src\stores\usePlatformSettingsStore.ts
├── src\stores\usePublicChannelsStore.ts
├── src\types\index.ts
├── src\types\legal.ts
├── src\types\ymaps3.d.ts
├── src\utils\asyncGuard.ts
├── src\utils\crypto.ts
├── src\utils\dataMasking.ts
├── src\utils\downloadManager.ts
├── src\utils\fetchWithTimeout.ts
├── src\utils\fileManager.ts
├── src\utils\fileSignatureValidator.ts
├── src\utils\formatters.ts
├── src\utils\imageOptimizer.ts
├── src\utils\nonBlockingQueue.ts
├── src\utils\rateLimiter.ts
├── src\utils\referralTracker.ts
├── src\utils\sanitizer.ts
├── src\utils\securityGuards.ts
├── src\utils\useMarketSettings.ts
├── src\utils\validators.ts
├── src\utils\webVitals.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
`

---

## 2. جدول الجرد الشامل لكافة ملفات المشروع (File-by-File Technical Inventory)

يتضمن هذا الجدول توصيفاً دقيقاً لكل ملف مصدري في المشروع مع عدد الأسطر، الدور الوظيفي، وأهم ما يصدره (Exports):

| المسار (File Path) | الأسطر (Lines) | الوظيفة التقنية الدقيقة (Role & Purpose) | الصادرات الرئيسية (Key Exports) |
| :--- | :--- | :--- | :--- |
| .claude\state\vscode\windows.json | 3 | ملف مصدري مساند في بنية المشروع. | None |
| .hurc-harness\state\session\index.json | 6 | ملف مصدري مساند في بنية المشروع. | None |
| .netlify\functions\manifest.json | 1 | ملف مصدري مساند في بنية المشروع. | None |
| .netlify\netlify.toml | 209 | إعدادات نشر Netlify، درع حماية الملفات، ترويسات الأمان CSP، وإعادة التوجيه. | None |
| .netlify\state.json | 4 | ملف مصدري مساند في بنية المشروع. | None |
| .oxlintrc.json | 9 | ملف مصدري مساند في بنية المشروع. | None |
| db_performance_indexes.sql | 57 | ملف مصدري مساند في بنية المشروع. | None |
| index.html | 51 | وثيقة HTML الجذرية وهيكل التحميل الثابت الفوري FCP < 300ms. | None |
| netlify\functions\s3-download.ts | 162 | ملف مصدري مساند في بنية المشروع. | handler |
| netlify\functions\s3-upload.ts | 152 | ملف مصدري مساند في بنية المشروع. | handler |
| netlify.toml | 103 | إعدادات نشر Netlify، درع حماية الملفات، ترويسات الأمان CSP، وإعادة التوجيه. | None |
| package-lock.json | 4171 | ملف مصدري مساند في بنية المشروع. | None |
| package.json | 39 | بيان تعريف المشروع والحزم والتبعيات وأوامر التشغيل والبناء. | None |
| scripts\append_missing_raw_contents.py | 170 | ملف مصدري مساند في بنية المشروع. | LegalRepository, LegalRepository, LegalRepository |
| scripts\executeProductionPurge.ts | 282 | ملف مصدري مساند في بنية المشروع. | None |
| scripts\purgeAndSegregateFirestore.ts | 273 | ملف مصدري مساند في بنية المشروع. | None |
| scripts\seed_26_legal_documents.py | 852 | ملف مصدري مساند في بنية المشروع. | INITIAL_LEGAL_DOCUMENTS, INITIAL_LEGAL_DOCUMENTS, INITIAL_LEGAL_RAW_CONTENTS |
| security_rls_policies.sql | 163 | ملف مصدري مساند في بنية المشروع. | None |
| src\App.css | 185 | ملف مصدري مساند في بنية المشروع. | None |
| src\App.tsx | 198 | ملف مصدري مساند في بنية المشروع. | App, App, default |
| src\components\admin\LegalCmsManager.tsx | 1263 | ملف مصدري مساند في بنية المشروع. | LegalCmsManager |
| src\components\auth\AdminRouteGuard.tsx | 141 | ملف مصدري مساند في بنية المشروع. | AdminRouteGuard |
| src\components\auth\AuthModal.tsx | 498 | ملف مصدري مساند في بنية المشروع. | AuthModal |
| src\components\booking\BookingModal.tsx | 608 | ملف مصدري مساند في بنية المشروع. | BookingModal |
| src\components\catalog\AdvancedFilterDrawer.tsx | 480 | ملف مصدري مساند في بنية المشروع. | AdvancedFilterDrawer |
| src\components\catalog\LotCard.tsx | 239 | ملف مصدري مساند في بنية المشروع. | LotCardComponent, LotCard |
| src\components\catalog\QuickMatchModal.tsx | 240 | ملف مصدري مساند في بنية المشروع. | QuickMatchModal |
| src\components\chat\CuratorChatWidget.tsx | 332 | ملف مصدري مساند في بنية المشروع. | CuratorChatWidget |
| src\components\chat\EscrowBridgeChatModal.tsx | 419 | ملف مصدري مساند في بنية المشروع. | EscrowBridgeChatModal |
| src\components\common\BankGatewayErrorBoundary.tsx | 89 | ملف مصدري مساند في بنية المشروع. | BankGatewayErrorBoundary |
| src\components\common\Skeletons.tsx | 151 | ملف مصدري مساند في بنية المشروع. | PageSkeletonLoader, LotCardSkeleton, LotDetailsSkeleton, TableSkeleton... |
| src\components\common\VirtualizedList.tsx | 81 | ملف مصدري مساند في بنية المشروع. | VirtualizedList |
| src\components\compliance\ConsentCheckboxes.tsx | 120 | ملف مصدري مساند في بنية المشروع. | ConsentState, ConsentCheckboxes |
| src\components\compliance\ConsentGateModal.tsx | 197 | ملف مصدري مساند في بنية المشروع. | ConsentGateModal |
| src\components\compliance\CookieConsentBanner.tsx | 269 | ملف مصدري مساند في بنية المشروع. | CookieConsentBanner |
| src\components\documents\DocumentVaultModal.tsx | 719 | ملف مصدري مساند في بنية المشروع. | DocumentVaultModal |
| src\components\layout\AdminHeader.tsx | 188 | ملف مصدري مساند في بنية المشروع. | AdminHeader |
| src\components\layout\AdminSidebar.tsx | 317 | ملف مصدري مساند في بنية المشروع. | AdminSidebar |
| src\components\layout\PublicLayout.tsx | 19 | ملف مصدري مساند في بنية المشروع. | PublicLayout |
| src\components\layout\UnifiedFooter.tsx | 218 | ملف مصدري مساند في بنية المشروع. | UnifiedFooter |
| src\components\layout\UnifiedNavbar.tsx | 569 | ملف مصدري مساند في بنية المشروع. | UnifiedNavbar |
| src\components\legal\SmartLegalDocumentView.tsx | 548 | ملف مصدري مساند في بنية المشروع. | SmartLegalDocumentView |
| src\components\lot\PublicLegalReportModal.tsx | 230 | ملف مصدري مساند في بنية المشروع. | PublicLegalReportModal |
| src\components\lot\SmartMortgageCalculator.tsx | 675 | ملف مصدري مساند في بنية المشروع. | SmartMortgageCalculator |
| src\components\maps\AddressAutocompleteInput.tsx | 212 | ملف مصدري مساند في بنية المشروع. | AddressAutocompleteInput |
| src\components\maps\YandexCatalogMap.tsx | 381 | ملف مصدري مساند في بنية المشروع. | YandexCatalogMap |
| src\components\maps\YandexLotMap.tsx | 244 | ملف مصدري مساند في بنية المشروع. | YandexLotMap |
| src\components\profile\UserProfileModal.tsx | 773 | ملف مصدري مساند في بنية المشروع. | UserProfileModal |
| src\components\seo\JsonLdStructuredData.tsx | 39 | ملف مصدري مساند في بنية المشروع. | JsonLdStructuredData |
| src\components\vip\VipSubscriptionModal.tsx | 464 | ملف مصدري مساند في بنية المشروع. | VipSubscriptionModal |
| src\context\AuthContext.tsx | 1093 | ملف مصدري مساند في بنية المشروع. | MASTER_OWNER_EMAILS, TEST_STAFF_EMAILS, DEMO_PASSWORD, AuthProvider... |
| src\dal\adapters\FirebaseAdapter.ts | 261 | ملف مصدري مساند في بنية المشروع. | FirebaseDatabaseAdapter, firebaseAdapterInstance |
| src\dal\adapters\YandexCloudAdapter.ts | 633 | ملف مصدري مساند في بنية المشروع. | YandexCloudDatabaseAdapter, YandexCloudAdapter |
| src\dal\cache\requestDeduplicator.ts | 31 | ملف مصدري مساند في بنية المشروع. | requestDeduplicator |
| src\dal\cache\SWRCache.ts | 190 | ملف مصدري مساند في بنية المشروع. | swrCache |
| src\dal\config\collectionResolver.ts | 63 | ملف مصدري مساند في بنية المشروع. | ISOLATED_COLLECTIONS, resolveCollectionName, isIsolatedCollection |
| src\dal\DatabaseGateway.ts | 158 | ملف مصدري مساند في بنية المشروع. | DatabaseGateway |
| src\dal\firebase.ts | 37 | ملف مصدري مساند في بنية المشروع. | None |
| src\dal\initializer.ts | 159 | ملف مصدري مساند في بنية المشروع. | DatabaseInitializer |
| src\dal\interfaces\IDatabaseAdapter.ts | 35 | ملف مصدري مساند في بنية المشروع. | IDatabaseAdapter |
| src\dal\interfaces\IStorageAdapter.ts | 54 | ملف مصدري مساند في بنية المشروع. | UploadDocumentParams, IStorageService, IStorageAdapter |
| src\dal\repositories\AnalyticsRepository.ts | 90 | ملف مصدري مساند في بنية المشروع. | AnalyticsRepository |
| src\dal\repositories\AuditLogsRepository.ts | 149 | ملف مصدري مساند في بنية المشروع. | AuditLogsRepository |
| src\dal\repositories\BankPortalRepository.ts | 382 | ملف مصدري مساند في بنية المشروع. | BankPortalRepository |
| src\dal\repositories\CandidatesRepository.ts | 337 | ملف مصدري مساند في بنية المشروع. | CandidatesRepository |
| src\dal\repositories\CompanyProfileRepository.ts | 46 | ملف مصدري مساند في بنية المشروع. | DEFAULT_COMPANY_LEGAL_PROFILE, CompanyProfileRepository |
| src\dal\repositories\CuratorChatRepository.ts | 144 | ملف مصدري مساند في بنية المشروع. | CuratorChatRepository |
| src\dal\repositories\DealsRepository.ts | 333 | ملف مصدري مساند في بنية المشروع. | DealsRepository |
| src\dal\repositories\DevelopersRepository.ts | 1222 | ملف مصدري مساند في بنية المشروع. | PARTNER_BANKS, RUSSIAN_TOP_DEVELOPERS, INITIAL_ACCREDITED_DEVELOPERS, INITIAL_DEVELOPER_ACCREDITATION_REQUESTS... |
| src\dal\repositories\EmployeesRepository.ts | 112 | ملف مصدري مساند في بنية المشروع. | PROD_SYSTEM_EMPLOYEES, EmployeesRepository |
| src\dal\repositories\EscrowBridgeRepository.ts | 110 | ملف مصدري مساند في بنية المشروع. | EscrowBridgeRepository |
| src\dal\repositories\FAQRepository.ts | 199 | ملف مصدري مساند في بنية المشروع. | INITIAL_FAQ_ITEMS, FAQRepository |
| src\dal\repositories\InvestorClubRepository.ts | 205 | ملف مصدري مساند في بنية المشروع. | InvestorClubRepository |
| src\dal\repositories\KnowledgeRepository.ts | 523 | ملف مصدري مساند في بنية المشروع. | INITIAL_KNOWLEDGE_ARTICLES, KnowledgeRepository |
| src\dal\repositories\LegalPoliciesRepository.ts | 295 | ملف مصدري مساند في بنية المشروع. | CANONICAL_POLICY_NAMES, INITIAL_POLICY_TEXTS, LegalPoliciesRepository |
| src\dal\repositories\LegalRepository.ts | 1451 | ملف مصدري مساند في بنية المشروع. | DEFAULT_LEGAL_SETTINGS, substituteLegalVariables, INITIAL_LEGAL_DOCUMENTS, INITIAL_LEGAL_RAW_CONTENTS... |
| src\dal\repositories\LotsRepository.ts | 892 | ملف مصدري مساند في بنية المشروع. | LotsRepository |
| src\dal\repositories\MarketSettingsRepository.ts | 307 | ملف مصدري مساند في بنية المشروع. | DEFAULT_DISTRICT_YIELD_CONFIGS, MarketSettingsRepository |
| src\dal\repositories\PartnerRequestsRepository.ts | 148 | ملف مصدري مساند في بنية المشروع. | PartnerRequestsRepository |
| src\dal\repositories\PartnersRepository.ts | 226 | ملف مصدري مساند في بنية المشروع. | PartnersRepository |
| src\dal\repositories\PublicChannelsRepository.ts | 41 | ملف مصدري مساند في بنية المشروع. | DEFAULT_PUBLIC_CHANNELS, PublicChannelsRepository |
| src\dal\repositories\SecurityIncidentsRepository.ts | 63 | ملف مصدري مساند في بنية المشروع. | SecurityIncidentsRepository |
| src\dal\repositories\SellerRequestsRepository.ts | 212 | ملف مصدري مساند في بنية المشروع. | SubmitSellerExitParams, SellerRequestsRepository |
| src\dal\repositories\UserConsentsRepository.ts | 89 | ملف مصدري مساند في بنية المشروع. | UserConsentsRepository |
| src\dal\repositories\UsersRepository.ts | 197 | ملف مصدري مساند في بنية المشروع. | PROD_SYSTEM_USERS, UsersRepository |
| src\dal\scripts\initYandexTables.ts | 328 | ملف مصدري مساند في بنية المشروع. | YANDEX_REQUIRED_TABLES, YandexCredentialsConfig, getYandexCredentials, toDynamoAttribute... |
| src\dal\scripts\migrateToSandbox.ts | 301 | ملف مصدري مساند في بنية المشروع. | PROD_SYSTEM_USERS, PROD_SYSTEM_EMPLOYEES |
| src\dal\seedData.ts | 1705 | ملف مصدري مساند في بنية المشروع. | initialLots, initialSellerRequests, initialCandidates, initialPartners... |
| src\dal\StorageService.ts | 598 | ملف مصدري مساند في بنية المشروع. | SELLER_MANDATORY_DOC_SLOTS, StorageService |
| src\dal\telemetry\securityLogger.ts | 73 | ملف مصدري مساند في بنية المشروع. | SecurityEventType, SecurityIncident, securityLogger |
| src\dal\telemetry\slowQueryTracer.ts | 75 | ملف مصدري مساند في بنية المشروع. | QueryTraceRecord, queryTracer |
| src\data\legalAuditAxes.ts | 98 | ملف مصدري مساند في بنية المشروع. | DEFAULT_LEGAL_AUDIT_AXES, HONEST_STATUS_CONFIG, resolveLotLegalAxes |
| src\data\russianBanks.ts | 41 | ملف مصدري مساند في بنية المشروع. | RussianBankInfo, RUSSIAN_BANKS, DEFAULT_SETTLEMENT_BANKS |
| src\data\russianGeography.ts | 549 | ملف مصدري مساند في بنية المشروع. | DistrictGeoConfig, RussianRegionConfig, RUSSIAN_REGIONS, getRegionByCode... |
| src\hooks\useDebounce.ts | 22 | ملف مصدري مساند في بنية المشروع. | useDebounce |
| src\hooks\useStreamingResponse.ts | 58 | ملف مصدري مساند في بنية المشروع. | useStreamingResponse |
| src\i18n\LanguageContext.tsx | 45 | ملف مصدري مساند في بنية المشروع. | LanguageProvider, useLanguage |
| src\i18n\translations.ts | 283 | ملف مصدري مساند في بنية المشروع. | TranslationDict, translations |
| src\index.css | 85 | ملف مصدري مساند في بنية المشروع. | None |
| src\main.tsx | 11 | ملف مصدري مساند في بنية المشروع. | None |
| src\pages\AdminArchiveLogsPage.tsx | 599 | ملف مصدري مساند في بنية المشروع. | AdminArchiveLogsPage |
| src\pages\AdminBrokersPage.tsx | 820 | ملف مصدري مساند في بنية المشروع. | AdminBrokersPage |
| src\pages\AdminClosingPage.tsx | 970 | ملف مصدري مساند في بنية المشروع. | AdminClosingPage |
| src\pages\AdminCuratorProfilePage.tsx | 571 | ملف مصدري مساند في بنية المشروع. | AdminCuratorProfilePage |
| src\pages\AdminDashboardPage.tsx | 5471 | ملف مصدري مساند في بنية المشروع. | AdminDashboardPage |
| src\pages\AdminInvestorsPage.tsx | 677 | ملف مصدري مساند في بنية المشروع. | AdminInvestorsPage |
| src\pages\AdminLegalAuditPage.tsx | 1501 | ملف مصدري مساند في بنية المشروع. | AdminLegalAuditPage |
| src\pages\AdminMatchmakerPage.tsx | 695 | ملف مصدري مساند في بنية المشروع. | AdminMatchmakerPage |
| src\pages\AdminPackagingPage.tsx | 1597 | ملف مصدري مساند في بنية المشروع. | AdminPackagingPage |
| src\pages\AdminPartnersBotPage.tsx | 1457 | ملف مصدري مساند في بنية المشروع. | AdminPartnersBotPage |
| src\pages\AdminPipelinePage.tsx | 1022 | ملف مصدري مساند في بنية المشروع. | AdminPipelinePage |
| src\pages\BankPortalPage.tsx | 3506 | ملف مصدري مساند في بنية المشروع. | BankPortalPage, BankPortalPage, default |
| src\pages\ClientPortalPage.tsx | 2495 | ملف مصدري مساند في بنية المشروع. | ClientPortalPage |
| src\pages\ClientTrackerPage.tsx | 834 | ملف مصدري مساند في بنية المشروع. | ClientTrackerPage |
| src\pages\HomePage.tsx | 740 | ملف مصدري مساند في بنية المشروع. | HomePage |
| src\pages\HowItWorksPage.tsx | 527 | ملف مصدري مساند في بنية المشروع. | HowItWorksPage |
| src\pages\InvestorsPage.tsx | 12 | ملف مصدري مساند في بنية المشروع. | InvestorsPage |
| src\pages\knowledge\ArticleDetailPage.tsx | 415 | ملف مصدري مساند في بنية المشروع. | ArticleDetailPage |
| src\pages\knowledge\FAQPage.tsx | 314 | ملف مصدري مساند في بنية المشروع. | FAQPage |
| src\pages\knowledge\KnowledgeHubPage.tsx | 288 | ملف مصدري مساند في بنية المشروع. | KnowledgeHubPage |
| src\pages\legal\ConsentAdsPage.tsx | 97 | ملف مصدري مساند في بنية المشروع. | ConsentAdsPage |
| src\pages\legal\ConsentDistributionPage.tsx | 95 | ملف مصدري مساند في بنية المشروع. | ConsentDistributionPage |
| src\pages\legal\ConsentPdPage.tsx | 115 | ملف مصدري مساند في بنية المشروع. | ConsentPdPage |
| src\pages\legal\LegalArchivePage.tsx | 316 | ملف مصدري مساند في بنية المشروع. | LegalArchivePage |
| src\pages\legal\LegalArchiveSnapshotPage.tsx | 110 | ملف مصدري مساند في بنية المشروع. | LegalArchiveSnapshotPage |
| src\pages\legal\LegalDocumentReaderPage.tsx | 99 | ملف مصدري مساند في بنية المشروع. | LegalDocumentReaderPage |
| src\pages\legal\LegalIndexPage.tsx | 295 | ملف مصدري مساند في بنية المشروع. | LegalIndexPage |
| src\pages\legal\PrivacyPolicyPage.tsx | 258 | ملف مصدري مساند في بنية المشروع. | PrivacyPolicyPage |
| src\pages\legal\TermsOfServicePage.tsx | 155 | ملف مصدري مساند في بنية المشروع. | TermsOfServicePage |
| src\pages\LotDetailsPage.tsx | 1349 | ملف مصدري مساند في بنية المشروع. | LotDetailsPage |
| src\pages\OpportunitiesPage.tsx | 903 | ملف مصدري مساند في بنية المشروع. | OpportunitiesPage |
| src\pages\PartnersPublicPage.tsx | 414 | ملف مصدري مساند في بنية المشروع. | PartnersPublicPage |
| src\pages\SellersPage.tsx | 1975 | ملف مصدري مساند في بنية المشروع. | SellersPage |
| src\pages\StoryPage.tsx | 319 | ملف مصدري مساند في بنية المشروع. | StoryPage |
| src\pages\VerifyCertificatePage.tsx | 261 | ملف مصدري مساند في بنية المشروع. | VerifyCertificatePage |
| src\pages\VipCatalogPage.tsx | 447 | ملف مصدري مساند في بنية المشروع. | VipCatalogPage |
| src\services\propertyLifecycleService.ts | 631 | ملف مصدري مساند في بنية المشروع. | CreatePropertyAndDealPayload, PropertyLifecycleService |
| src\services\yandexMapsService.ts | 370 | ملف مصدري مساند في بنية المشروع. | loadYandexMapsScript, AddressSuggestion, GeocodeResult, haversineDistanceKm... |
| src\store\useEnvironmentStore.ts | 2 | ملف مصدري مساند في بنية المشروع. | None |
| src\store\useFeatureFlagsStore.ts | 2 | ملف مصدري مساند في بنية المشروع. | None |
| src\stores\useCompanyProfileStore.ts | 88 | ملف مصدري مساند في بنية المشروع. | useCompanyProfileStore |
| src\stores\useEnvironmentStore.ts | 110 | ملف مصدري مساند في بنية المشروع. | AppEnvironment, useEnvironmentStore |
| src\stores\useFeatureFlagsStore.ts | 117 | ملف مصدري مساند في بنية المشروع. | FeatureFlagsState, useFeatureFlagsStore |
| src\stores\usePlatformSettingsStore.ts | 328 | ملف مصدري مساند في بنية المشروع. | UnifiedPlatformSettings, DEFAULT_UNIFIED_SETTINGS, usePlatformSettingsStore |
| src\stores\usePublicChannelsStore.ts | 87 | ملف مصدري مساند في بنية المشروع. | usePublicChannelsStore |
| src\types\index.ts | 963 | ملف مصدري مساند في بنية المشروع. | Language, RussianCityCode, MetroStationInfo, RentalPotentialInfo... |
| src\types\legal.ts | 115 | ملف مصدري مساند في بنية المشروع. | LegalSocialLinks, LegalSettings, LegalDocumentCategory, LegalDocumentStage... |
| src\types\ymaps3.d.ts | 9 | ملف مصدري مساند في بنية المشروع. | None |
| src\utils\asyncGuard.ts | 61 | ملف مصدري مساند في بنية المشروع. | ASYNC_SAFETY_TIMEOUT_MS, ASYNC_NETWORK_TIMEOUT_MESSAGE, isValidInn, getInnValidationError |
| src\utils\crypto.ts | 24 | ملف مصدري مساند في بنية المشروع. | None |
| src\utils\dataMasking.ts | 55 | ملف مصدري مساند في بنية المشروع. | maskRussianPhone, maskEmail, maskFullName, maskContractNumber... |
| src\utils\downloadManager.ts | 322 | ملف مصدري مساند في بنية المشروع. | UnifiedDownloadOptions, DownloadTarget, showDownloadToast |
| src\utils\fetchWithTimeout.ts | 61 | ملف مصدري مساند في بنية المشروع. | withPromiseTimeout |
| src\utils\fileManager.ts | 111 | ملف مصدري مساند في بنية المشروع. | StoredDocument, FileManager |
| src\utils\fileSignatureValidator.ts | 95 | ملف مصدري مساند في بنية المشروع. | ValidationResult |
| src\utils\formatters.ts | 95 | ملف مصدري مساند في بنية المشروع. | formatRubles, formatNumberClean, formatPercent, cleanMathText... |
| src\utils\imageOptimizer.ts | 78 | ملف مصدري مساند في بنية المشروع. | None |
| src\utils\nonBlockingQueue.ts | 63 | ملف مصدري مساند في بنية المشروع. | None |
| src\utils\rateLimiter.ts | 77 | ملف مصدري مساند في بنية المشروع. | rateLimiter |
| src\utils\referralTracker.ts | 123 | ملف مصدري مساند في بنية المشروع. | initReferralTracker, getStoredReferralCode, setStoredReferralCode, clearStoredReferralCode... |
| src\utils\sanitizer.ts | 39 | ملف مصدري مساند في بنية المشروع. | sanitizeHtml, escapeHtml, sanitizeFileName |
| src\utils\securityGuards.ts | 119 | ملف مصدري مساند في بنية المشروع. | sanitizeReturnUrl, sanitizeUserRoleInput, checkSmsRateLimit, recordSmsSent... |
| src\utils\useMarketSettings.ts | 31 | ملف مصدري مساند في بنية المشروع. | useMarketSettings |
| src\utils\validators.ts | 187 | ملف مصدري مساند في بنية المشروع. | formatRussianPhoneInput, isValidRussianPhone, sanitizeDigitsOnly, validateIndividualInn... |
| src\utils\webVitals.ts | 102 | ملف مصدري مساند في بنية المشروع. | WebVitalsSummary, webVitalsMonitor |
| tsconfig.app.json | 28 | إعدادات تجميع تطبيق المتصفح وقواعد الصرامة البرمجية. | None |
| tsconfig.json | 8 | إعدادات مجمع لغة TypeScript الجذرية وإحالات المشاريع الفرعية. | None |
| tsconfig.node.json | 24 | ملف مصدري مساند في بنية المشروع. | None |
| vite.config.ts | 98 | إعدادات مجمع Vite وإضافات الضغط وتقسيم الحزم وإعدادات البروكسي. | defineConfig, default |
