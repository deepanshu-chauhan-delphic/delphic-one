import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../lib/authContext.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import DashboardPage from '../pages/dashboard/DashboardPage.jsx';
import AccountsListPage from '../pages/accounts/AccountsListPage.jsx';
import AccountDetailPage from '../pages/accounts/AccountDetailPage.jsx';
import AccountFormPage from '../pages/accounts/AccountFormPage.jsx';
import RequirementsListPage from '../pages/requirements/RequirementsListPage.jsx';
import RequirementDetailPage from '../pages/requirements/RequirementDetailPage.jsx';
<<<<<<< Updated upstream
import RequirementFormPage from '../pages/requirements/RequirementFormPage.jsx';
import RequirementKanbanPage from '../pages/requirements/RequirementKanbanPage.jsx';
=======
>>>>>>> Stashed changes
import ProfilesListPage from '../pages/profiles/ProfilesListPage.jsx';
import ProfileDetailPage from '../pages/profiles/ProfileDetailPage.jsx';
import ProfileFormPage from '../pages/profiles/ProfileFormPage.jsx';
import SubmissionsListPage from '../pages/submissions/SubmissionsListPage.jsx';
import SubmissionDetailPage from '../pages/submissions/SubmissionDetailPage.jsx';
<<<<<<< Updated upstream
import SubmissionCreatePage from '../pages/submissions/SubmissionCreatePage.jsx';
=======
>>>>>>> Stashed changes
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
        <Route path="accounts/new" element={<AccountFormPage />} />
        <Route path="accounts/:id" element={<AccountDetailPage />} />
        <Route path="accounts/:id/edit" element={<AccountFormPage />} />
        <Route path="requirements" element={<RequirementsListPage />} />
<<<<<<< Updated upstream
        <Route path="requirements/new" element={<RequirementFormPage />} />
        <Route path="requirements/:id/edit" element={<RequirementFormPage />} />
        <Route path="requirements/:id/board" element={<RequirementKanbanPage />} />
=======
>>>>>>> Stashed changes
        <Route path="requirements/:id" element={<RequirementDetailPage />} />
        <Route path="profiles" element={<ProfilesListPage />} />
        <Route path="profiles/new" element={<ProfileFormPage />} />
        <Route path="profiles/:id" element={<ProfileDetailPage />} />
        <Route path="profiles/:id/edit" element={<ProfileFormPage />} />
        <Route path="submissions" element={<SubmissionsListPage />} />
<<<<<<< Updated upstream
        <Route path="submissions/new" element={<SubmissionCreatePage />} />
=======
>>>>>>> Stashed changes
        <Route path="submissions/:id" element={<SubmissionDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
