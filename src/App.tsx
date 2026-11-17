import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { PublicLayout } from './components/layout/PublicLayout';
import { PageSkeletonLoader } from './components/common/Skeletons';

// Public User-Facing Pages (Lazy Loaded for minimal initial bundle)
const HomePage = React.lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const SellersPage = React.lazy(() => import('./pages/SellersPage').then((m) => ({ default: m.SellersPage })));
const OpportunitiesPage = React.lazy(() => import('./pages/OpportunitiesPage').then((m) => ({ default: m.OpportunitiesPage })));
const VipCatalogPage = React.lazy(() => import('./pages/VipCatalogPage').then((m) => ({ default: m.VipCatalogPage })));
const LotDetailsPage = React.lazy(() => import('./pages/LotDetailsPage').then((m) => ({ default: m.LotDetailsPage })));
const HowItWorksPage = React.lazy(() => import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })));
const StoryPage = React.lazy(() => import('./pages/StoryPage').then((m) => ({ default: m.StoryPage })));
const PartnersPublicPage = React.lazy(() => import('./pages/PartnersPublicPage').then((m) => ({ default: m.PartnersPublicPage })));
const VerifyCertificatePage = React.lazy(() => import('./pages/VerifyCertificatePage').then((m) => ({ default: m.VerifyCertificatePage })));

// Unified Client Portal (Interface 11 & User Account)
const ClientPortalPage = React.lazy(() => import('./pages/ClientPortalPage').then((m) => ({ default: m.ClientPortalPage })));
const ClientTrackerPage = React.lazy(() => import('./pages/ClientTrackerPage').then((m) => ({ default: m.ClientTrackerPage })));

// Admin, CRM & Operations Pages (Interfaces 12 to 18)
const AdminDashboardPage = React.lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminPipelinePage = React.lazy(() => import('./pages/AdminPipelinePage').then((m) => ({ default: m.AdminPipelinePage })));
const AdminPackagingPage = React.lazy(() => import('./pages/AdminPackagingPage').then((m) => ({ default: m.AdminPackagingPage })));
const AdminLegalAuditPage = React.lazy(() => import('./pages/AdminLegalAuditPage').then((m) => ({ default: m.AdminLegalAuditPage })));
const AdminMatchmakerPage = React.lazy(() => import('./pages/AdminMatchmakerPage').then((m) => ({ default: m.AdminMatchmakerPage })));
const AdminClosingPage = React.lazy(() => import('./pages/AdminClosingPage').then((m) => ({ default: m.AdminClosingPage })));
const AdminBrokersPage = React.lazy(() => import('./pages/AdminBrokersPage').then((m) => ({ default: m.AdminBrokersPage })));
const BankPortalPage = React.lazy(() => import('./pages/BankPortalPage').then((m) => ({ default: m.BankPortalPage })));
const AdminArchiveLogsPage = React.lazy(() => import('./pages/AdminArchiveLogsPage').then((m) => ({ default: m.AdminArchiveLogsPage })));
const AdminCuratorProfilePage = React.lazy(() => import('./pages/AdminCuratorProfilePage').then((m) => ({ default: m.AdminCuratorProfilePage })));

// Federal Law 152-FZ & 38-FZ Legal Engine & Unified /legal/* Routes
const LegalIndexPage = React.lazy(() => import('./pages/legal/LegalIndexPage').then((m) => ({ default: m.LegalIndexPage })));
const LegalDocumentReaderPage = React.lazy(() => import('./pages/legal/LegalDocumentReaderPage').then((m) => ({ default: m.LegalDocumentReaderPage })));
const LegalArchivePage = React.lazy(() => import('./pages/legal/LegalArchivePage').then((m) => ({ default: m.LegalArchivePage })));
const LegalArchiveSnapshotPage = React.lazy(() => import('./pages/legal/LegalArchiveSnapshotPage').then((m) => ({ default: m.LegalArchiveSnapshotPage })));

// SEO Legal Knowledge Hub & FAQ
const KnowledgeHubPage = React.lazy(() => import('./pages/knowledge/KnowledgeHubPage').then((m) => ({ default: m.KnowledgeHubPage })));
const ArticleDetailPage = React.lazy(() => import('./pages/knowledge/ArticleDetailPage').then((m) => ({ default: m.ArticleDetailPage })));
const FAQPage = React.lazy(() => import('./pages/knowledge/FAQPage').then((m) => ({ default: m.FAQPage })));

import { BankGatewayErrorBoundary } from './components/common/BankGatewayErrorBoundary';
import { AdminRouteGuard } from './components/auth/AdminRouteGuard';
import { DatabaseInitializer } from './dal/initializer';
import { useFeatureFlagsStore } from './stores/useFeatureFlagsStore';
import { CookieConsentBanner } from './components/compliance/CookieConsentBanner';
import { ConsentGateModal } from './components/compliance/ConsentGateModal';

const OpportunityRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/opportunities/${id || ''}`} replace />;
};

const AdminOpsAuditRedirect: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  return <Navigate to={`/admin/legal-audit/${lotId || ''}`} replace />;
};

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
          <Suspense fallback={<PageSkeletonLoader />}>
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

              {/* Backward-Compatible Route Aliases */}
              <Route path="/app/seller" element={<Navigate to="/sellers" replace />} />
              <Route path="/app/objects" element={<Navigate to="/opportunities" replace />} />
              <Route path="/app/objects/:id" element={<OpportunityRedirect />} />
            </Route>

            {/* Admin, Compliance & Pipeline Operations (Protected by AdminRouteGuard) */}
            <Route element={<AdminRouteGuard />}>
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/pipeline" element={<AdminPipelinePage />} />
              
              <Route path="/admin/packaging" element={<AdminPackagingPage />} />
              <Route path="/admin/packaging/:lotId" element={<AdminPackagingPage />} />
              
              <Route path="/admin/legal-audit" element={<AdminLegalAuditPage />} />
              <Route path="/admin/legal-audit/:lotId" element={<AdminLegalAuditPage />} />
              <Route path="/admin/ops-audit" element={<Navigate to="/admin/legal-audit" replace />} />
              <Route path="/admin/ops-audit/:lotId" element={<AdminOpsAuditRedirect />} />
              
              <Route path="/admin/matchmaker" element={<AdminMatchmakerPage />} />
              <Route path="/admin/matchmaker/:lotId" element={<AdminMatchmakerPage />} />
              
              <Route path="/admin/closing" element={<AdminClosingPage />} />
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
        </Suspense>
      </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
