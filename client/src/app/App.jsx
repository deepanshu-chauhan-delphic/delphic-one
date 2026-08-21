import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '../lib/authContext.jsx';
import { can } from '../lib/permissions.js';
import AppLayout from '../components/layout/AppLayout.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import DashboardPage from '../pages/dashboard/DashboardPage.jsx';
import AccountsListPage from '../pages/accounts/AccountsListPage.jsx';
import AccountDetailPage from '../pages/accounts/AccountDetailPage.jsx';
import RequirementsListPage from '../pages/requirements/RequirementsListPage.jsx';
import RequirementDetailPage from '../pages/requirements/RequirementDetailPage.jsx';
import RequirementKanbanPage from '../pages/requirements/RequirementKanbanPage.jsx';
import ProfilesListPage from '../pages/profiles/ProfilesListPage.jsx';
import ProfileDetailPage from '../pages/profiles/ProfileDetailPage.jsx';
import SubmissionsListPage from '../pages/submissions/SubmissionsListPage.jsx';
import SubmissionDetailPage from '../pages/submissions/SubmissionDetailPage.jsx';
import ReportsPage from '../pages/reports/ReportsPage.jsx';
import UsersPage from '../pages/users/UsersPage.jsx';

function LoadingScreen() {
  return <div className="flex h-screen items-center justify-center text-tertiary-500">Loading…</div>;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Legacy `/:base/:id/edit` deep-links now open the edit Drawer on the
 * detail page instead of a dedicated full page — redirect there.
 */
function EditRedirect({ base }) {
  const { id } = useParams();
  return <Navigate to={`/${base}/${id}?edit=1`} replace />;
}

/**
 * Redirect when the current user lacks the required capability.
 */
function RequirePermission({ capability, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!can(user.role, capability)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsListPage />} />
        <Route path="accounts/new" element={<Navigate to="/accounts?create=1" replace />} />
        <Route path="accounts/:id" element={<AccountDetailPage />} />
        <Route path="accounts/:id/edit" element={<EditRedirect base="accounts" />} />
        <Route path="requirements" element={<RequirementsListPage />} />
        <Route path="requirements/new" element={<Navigate to="/requirements?create=1" replace />} />
        <Route path="requirements/:id/edit" element={<EditRedirect base="requirements" />} />
        <Route path="requirements/:id/board" element={<RequirementKanbanPage />} />
        <Route path="requirements/:id" element={<RequirementDetailPage />} />
        <Route
          path="profiles"
          element={
            <RequirePermission capability="viewProfiles">
              <ProfilesListPage />
            </RequirePermission>
          }
        />
        <Route path="profiles/new" element={<Navigate to="/profiles?create=1" replace />} />
        <Route
          path="profiles/:id"
          element={
            <RequirePermission capability="viewProfiles">
              <ProfileDetailPage />
            </RequirePermission>
          }
        />
        <Route path="profiles/:id/edit" element={<EditRedirect base="profiles" />} />
        <Route path="submissions" element={<SubmissionsListPage />} />
        <Route path="submissions/new" element={<Navigate to="/submissions?create=1" replace />} />
        <Route path="submissions/:id" element={<SubmissionDetailPage />} />
        <Route
          path="reports"
          element={
            <RequirePermission capability="viewReports">
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="users"
          element={
            <RequirePermission capability="manageUsers">
              <UsersPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
