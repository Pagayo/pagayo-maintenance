/**
 * Admin Router Component
 * Simple URL-based router for admin SPA
 * No external dependencies - uses window.location.pathname
 */
import { FunctionalComponent } from 'preact';
import { useState, useEffect, useLayoutEffect } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { Spinner } from '../../components';
import { useI18n } from '../../i18n';
import { useAdminAuthStore } from '../../stores/adminAuthStore';
import { isAdminPathAllowedByAccessScope } from '../../../lib/admin-nav-core';
import { syncPwaManifestFromLocation } from '../../lib/sync-pwa-manifest';
import { navigate } from '../../lib/admin-navigate';

export { navigate };

// Lazy-loaded page components
const DashboardPage = lazy(() => import('../../pages/admin/DashboardPage').then(m => ({ default: m.DashboardContent })));
const AdminHomePage = lazy(() => import('../../pages/admin/AdminHomePage').then(m => ({ default: m.AdminHomePage })));
const ProductsPage = lazy(() => import('../../pages/admin/ProductsPage'));
const ProductImportPage = lazy(() => import('../../pages/admin/ProductImportPage'));
const OrdersPage = lazy(() => import('../../pages/admin/OrdersPage'));
const ReturnsPage = lazy(() => import('../../pages/admin/ReturnsPage'));
const CustomersPage = lazy(() => import('../../pages/admin/CustomersPage'));
const SettingsPage = lazy(() => import('../../pages/admin/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PagesPage = lazy(() => import('../../pages/admin/PagesPage'));
const ContentBlocksPage = lazy(() => import('../../pages/admin/ContentBlocksPage'));
const BlogPage = lazy(() => import('../../pages/admin/BlogPage'));
const HeaderFooterPage = lazy(() => import('../../pages/admin/HeaderFooterPage'));
const WebsiteHubPage = lazy(() => import('../../pages/admin/WebsiteHubPage').then(m => ({ default: m.WebsiteHubPage })));
const FaqPage = lazy(() => import('../../pages/admin/FaqPage'));
const CategoriesPage = lazy(() => import('../../pages/admin/CategoriesPage'));
const BrandsPage = lazy(() => import('../../pages/admin/BrandsPage'));
const IntegrationsPage = lazy(() => import('../../pages/admin/IntegrationsPage'));
const IntegrationMolliePage = lazy(() => import('../../pages/admin/IntegrationMolliePage'));
const IntegrationStripePage = lazy(() => import('../../pages/admin/IntegrationStripePage'));
const IntegrationAnalyticsPage = lazy(() => import('../../pages/admin/IntegrationAnalyticsPage'));
const IntegrationBolcomPage = lazy(() => import('../../pages/admin/IntegrationBolcomPage'));
const IntegrationAmazonPage = lazy(() => import('../../pages/admin/IntegrationAmazonPage'));
const IntegrationGoogleDrivePage = lazy(() => import('../../pages/admin/IntegrationGoogleDrivePage'));
const CommerceImportPage = lazy(() => import('../../pages/admin/CommerceImportPage'));
const IntegrationSendcloudPage = lazy(() => import('../../pages/admin/IntegrationSendcloudPage'));
const StaffPage = lazy(() => import('../../pages/admin/StaffPage'));
const OperatorWorkspacesPage = lazy(() => import('../../pages/admin/OperatorWorkspacesPage'));
const InviteStaffPage = lazy(() => import('../../pages/admin/InviteStaffPage'));
const EditStaffPage = lazy(() => import('../../pages/admin/EditStaffPage'));
const RolesPage = lazy(() => import('../../pages/admin/RolesPage'));
const EditRolePage = lazy(() => import('../../pages/admin/EditRolePage'));
const AcceptInvitePage = lazy(() => import('../../pages/admin/AcceptInvitePage'));
const AIOnboardingPage = lazy(() => import('../../pages/admin/AIOnboardingPage').then(m => ({ default: m.AIOnboardingPage })));
const SubscriptionsPage = lazy(() => import('../../pages/admin/SubscriptionsPage'));
const SubscriptionVisitsPage = lazy(
  () => import('../../pages/admin/SubscriptionVisitsPage'),
);
const SubscriptionScanPage = lazy(() => import('../../pages/admin/SubscriptionScanPage'));
const SubscriptionPublicVerifyPage = lazy(
  () => import('../../pages/admin/SubscriptionPublicVerifyPage'),
);
const CheckInPage = lazy(() => import('../../pages/admin/CheckInPage'));
const BookingsAgendaPage = lazy(() => import('../../pages/admin/BookingsAgendaPage'));
const MembersBaliePage = lazy(() => import('../../pages/admin/MembersBaliePage'));
const MembersWorkspaceSettingsPage = lazy(
  () => import('../../pages/admin/MembersWorkspaceSettingsPage'),
);
const ProductsWorkspaceSettingsPage = lazy(
  () => import('../../pages/admin/ProductsWorkspaceSettingsPage'),
);
const ProductsWorkspaceSettingsRedirect = lazy(() =>
  import('../../pages/admin/ProductsWorkspaceSettingsPage').then((m) => ({
    default: m.ProductsWorkspaceSettingsRedirect,
  })),
);
const CategoriesWorkspaceSettingsPage = lazy(
  () => import('../../pages/admin/CategoriesWorkspaceSettingsPage'),
);
const CategoriesWorkspaceSettingsRedirect = lazy(() =>
  import('../../pages/admin/CategoriesWorkspaceSettingsPage').then((m) => ({
    default: m.CategoriesWorkspaceSettingsRedirect,
  })),
);
const HomepageWorkspaceSettingsPage = lazy(
  () => import('../../pages/admin/HomepageWorkspaceSettingsPage'),
);
const HomepageWorkspaceSettingsRedirect = lazy(() =>
  import('../../pages/admin/HomepageWorkspaceSettingsPage').then((m) => ({
    default: m.HomepageWorkspaceSettingsRedirect,
  })),
);
const SubscriptionsWorkspaceSettingsPage = lazy(
  () => import('../../pages/admin/SubscriptionsWorkspaceSettingsPage'),
);
const SubscriptionsWorkspaceSettingsRedirect = lazy(() =>
  import('../../pages/admin/SubscriptionsWorkspaceSettingsPage').then((m) => ({
    default: m.SubscriptionsWorkspaceSettingsRedirect,
  })),
);
const ReportsOverviewPage = lazy(() => import('../../pages/admin/reports/ReportsOverviewPage'));
const ReportsRevenuePage = lazy(() => import('../../pages/admin/reports/ReportsRevenuePage'));
const ReportsTaxPage = lazy(() => import('../../pages/admin/reports/ReportsTaxPage'));
const ReportsProductsPage = lazy(() => import('../../pages/admin/reports/ReportsProductsPage'));
const ReportsPaymentsPage = lazy(() => import('../../pages/admin/reports/ReportsPaymentsPage'));
const ReportsSubscriptionsPage = lazy(() => import('../../pages/admin/reports/ReportsSubscriptionsPage'));
const ReportsStripePage = lazy(() => import('../../pages/admin/reports/ReportsStripePage'));
const ReportsStripePayoutsPage = lazy(() => import('../../pages/admin/reports/ReportsStripePayoutsPage'));
const ReportsPosDailyClosesPage = lazy(() => import('../../pages/admin/reports/ReportsPosDailyClosesPage'));
const ReportsFinanceSpecificationPage = lazy(() => import('../../pages/admin/reports/ReportsFinanceSpecificationPage'));
const CouponsPage = lazy(() => import('../../pages/admin/CouponsPage'));
const CouponImportPage = lazy(() => import('../../pages/admin/CouponImportPage'));
const CouponRulesPage = lazy(() => import('../../pages/admin/CouponRulesPage'));
const POSPage = lazy(() => import('../../pages/admin/POSPage'));
const POSWorkspaceSettingsPage = lazy(() => import('../../pages/admin/POSWorkspaceSettingsPage'));
const POSWorkspaceSettingsRedirect = lazy(() =>
  import('../../pages/admin/POSWorkspaceSettingsPage').then((m) => ({
    default: m.POSWorkspaceSettingsRedirect,
  })),
);
const UpgradePage = lazy(() => import('../../pages/admin/UpgradePage').then(m => ({ default: m.UpgradePage })));
const SocialDashboardPage = lazy(() => import('./social/SocialDashboard').then(m => ({ default: m.SocialDashboard })));
const AtlasCommercePage = lazy(() => import('../../pages/admin/AtlasCommercePage'));
const RevenueTodayPage = lazy(() => import('../../pages/admin/revenue/RevenueTodayPage'));
const RevenueIntelligencePage = lazy(() => import('../../pages/admin/revenue/RevenueIntelligencePage'));
const RevenueCustomersPage = lazy(() => import('../../pages/admin/revenue/RevenueCustomersPage'));
const RevenueResultsPage = lazy(() => import('../../pages/admin/revenue/RevenueResultsPage'));
const RevenueSettingsPage = lazy(() => import('../../pages/admin/revenue/RevenueSettingsPage'));
const RevenueCustomerPage = lazy(() => import('../../pages/admin/revenue/RevenueCustomerPage'));
const MenuSettingsPage = lazy(() => import('../../pages/admin/MenuSettingsPage').then(m => ({ default: m.MenuSettingsPage })));
const DesignThemePage = lazy(() => import('../../pages/admin/DesignThemePage').then(m => ({ default: m.DesignThemePage })));
const DesignSkinsPage = lazy(() => import('../../pages/admin/DesignSkinsPage').then(m => ({ default: m.DesignSkinsPage })));
const DesignTypographyPage = lazy(() => import('../../pages/admin/DesignTypographyPage').then(m => ({ default: m.DesignTypographyPage })));
const SeoPage = lazy(() => import('../../pages/admin/SeoPage').then(m => ({ default: m.SeoPage })));
const NewsletterPage = lazy(() => import('../../pages/admin/NewsletterPage').then(m => ({ default: m.NewsletterPage })));
const OpeningHoursPage = lazy(() => import('../../pages/admin/OpeningHoursPage').then(m => ({ default: m.OpeningHoursPage })));
const HomepageLayoutPage = lazy(() => import('../../pages/admin/HomepageLayoutPage').then(m => ({ default: m.HomepageLayoutPage })));
const ContactSettingsPage = lazy(() => import('../../pages/admin/ContactSettingsPage').then(m => ({ default: m.ContactSettingsPage })));
const PrintSettingsPage = lazy(() => import('../../pages/admin/settings/PrintSettingsPage'));
const PartnersPage = lazy(() => import('../../pages/admin/PartnersPage'));
const PartnerSettingsPage = lazy(() => import('../../pages/admin/PartnerSettingsPage'));
const PartnerSettingsRedirect = lazy(() =>
  import('../../pages/admin/PartnerSettingsPage').then((m) => ({
    default: m.PartnerSettingsRedirect,
  })),
);
const PartnerImportPage = lazy(() => import('../../pages/admin/PartnerImportPage'));
const DashboardWorkspaceSettingsPage = lazy(
  () => import('../../pages/admin/DashboardWorkspaceSettingsPage'),
);

// Route configuration
interface Route {
  path: string;
  pattern?: RegExp;
  component: FunctionalComponent;
  exact?: boolean;
}

/**
 * `/admin/check-in/:numericId` wordt door de worker als apart HTML-document geserveerd
 * (check-in terminal). Bij SPA-landing op dit pad: volledige document-load afdwingen.
 */
function CheckInTerminalFullPageRedirect(): null {
  useLayoutEffect(() => {
    window.location.replace(
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  return null;
}

/**
 * `/balie` wordt door de worker als apart HTML-document geserveerd (leden-balie terminal).
 * Bij SPA-landing op dit pad: volledige document-load afdwingen.
 */
function MembersBalieTerminalFullPageRedirect(): null {
  useLayoutEffect(() => {
    window.location.replace(
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  return null;
}

/**
 * Legacy `/…/:id/edit` → canonieke workspace-URL zonder `/edit` (replaceState + popstate).
 */
function createAdminStripEditRedirect(pathPattern: RegExp): FunctionalComponent {
  const AdminStripEditRedirect: FunctionalComponent = () => {
    useLayoutEffect(() => {
      let normalizedPath = window.location.pathname.split('?')[0];
      if (normalizedPath.endsWith('/') && normalizedPath !== '/') {
        normalizedPath = normalizedPath.slice(0, -1);
      }
      if (!pathPattern.test(normalizedPath)) {
        return;
      }
      const targetPath = normalizedPath.slice(0, -'/edit'.length);
      const next = targetPath + window.location.search;
      const current = window.location.pathname + window.location.search;
      if (next === current) {
        return;
      }
      window.history.replaceState({}, '', next);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, []);
    return null;
  };
  return AdminStripEditRedirect;
}

const ProductsEditLegacyRedirect = createAdminStripEditRedirect(
  /^\/admin\/products\/\d+\/edit$/,
);
const CategoriesEditLegacyRedirect = createAdminStripEditRedirect(
  /^\/admin\/categories\/\d+\/edit$/,
);
const CouponsEditLegacyRedirect = createAdminStripEditRedirect(
  /^\/admin\/coupons\/[^/]+\/edit$/,
);
const BlogEditLegacyRedirect = createAdminStripEditRedirect(
  /^\/admin\/blog\/\d+\/edit$/,
);
const PagesEditLegacyRedirect = createAdminStripEditRedirect(
  /^\/admin\/pages\/\d+\/edit$/,
);

/**
 * Legacy `/admin/header-footer` → canonical `/admin/storefront/layout`.
 * Replaces history state so the back-button is preserved.
 */
function StorefrontLayoutHeaderFooterRedirect(): null {
  useLayoutEffect(() => {
    const next = '/admin/storefront/layout' + window.location.search;
    const current = window.location.pathname + window.location.search;
    if (next !== current) {
      window.history.replaceState({}, '', next);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, []);
  return null;
}

const routes: Route[] = [
  {
    path: '/balie',
    pattern: /^\/balie(\/|$)/,
    component: MembersBalieTerminalFullPageRedirect,
  },
  { path: '/admin/login', component: DashboardPage, exact: true },
  { path: '/admin/dashboard/settings', component: DashboardWorkspaceSettingsPage, exact: true },
  { path: '/admin', component: AdminHomePage, exact: true },
  { path: '/admin/onboarding', component: AIOnboardingPage, exact: true },
  { path: '/admin/upgrade', component: UpgradePage, exact: true },
  { path: '/admin/atlas-commerce', component: AtlasCommercePage, exact: true },
  { path: '/admin/revenue/intelligence', component: RevenueIntelligencePage, exact: true },
  { path: '/admin/revenue/customers', component: RevenueCustomersPage, exact: true },
  { path: '/admin/revenue/results', component: RevenueResultsPage, exact: true },
  { path: '/admin/revenue/settings', component: RevenueSettingsPage, exact: true },
  { path: '/admin/revenue', pattern: /^\/admin\/revenue\/customer\/[^/]+$/, component: RevenueCustomerPage },
  { path: '/admin/revenue', component: RevenueTodayPage, exact: true },
  {
    path: '/admin/repeat-revenue',
    pattern: /^\/admin\/repeat-revenue(\/.*)?$/,
    component: RepeatRevenueLegacyRedirect,
  },
  { path: '/admin/social', component: SocialDashboardPage, exact: true },
  { path: '/admin/products/new', component: ProductsPage, exact: true },
  { path: '/admin/products/import', component: ProductImportPage, exact: true },
  { path: '/admin/products/settings/frontend/general', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/frontend/social-share', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/frontend/breadcrumb', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/frontend/title', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/frontend/description', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/frontend/about-product', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/frontend/image', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/frontend/purchase', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/admin/import-export', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/admin/list-columns', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/frontend', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/admin', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings/list', component: ProductsWorkspaceSettingsPage, exact: true },
  { path: '/admin/products/settings', component: ProductsWorkspaceSettingsRedirect, exact: true },
  { path: '/admin/products', pattern: /^\/admin\/products\/\d+\/edit/, component: ProductsEditLegacyRedirect },
  { path: '/admin/products', pattern: /^\/admin\/products\/[^/]+$/, component: ProductsPage },
  { path: '/admin/products', component: ProductsPage, exact: true },
  { path: '/admin/categories/new', component: CategoriesPage, exact: true },
  { path: '/admin/categories/settings/frontend/general', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/frontend/facet-sidebar', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/frontend/category-description', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/frontend/grid-columns', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/frontend/product-card', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/frontend/title-subtitle', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/frontend/filters-products-found', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/frontend/blocks', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/admin/list-columns', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/mobile/general', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/frontend', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/admin', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/mobile', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings/list', component: CategoriesWorkspaceSettingsPage, exact: true },
  { path: '/admin/categories/settings', component: CategoriesWorkspaceSettingsRedirect, exact: true },
  { path: '/admin/categories', pattern: /^\/admin\/categories\/\d+\/edit/, component: CategoriesEditLegacyRedirect },
  { path: '/admin/categories', pattern: /^\/admin\/categories\/[^/]+$/, component: CategoriesPage },
  { path: '/admin/categories', component: CategoriesPage, exact: true },
  { path: '/admin/brands', component: BrandsPage, exact: true },
  { path: '/admin/coupons/import', component: CouponImportPage, exact: true },
  { path: '/admin/coupons/rules', component: CouponRulesPage, exact: true },
  { path: '/admin/coupons/new', component: CouponsPage, exact: true },
  { path: '/admin/coupons', pattern: /^\/admin\/coupons\/[^/]+\/edit/, component: CouponsEditLegacyRedirect },
  { path: '/admin/coupons', pattern: /^\/admin\/coupons\/[^/]+$/, component: CouponsPage },
  { path: '/admin/coupons', component: CouponsPage, exact: true },
  { path: '/admin/pos/settings/daily-close', component: POSWorkspaceSettingsPage, exact: true },
  { path: '/admin/pos/settings/terminal-auth', component: POSWorkspaceSettingsPage, exact: true },
  { path: '/admin/pos/settings', component: POSWorkspaceSettingsRedirect, exact: true },
  { path: '/admin/pos', component: POSPage, exact: true },
  { path: '/admin/pages/new', component: PagesPage, exact: true },
  { path: '/admin/pages', pattern: /^\/admin\/pages\/\d+\/edit/, component: PagesEditLegacyRedirect },
  { path: '/admin/pages', pattern: /^\/admin\/pages\/[^/]+$/, component: PagesPage },
  { path: '/admin/pages', component: PagesPage, exact: true },
  { path: '/admin/content-blocks', component: ContentBlocksPage, exact: true },
  { path: '/admin/blocks', component: ContentBlocksPage, exact: true },
  { path: '/admin/blog/new', component: BlogPage, exact: true },
  { path: '/admin/blog', pattern: /^\/admin\/blog\/\d+\/edit/, component: BlogEditLegacyRedirect },
  { path: '/admin/blog', pattern: /^\/admin\/blog\/[^/]+$/, component: BlogPage },
  { path: '/admin/blog', component: BlogPage, exact: true },
  { path: '/admin/storefront/layout', component: HeaderFooterPage, exact: true },
  { path: '/admin/header-footer', component: StorefrontLayoutHeaderFooterRedirect, exact: true },
  { path: '/admin/navigation', component: HeaderFooterPage, exact: true },
  { path: '/admin/faq', component: FaqPage, exact: true },
  { path: '/admin/homepage/settings/frontend/image', component: HomepageWorkspaceSettingsPage, exact: true },
  { path: '/admin/homepage/settings/admin/placements/new', component: HomepageWorkspaceSettingsPage, exact: true },
  { path: '/admin/homepage/settings/admin/placements', component: HomepageWorkspaceSettingsPage, exact: true },
  { path: '/admin/homepage/settings/admin/placements', pattern: /^\/admin\/homepage\/settings\/admin\/placements\/[^/]+$/, component: HomepageWorkspaceSettingsPage },
  { path: '/admin/homepage/settings/admin/overview', component: HomepageWorkspaceSettingsPage, exact: true },
  { path: '/admin/homepage/settings/frontend', component: HomepageWorkspaceSettingsPage, exact: true },
  { path: '/admin/homepage/settings/admin', component: HomepageWorkspaceSettingsPage, exact: true },
  { path: '/admin/homepage/settings', component: HomepageWorkspaceSettingsRedirect, exact: true },
  { path: '/admin/website', component: WebsiteHubPage, exact: true },
  { path: '/admin/homepage/layout', component: HomepageLayoutPage, exact: true },
  { path: '/admin/homepage', component: HomepageLayoutRedirect, exact: true },
  { path: '/admin/homepage/legacy', component: HomepageLayoutRedirect, exact: true },
  { path: '/admin/contact', component: ContactSettingsPage, exact: true },
  { path: '/admin/partners/settings/storefront/page', component: PartnerSettingsPage, exact: true },
  { path: '/admin/partners/settings/storefront/homepage', component: PartnerSettingsPage, exact: true },
  { path: '/admin/partners/settings/storefront', component: PartnerSettingsPage, exact: true },
  { path: '/admin/partners/settings', component: PartnerSettingsRedirect, exact: true },
  { path: '/admin/partners/import', component: PartnerImportPage, exact: true },
  { path: '/admin/partners', pattern: /^\/admin\/partners\/[^/]+$/, component: PartnersPage },
  { path: '/admin/partners', component: PartnersPage, exact: true },
  { path: '/admin/orders/new', component: OrdersPage, exact: true },
  { path: '/admin/orders', pattern: /^\/admin\/orders\/[A-Za-z0-9_-]+\/edit$/, component: OrdersPage },
  { path: '/admin/orders', pattern: /^\/admin\/orders\/[A-Za-z0-9_-]+$/, component: OrdersPage },
  { path: '/admin/orders', component: OrdersPage },
  { path: '/admin/returns', pattern: /^\/admin\/returns\/[^/]+$/, component: ReturnsPage },
  { path: '/admin/returns', component: ReturnsPage, exact: true },
  { path: '/admin/customers', pattern: /^\/admin\/customers\/\d+(?:\/edit)?$/, component: CustomersPage },
  { path: '/admin/customers', component: CustomersPage },
  { path: '/admin/operator-workspaces', pattern: /^\/admin\/operator-workspaces\/\d+$/, component: OperatorWorkspacesPage },
  { path: '/admin/operator-workspaces', component: OperatorWorkspacesPage, exact: true },
  { path: '/admin/staff/create', component: StaffPage, exact: true },
  { path: '/admin/staff/invite', component: InviteStaffPage, exact: true },
  { path: '/admin/staff', pattern: /^\/admin\/staff\/\d+\/edit$/, component: EditStaffPage },
  { path: '/admin/staff', pattern: /^\/admin\/staff\/\d+$/, component: EditStaffPage },
  { path: '/admin/staff', component: StaffPage, exact: true },
  { path: '/admin/roles/new', component: RolesPage, exact: true },
  { path: '/admin/roles', pattern: /^\/admin\/roles\/[^/]+\/edit$/, component: EditRolePage },
  { path: '/admin/roles', pattern: /^\/admin\/roles\/[^/]+$/, component: EditRolePage },
  { path: '/admin/roles', component: RolesPage, exact: true },
  {
    path: '/admin/check-in',
    pattern: /^\/admin\/check-in\/\d+$/,
    component: CheckInTerminalFullPageRedirect,
  },
  { path: '/admin/check-in', pattern: /^\/admin\/check-in\/[^/]+$/, component: CheckInPage },
  { path: '/admin/check-in', component: CheckInPage, exact: true },
  // Bookings/Agenda routes — BARBER tenant landing (capability-first-read ADR-0007)
  { path: '/admin/bookings/agenda', component: BookingsAgendaPage, exact: true },
  { path: '/admin/bookings', component: BookingsAgendaPage, exact: true },
  { path: '/admin/reservations', component: BookingsAgendaPage, exact: true },
  {
    path: '/admin/subscriptions/visits',
    component: SubscriptionVisitsPage,
    exact: true,
  },
  { path: '/admin/subscriptions/scans', component: SubscriptionScanPage, exact: true },
  { path: '/admin/subscriptions/scan', component: SubscriptionScanPage, exact: true },
  {
    path: '/admin/subscriptions/public-verify',
    component: SubscriptionPublicVerifyPage,
    exact: true,
  },
  {
    path: '/admin/subscriptions/members/settings',
    component: MembersWorkspaceSettingsPage,
    exact: true,
  },
  { path: '/admin/subscriptions/members', pattern: /^\/admin\/subscriptions\/members\/[^/]+$/, component: MembersBaliePage },
  { path: '/admin/subscriptions/members', component: MembersBaliePage, exact: true },
  { path: '/admin/subscriptions/holders', pattern: /^\/admin\/subscriptions\/holders\/[^/]+$/, component: MembersBaliePage },
  { path: '/admin/subscriptions/holders', component: MembersBaliePage, exact: true },
  { path: '/admin/subscriptions/settings/rules/access', component: SubscriptionsWorkspaceSettingsPage, exact: true },
  { path: '/admin/subscriptions/settings/rules/billing', component: SubscriptionsWorkspaceSettingsPage, exact: true },
  { path: '/admin/subscriptions/settings/rules/members', component: SubscriptionsWorkspaceSettingsPage, exact: true },
  { path: '/admin/subscriptions/settings/admin/list-columns', component: SubscriptionsWorkspaceSettingsPage, exact: true },
  { path: '/admin/subscriptions/settings', component: SubscriptionsWorkspaceSettingsRedirect, exact: true },
  { path: '/admin/subscriptions/rules', component: SubscriptionsWorkspaceSettingsRedirect, exact: true },
  { path: '/admin/subscriptions', pattern: /^\/admin\/subscriptions\/[^/]+$/, component: SubscriptionsPage },
  { path: '/admin/subscriptions', component: SubscriptionsPage, exact: true },
  { path: '/admin/reports/revenue', component: ReportsRevenuePage, exact: true },
  { path: '/admin/reports/tax', component: ReportsTaxPage, exact: true },
  { path: '/admin/reports/products', component: ReportsProductsPage, exact: true },
  { path: '/admin/reports/payments', component: ReportsPaymentsPage, exact: true },
  { path: '/admin/reports/stripe', component: ReportsStripePage, exact: true },
  { path: '/admin/reports/stripe-payouts', component: ReportsStripePayoutsPage, exact: true },
  { path: '/admin/reports/subscriptions', component: ReportsSubscriptionsPage, exact: true },
  { path: '/admin/reports/finance-specification', component: ReportsFinanceSpecificationPage, exact: true },
  { path: '/admin/reports/pos', pattern: /^\/admin\/reports\/pos\/\d+$/, component: ReportsPosDailyClosesPage },
  { path: '/admin/reports/pos', component: ReportsPosDailyClosesPage, exact: true },
  { path: '/admin/reports', component: ReportsOverviewPage, exact: true },
  { path: '/admin/accept-invite', component: AcceptInvitePage, exact: true },
  { path: '/admin/integrations/stripe', component: IntegrationStripePage, exact: true },
  { path: '/admin/integrations/mollie', component: IntegrationMolliePage, exact: true },
  { path: '/admin/integrations/analytics', component: IntegrationAnalyticsPage, exact: true },
  { path: '/admin/integrations/bolcom', component: IntegrationBolcomPage, exact: true },
  { path: '/admin/integrations/amazon', component: IntegrationAmazonPage, exact: true },
  { path: '/admin/integrations/google-drive', component: IntegrationGoogleDrivePage, exact: true },
  { path: '/admin/integrations/commerce-import', component: CommerceImportPage, exact: true },
  { path: '/admin/integrations/magento-migration', component: CommerceImportPage, exact: true },
  { path: '/admin/integrations/sendcloud', component: IntegrationSendcloudPage, exact: true },
  { path: '/admin/integrations', pattern: /^\/admin\/integrations\/[^/]+$/, component: IntegrationsPage },
  { path: '/admin/integrations', component: IntegrationsPage, exact: true },
  { path: '/admin/newsletter', component: NewsletterPage, exact: true },
  { path: '/admin/opening-hours', component: OpeningHoursPage, exact: true },
  { path: '/admin/settings/opening-hours', component: OpeningHoursLegacyRedirect, exact: true },
  { path: '/admin/design/theme', component: DesignThemePage, exact: true },
  { path: '/admin/design/skins', component: DesignSkinsPage, exact: true },
  { path: '/admin/design/typography', component: DesignTypographyPage, exact: true },
  { path: '/admin/design', component: DesignHubRootRedirect, exact: true },
  { path: '/admin/theme', pattern: /^\/admin\/theme\/[^/]+$/, component: ThemeLegacyRedirect },
  { path: '/admin/theme', component: ThemeLegacyRedirect, exact: true },
  { path: '/admin/seo', component: SeoPage, exact: true },
  { path: '/admin/settings/menu', component: MenuSettingsPage, exact: true },
  { path: '/admin/settings/general', component: SettingsPage, exact: true },
  { path: '/admin/settings/shipping', component: SettingsPage, exact: true },
  { path: '/admin/settings/payments', component: SettingsPage, exact: true },
  { path: '/admin/settings/invoicing', component: SettingsPage, exact: true },
  { path: '/admin/settings/checkout', component: SettingsPage, exact: true },
  { path: '/admin/settings/login', component: SettingsPage, exact: true },
  { path: '/admin/settings/stock', component: SettingsPage, exact: true },
  { path: '/admin/settings/email', component: SettingsPage, exact: true },
  { path: '/admin/settings/print', component: PrintSettingsPage, exact: true },
  { path: '/admin/settings/domains', component: SettingsPage, exact: true },
  { path: '/admin/settings', component: SettingsPage, exact: true },
];

/**
 * Match a route against the current pathname
 */
export function matchRoute(pathname: string): Route | null {
  // Normalize pathname (remove trailing slash, remove query params)
  let normalizedPath = pathname.split('?')[0];
  normalizedPath = normalizedPath.endsWith('/') && normalizedPath !== '/' 
    ? normalizedPath.slice(0, -1) 
    : normalizedPath;

  for (const route of routes) {
    // Check pattern match first (for dynamic routes like /admin/producten/:id/bewerken)
    if (route.pattern && route.pattern.test(normalizedPath)) {
      return route;
    }
    
    if (route.exact) {
      if (normalizedPath === route.path) {
        return route;
      }
    } else if (!route.pattern) {
      if (normalizedPath.startsWith(route.path)) {
        return route;
      }
    }
  }
  
  return null;
}

/**
 * Placeholder for unimplemented routes
 */
const NotFoundPage: FunctionalComponent = () => {
  const { t } = useI18n();
  return (
    <div className="admin-page">
      <div className="admin-page-content">
        <p>{t('common.notFoundDescription')}</p>
        <a href="/admin" className="btn btn--primary">{t('common.backToDashboard')}</a>
      </div>
    </div>
  );
};

/**
 * Loading fallback for lazy components.
 * Wraps in admin-page structure zodat de spinner dezelfde positie
 * en padding krijgt als echte pagina-content.
 */
const PageLoader: FunctionalComponent = () => {
  const { t } = useI18n();
  return (
    <div className="admin-page">
      <div className="admin-page-content">
        <div className="admin-page-loading">
          <Spinner size="lg" />
          <p>{t('common.loadingPage')}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Legacy Repeat Revenue module URLs → canonical Revenue Today surface.
 */
function RepeatRevenueLegacyRedirect() {
  useEffect(() => {
    navigate(`/admin/revenue${window.location.search}`);
  }, []);

  return <PageLoader />;
}

/**
 * Legacy `/admin/homepage` → `/admin/homepage/layout` (section order & visibility).
 */
function HomepageLayoutRedirect() {
  useEffect(() => {
    navigate(`/admin/homepage/layout${window.location.search}`);
  }, []);

  return <PageLoader />;
}

/**
 * Backward-compatible redirect from legacy settings path to website context path.
 */
function OpeningHoursLegacyRedirect() {
  useEffect(() => {
    navigate('/admin/opening-hours');
  }, []);

  return <PageLoader />;
}

/**
 * Legacy `/admin/theme` (and `/admin/theme/:segment`) → `/admin/design/skins`.
 */
function ThemeLegacyRedirect() {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.pathname = '/admin/design/skins';
    navigate(`${url.pathname}${url.search}`);
  }, []);

  return <PageLoader />;
}

/** Canonieke landing voor `/admin/design` zonder subpad. */
function DesignHubRootRedirect() {
  useEffect(() => {
    navigate(`/admin/design/skins${window.location.search}`);
  }, []);

  return <PageLoader />;
}

/**
 * Router component
 * Renders the matched route component based on current pathname
 */
export const Router: FunctionalComponent = () => {
  const [pathname, setPathname] = useState(window.location.pathname);
  const accessScopePaths = useAdminAuthStore((s) => s.accessScopePaths);
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated);
  const isLoading = useAdminAuthStore((s) => s.isLoading);

  useEffect(() => {
    // Handle browser back/forward navigation and programmatic navigate()
    const handlePopState = () => {
      setPathname(window.location.pathname);
      syncPwaManifestFromLocation();
    };

    window.addEventListener('popstate', handlePopState);

    // Sync with actual URL on mount — catches navigate() calls that fired
    // before this effect registered (e.g., post-login redirect race)
    if (window.location.pathname !== pathname) {
      setPathname(window.location.pathname);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Find matching route
  const matchedRoute = matchRoute(pathname);
  const PageComponent = matchedRoute?.component || NotFoundPage;

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }
    if (window.location.pathname === '/admin/login') {
      return;
    }
    if (isAdminPathAllowedByAccessScope(window.location.pathname, accessScopePaths)) {
      return;
    }
    const fallbackPath = accessScopePaths?.[0] ?? '/admin';
    navigate(fallbackPath);
  }, [pathname, accessScopePaths, isAuthenticated, isLoading]);

  return (
    <Suspense fallback={<PageLoader />}>
      <PageComponent />
    </Suspense>
  );
};

/**
 * Link component for SPA navigation
 * Prevents default and uses history API
 */
interface LinkProps {
  href: string;
  className?: string;
  activeClassName?: string;
  children: preact.ComponentChildren;
}

export const Link: FunctionalComponent<LinkProps> = ({ 
  href, 
  className = '', 
  activeClassName = 'active',
  children 
}) => {
  const isActive = window.location.pathname === href || 
    (href !== '/admin' && window.location.pathname.startsWith(href));
  
  const handleClick = (e: MouseEvent) => {
    // Allow ctrl/cmd + click to open in new tab
    if (e.ctrlKey || e.metaKey) return;
    
    e.preventDefault();
    navigate(href);
  };

  return (
    <a 
      href={href} 
      className={`${className} ${isActive ? activeClassName : ''}`}
      onClick={handleClick}
    >
      {children}
    </a>
  );
};

export default Router;
