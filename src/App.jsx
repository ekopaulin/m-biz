import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import Caisse from './pages/Caisse';
import Stock from './pages/Stock';
import Dettes from './pages/Dettes';
import Parametres from './pages/Parametres';
import Cotisations from './pages/Cotisations';
import TutorialOverlay from './components/TutorialOverlay';
import { AppProvider } from './context/AppContext';
import './index.css';

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="app-container mx-auto">
          <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#333', color: '#fff', borderRadius: '10px' } }} />
          <TutorialOverlay />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/caisse" element={<Caisse />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/dettes" element={<Dettes />} />
            <Route path="/cotisations" element={<Cotisations />} />
            <Route path="/parametres" element={<Parametres />} />
          </Routes>
          <BottomNav />
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
