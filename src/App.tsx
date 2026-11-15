import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { PublicLayout } from './components/layout/PublicLayout';

// Public User-Facing Pages (Interfaces 1 to 10 + Supplementary)
import { HomePage } from './pages/HomePage';
import { SellersPage } from './pages/SellersPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { VipCatalogPage } from './pages/VipCatalogPage';
import { LotDetailsPage } from './pages/LotDetailsPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { StoryPage } from './pages/StoryPage';
import { InvestorsPage } from './pages/InvestorsPage';
import { PartnersPublicPage } from './pages/PartnersPublicPage';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage';

// Unified Client Portal (Interface 11 & User Account)
import { ClientPortalPage } from './pages/ClientPortalPage';
import { ClientTrackerPage } from './pages/ClientTrackerPage';

// Admin, CRM & Operations Pages (Interfaces 12 to 18)
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminPipelinePage } from './pages/AdminPipelinePage';
import { AdminPackagingPage } from './pages/AdminPackagingPage';
import { AdminLegalAuditPage } from './pages/AdminLegalAuditPage';
import { AdminMatchmakerPage } from './pages/AdminMatchmakerPage';
import { AdminClosingPage } from './pages/AdminClosingPage';
import { AdminPartnersBotPage } from './pages/AdminPartnersBotPage';
import { AdminBrokersPage } from './pages/AdminBrokersPage';
import { initReferralTracker } from './utils/referralTracker';
import { BankPortalPage } from './pages/BankPortalPage';
import { BankGatewayErrorBoundary } from './components/common/BankGatewayErrorBoundary';
import { AdminArchiveLogsPage } from './pages/AdminArchiveLogsPage';
import { AdminCuratorProfilePage } from './pages/AdminCuratorProfilePage';
import { AdminRouteGuard } from './components/auth/AdminRouteGuard';
import { DatabaseInitializer } from './dal/initializer';
import { useFeatureFlagsStore } from './stores/useFeatureFlagsStore';

// Federal Law 152-FZ & 38-FZ Legal Engine & Unified /legal/* Routes
import { LegalIndexPage } from './pages/legal/LegalIndexPage';
import { LegalDocumentReaderPage } from './pages/legal/LegalDocumentReaderPage';
import { LegalArchivePage } from './pages/legal/LegalArchivePage';
import { LegalArchiveSnapshotPage } from './pages/legal/LegalArchiveSnapshotPage';
import { CookieConsentBanner } from './components/compliance/CookieConsentBanner';
import { ConsentGateModal } from './components/compliance/ConsentGateModal';

// SEO Legal Knowledge Hub & FAQ
import { KnowledgeHubPage } from './pages/knowledge/KnowledgeHubPage';
import { ArticleDetailPage } from './pages/knowledge/ArticleDetailPage';
import { FAQPage } from './pages/knowledge/FAQPage';

// Helper component to scroll to top on every route change
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export const App: React.FC = () => {
  const { enableVipClub } = useFeatureFlagsStore();

  useEffect(() => {
    DatabaseInitializer.initLiveDatabase();
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <CookieConsentBanner />
          <ConsentGateModal />
          <Routes>
            {/* Public Layout Wrapping Global Header & Footer */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/sellers" element={<SellersPage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route
                path="/vip-catalog"
                element={enableVipClub ? <VipCatalogPage /> : <Navigate to="/opportunities" replace />}
              />
              <Route path="/opportunities/:lotCode" element={<LotDetailsPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/story" element={<StoryPage />} />
              <Route path="/investors" element={<Navigate to="/opportunities" replace />} />
              <Route path="/partners" element={<PartnersPublicPage />} />
              <Route path="/verify/:lotCode" element={<VerifyCertificatePage />} />

              {/* SEO Knowledge Center & FAQ */}
              <Route path="/knowledge" element={<KnowledgeHubPage />} />
              <Route path="/knowledge/:articleSlug" element={<ArticleDetailPage />} />
              <Route path="/faq" element={<FAQPage />} />

              {/* Unified /legal/* Enterprise Legal CMS Routes */}
              <Route path="/legal" element={<LegalIndexPage />} />
              <Route path="/legal/archive" element={<LegalArchivePage />} />
              <Route path="/legal/archive/:slug/:version" element={<LegalArchiveSnapshotPage />} />
              <Route path="/legal/:slug" element={<LegalDocumentReaderPage />} />

              {/* Backward-Compatible Legal Redirects */}
              <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
              <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
              <Route path="/consent-pd" element={<Navigate to="/legal/consent-pd" replace />} />
              <Route path="/consent-ads" element={<Navigate to="/legal/consent-ads" replace />} />
              <Route path="/consent-distribution" element={<Navigate to="/legal/consent-distribution" replace />} />
              <Route path="/cookies" element={<Navigate to="/legal/cookies" replace />} />
              <Route path="/call-recording" element={<Navigate to="/legal/call-recording" replace />} />

              {/* Unified Client Account & Portal */}
              <Route path="/portal" element={<ClientPortalPage />} />
              <Route path="/account" element={<ClientPortalPage />} />
              <Route path="/tracker" element={<Navigate to="/portal" replace />} />
              <Route path="/client/tracker/:dealId" element={<ClientTrackerPage />} />
            </Route>

            {/* Admin, Compliance & Pipeline Operations (Protected by AdminRouteGuard) */}
            <Route element={<AdminRouteGuard />}>
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/pipeline" element={<AdminPipelinePage />} />
              
              <Route path="/admin/packaging" element={<Navigate to="/admin/packaging/lot-1" replace />} />
              <Route path="/admin/packaging/:lotId" element={<AdminPackagingPage />} />
              
              <Route path="/admin/legal-audit" element={<Navigate to="/admin/legal-audit/lot-1" replace />} />
              <Route path="/admin/legal-audit/:lotId" element={<AdminLegalAuditPage />} />
              
              <Route path="/admin/matchmaker" element={<Navigate to="/admin/matchmaker/lot-1" replace />} />
              <Route path="/admin/matchmaker/:lotId" element={<AdminMatchmakerPage />} />
              
              <Route path="/admin/closing" element={<Navigate to="/admin/closing/DEAL-2025-10566" replace />} />
              <Route path="/admin/closing/:dealId" element={<AdminClosingPage />} />
              
              <Route path="/admin/investors" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/brokers" element={<AdminBrokersPage />} />
              <Route path="/admin/partners-bot" element={<Navigate to="/admin/brokers" replace />} />

              {/* Archive Logs & Decision Journal (Mission 12) */}
              <Route path="/admin/archive-logs" element={<AdminArchiveLogsPage />} />

              {/* Curator Professional Profile (Mission 14) */}
              <Route path="/admin/profile" element={<AdminCuratorProfilePage />} />
            </Route>

            {/* Partner Bank Gateway (Mission 6) */}
            <Route
              path="/bank-portal"
              element={
                <BankGatewayErrorBoundary>
                  <BankPortalPage />
                </BankGatewayErrorBoundary>
              }
            />
            <Route
              path="/admin/bank-gateway"
              element={
                <BankGatewayErrorBoundary>
                  <BankPortalPage />
                </BankGatewayErrorBoundary>
              }
            />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
