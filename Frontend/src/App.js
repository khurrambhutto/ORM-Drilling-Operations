import logo from './logo.svg';
import './App-modular.css';
import React from "react";
import DrillingDashboard from "./DrillingDashboard";
import WellSlideshow from "./WellSlideshow";
import WellDetailsPage from "./WellDetailsPage";
import RemovedWellView from "./RemovedWellView";
import LandingPage from "./LandingPage";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from './LoginPage'; // Dedicated login screen
import { AuthProvider, useAuth } from './auth';
import AdminPanel from './AdminPanel';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

function Protected({ children }) {
  const { token, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ color: '#fff', padding: 40 }}>Checking session...</div>;
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <div className="oil-rig-bg"></div>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<Protected><DrillingDashboard /></Protected>} />
          <Route path="/slideshow" element={<Protected><WellSlideshow /></Protected>} />
          <Route path="/removed-well" element={<Protected><RemovedWellView /></Protected>} />
          <Route path="/well-details" element={<Protected><WellDetailsPage /></Protected>} />
          <Route path="/admin" element={<Protected><AdminPanel /></Protected>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
