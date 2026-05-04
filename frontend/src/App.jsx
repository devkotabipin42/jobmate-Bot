import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/common/ErrorBoundary";
import ProtectedRoute from "./components/common/ProtectedRoute";

import AdminLoginPage from "./pages/AdminLoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import EmployerLeadsPage from "./pages/EmployerLeadsPage";
import WorkersPage from "./pages/WorkersPage";
import HandoffsPage from "./pages/HandoffsPage";
import ConversationsPage from "./pages/ConversationsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import BusinessLeadsPage from "./pages/BusinessLeadsPage";
import JobApplicationsPage from "./pages/JobApplicationsPage";
import PendingKnowledgePage from "./pages/PendingKnowledgePage";

function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />

          <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
          <Route path="/admin/employer-leads" element={<Protected><EmployerLeadsPage /></Protected>} />
          <Route path="/admin/workers" element={<Protected><WorkersPage /></Protected>} />
          <Route path="/admin/job-applications" element={<Protected><JobApplicationsPage /></Protected>} />
          <Route path="/admin/handoffs" element={<Protected><HandoffsPage /></Protected>} />
          <Route path="/admin/conversations" element={<Protected><ConversationsPage /></Protected>} />
          <Route path="/admin/analytics" element={<Protected><AnalyticsPage /></Protected>} />
          <Route path="/admin/business-leads" element={<Protected><BusinessLeadsPage /></Protected>} />
          <Route path="/admin/pending-knowledge" element={<Protected><PendingKnowledgePage /></Protected>} />
          <Route path="/admin/settings" element={<Protected><SettingsPage /></Protected>} />

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
