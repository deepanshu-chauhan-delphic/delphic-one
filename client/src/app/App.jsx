import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../lib/authContext.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import DashboardPage from '../pages/dashboard/DashboardPage.jsx';
import AccountsListPage from '../pages/accounts/AccountsListPage.jsx';
import RequirementsListPage from '../pages/requirements/RequirementsListPage.jsx';
import RequirementDetailPage from '../pages/requirements/RequirementDetailPage.jsx';
import RequirementFormPage from '../pages/requirements/RequirementFormPage.jsx';
import ProfilesListPage from '../pages/profiles/ProfilesListPage.jsx';
import SubmissionsListPage from '../pages/submissions/SubmissionsListPage.jsx';
import ReportsPage from '../pages/reports/ReportsPage.jsx';
import UsersPage from '../pages/users/UsersPage.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-tertiary-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
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
        <Route path="requirements" element={<RequirementsListPage />} />
        <Route path="requirements/new" element={<RequirementFormPage />} />
        <Route path="requirements/:id/edit" element={<RequirementFormPage />} />
        <Route path="requirements/:id" element={<RequirementDetailPage />} />
        <Route path="profiles" element={<ProfilesListPage />} />
        <Route path="submissions" element={<SubmissionsListPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
