import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import Runs from './pages/Runs';
import RunDetail from './pages/RunDetail';
import Approvals from './pages/Approvals';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Login from './pages/Login';
import Signup from './pages/Signup';

const Layout = ({ children }) => (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    <Sidebar />
    <main style={{
      marginLeft: 'var(--sidebar-width)',
      flex: 1,
      padding: '32px',
      maxWidth: 'calc(100vw - var(--sidebar-width))',
      overflowX: 'hidden',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </main>
  </div>
);

// Redirects to /login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Redirects to / if already logged in (keeps logged-in users off login/signup pages)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"  element={<PublicRoute><Login /></PublicRoute>}  />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      <Route path="/"                    element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>}  />
      <Route path="/workflows"           element={<ProtectedRoute><Layout><Workflows /></Layout></ProtectedRoute>}  />
      <Route path="/workflows/new"       element={<ProtectedRoute><WorkflowBuilder /></ProtectedRoute>}             />
      <Route path="/workflows/:id/edit"  element={<ProtectedRoute><WorkflowBuilder /></ProtectedRoute>}             />
      <Route path="/runs"                element={<ProtectedRoute><Layout><Runs /></Layout></ProtectedRoute>}       />
      <Route path="/runs/:id"            element={<ProtectedRoute><Layout><RunDetail /></Layout></ProtectedRoute>}  />
      <Route path="/approvals"           element={<ProtectedRoute><Layout><Approvals /></Layout></ProtectedRoute>}  />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;