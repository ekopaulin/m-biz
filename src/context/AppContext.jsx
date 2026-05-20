import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../db';
import Auth from '../pages/Auth';

const AppContext = createContext();

// ─── Constantes de sécurité ───────────────────────────────────────────────────
const LOCK_TIMEOUT   = 5 * 60 * 1000; // 5 minutes d'inactivité → verrouillage
const MAX_ATTEMPTS   = 5;              // Tentatives max avant blocage
const LOCKOUT_DURATION = 30 * 1000;   // Durée du blocage : 30 secondes

export const AppProvider = ({ children }) => {
  const [activeCommerceId, setActiveCommerceId] = useState(null);
  const [isAuthenticated, setIsAuthenticated]   = useState(false);
  const [hasCommerce,      setHasCommerce]       = useState(null); // null=chargement
  const [devise,           setDevise]            = useState('FCFA');
  const [theme, setTheme]                        = useState(() => localStorage.getItem('theme') || 'light');
  const [hasSeenTutorial, setHasSeenTutorial]    = useState(() => localStorage.getItem('hasSeenTutorial') === 'true');

  // ─── États de sécurité ──────────────────────────────────────────────────────
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil,      setLockUntil]      = useState(null); // timestamp de fin de blocage
  const lockTimerRef = useRef(null);

  // ─── Vérification de la base de données ─────────────────────────────────────
  useEffect(() => {
    const checkCommerce = async () => {
      try {
        const commerces = await db.commerces.toArray();
        if (commerces.length > 0) {
          setHasCommerce(true);
          setActiveCommerceId(commerces[0].id);
          setDevise(commerces[0].devise || 'FCFA');
        } else {
          setHasCommerce(false);
        }
      } catch (error) {
        console.error("Erreur DB:", error);
        setHasCommerce(false);
      }
    };
    checkCommerce();
  }, []);

  // ─── Gestion du thème ───────────────────────────────────────────────────────
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ─── Verrouillage automatique après 5 min d'inactivité ─────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const resetTimer = () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        setIsAuthenticated(false);
      }, LOCK_TIMEOUT);
    };

    const events = ['touchstart', 'click', 'keydown', 'scroll', 'mousemove'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // Démarrer dès la connexion

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [isAuthenticated]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const login = (commerceId) => {
    setActiveCommerceId(commerceId);
    setIsAuthenticated(true);
    setFailedAttempts(0); // Réinitialiser le compteur à chaque connexion réussie
    setLockUntil(null);
  };

  const logout = () => setIsAuthenticated(false);

  const completeTutorial = () => {
    localStorage.setItem('hasSeenTutorial', 'true');
    setHasSeenTutorial(true);
  };

  // Enregistre une tentative échouée et bloque si nécessaire
  const recordFailedAttempt = () => {
    const newCount = failedAttempts + 1;
    if (newCount >= MAX_ATTEMPTS) {
      setLockUntil(Date.now() + LOCKOUT_DURATION);
      setFailedAttempts(0); // Réinitialiser après le blocage
    } else {
      setFailedAttempts(newCount);
    }
  };

  const value = {
    activeCommerceId,
    isAuthenticated,
    hasCommerce,
    setHasCommerce,
    login,
    logout,
    theme,
    toggleTheme,
    devise,
    setDevise,
    hasSeenTutorial,
    completeTutorial,
    // Sécurité
    failedAttempts,
    lockUntil,
    recordFailedAttempt,
    MAX_ATTEMPTS,
  };

  if (hasCommerce === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-main text-primary-dark font-bold">
        Chargement M-Biz...
      </div>
    );
  }

  return (
    <AppContext.Provider value={value}>
      {isAuthenticated ? children : <Auth />}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
