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
import { AdminInvestorsPage } from './pages/AdminInvestorsPage';
import { AdminBrokersPage } from './pages/AdminBrokersPage';
import { initReferralTracker } from './utils/referralTracker';
import { BankPortalPage } from './pages/BankPortalPage';
import { BankGatewayErrorBoundary } from './components/common/BankGatewayErrorBoundary';
import { AdminArchiveLogsPage } from './pages/AdminArchiveLogsPage';
import { AdminCuratorProfilePage } from './pages/AdminCuratorProfilePage';
import { DatabaseInitializer } from './dal/initializer';

// Federal Law 152-FZ & 38-FZ Legal Pages
import { PrivacyPolicyPage } from './pages/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/legal/TermsOfServicePage';
import { ConsentPdPage } from './pages/legal/ConsentPdPage';
import { ConsentAdsPage } from './pages/legal/ConsentAdsPage';
import { ConsentDistributionPage } from './pages/legal/ConsentDistributionPage';
import { LegalArchivePage } from './pages/legal/LegalArchivePage';
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
              <Route path="/vip-catalog" element={<VipCatalogPage />} />
              <Route path="/opportunities/:lotCode" element={<LotDetailsPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/story" element={<StoryPage />} />
              <Route path="/investors" element={<InvestorsPage />} />
              <Route path="/partners" element={<PartnersPublicPage />} />
              <Route path="/verify/:lotCode" element={<VerifyCertificatePage />} />

              {/* SEO Knowledge Center & FAQ */}
              <Route path="/knowledge" element={<KnowledgeHubPage />} />
              <Route path="/knowledge/:articleSlug" element={<ArticleDetailPage />} />
              <Route path="/faq" element={<FAQPage />} />

              {/* Federal 152-FZ & 38-FZ Legal Routes & Transparency Archive */}
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
              <Route path="/consent-pd" element={<ConsentPdPage />} />
              <Route path="/consent-ads" element={<ConsentAdsPage />} />
              <Route path="/consent-distribution" element={<ConsentDistributionPage />} />
              <Route path="/legal/archive" element={<LegalArchivePage />} />

              {/* Unified Client Account & Portal */}
              <Route path="/portal" element={<ClientPortalPage />} />
              <Route path="/account" element={<ClientPortalPage />} />
              <Route path="/tracker" element={<Navigate to="/portal" replace />} />
              <Route path="/client/tracker/:dealId" element={<ClientTrackerPage />} />
            </Route>

            {/* Admin, Compliance & Pipeline Operations */}
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
            
            <Route path="/admin/investors" element={<AdminInvestorsPage />} />
            <Route path="/admin/brokers" element={<AdminBrokersPage />} />
            <Route path="/admin/partners-bot" element={<Navigate to="/admin/brokers" replace />} />

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

            {/* Archive Logs & Decision Journal (Mission 12) */}
            <Route path="/admin/archive-logs" element={<AdminArchiveLogsPage />} />

            {/* Curator Professional Profile (Mission 14) */}
            <Route path="/admin/profile" element={<AdminCuratorProfilePage />} />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
