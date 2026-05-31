import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import PlanTripPage from './pages/PlanTripPage';
import TripPlanPage from './pages/TripPlanPage';

function ProtectedRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/plan" element={<ProtectedRoute><PlanTripPage /></ProtectedRoute>} />
        <Route path="/trip/:id" element={<ProtectedRoute><TripPlanPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;