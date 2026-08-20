import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import KioskPage from './pages/kiosk/KioskPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import InboxPage from './pages/dashboard/InboxPage';
import KioskSessionsPage from './pages/dashboard/KioskSessionsPage';
import ScreeningPage from './pages/dashboard/ScreeningPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import CompetitorsPage from './pages/dashboard/CompetitorsPage';
import RequestsPage from './pages/dashboard/RequestsPage';
import EmployeesPage from './pages/dashboard/EmployeesPage';
import ContentPage from './pages/dashboard/ContentPage';
import DmInboxPage from './pages/dashboard/DmInboxPage';
import PostsPage from './pages/dashboard/PostsPage';
import ConnectionsPage from './pages/dashboard/ConnectionsPage';
import FeedbackInboxPage from './pages/dashboard/FeedbackInboxPage';
import ReviewWidgetPage from './pages/widget/ReviewWidgetPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminBusinessesPage from './pages/admin/AdminBusinessesPage';
import AdminBusinessDetailPage from './pages/admin/AdminBusinessDetailPage';
import AdminAuditLogPage from './pages/admin/AdminAuditLogPage';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import ProtectedRoute from './components/ProtectedRoute';
import { LocationProvider } from './lib/useLocation';

export default function App() {
  return (
    <LocationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/widget/:locationId" element={<ReviewWidgetPage />} />

          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<AdminBusinessesPage />} />
            <Route path="businesses/:id" element={<AdminBusinessDetailPage />} />
            <Route path="audit-log" element={<AdminAuditLogPage />} />
          </Route>

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="connections" element={<ConnectionsPage />} />
            <Route path="dm-inbox" element={<DmInboxPage />} />
            <Route path="posts" element={<PostsPage />} />
            <Route path="feedback-inbox" element={<FeedbackInboxPage />} />
            <Route path="kiosk-reviews" element={<KioskSessionsPage />} />
            <Route path="insights" element={<AnalyticsPage />} />
            <Route path="team" element={<EmployeesPage />} />
            <Route path="competitors" element={<CompetitorsPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="screening" element={<ScreeningPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LocationProvider>
  );
}
