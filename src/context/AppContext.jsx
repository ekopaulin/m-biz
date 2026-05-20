import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import Auth from '../pages/Auth';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [activeCommerceId, setActiveCommerceId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCommerce, setHasCommerce] = useState(null); // null: loading, true/false: status
  const [devise, setDevise] = useState('FCFA');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    return localStorage.getItem('hasSeenTutorial') === 'true';
  });

  // Initialize and check if a commerce exists
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
        console.error("Erreur lors de la vérification de la DB:", error);
        setHasCommerce(false);
      }
    };
    checkCommerce();
  }, []);

  // Gérer le thème sombre globalement
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const login = (commerceId) => {
    setActiveCommerceId(commerceId);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const completeTutorial = () => {
    localStorage.setItem('hasSeenTutorial', 'true');
    setHasSeenTutorial(true);
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
    completeTutorial
  };

  if (hasCommerce === null) {
    return <div className="flex h-screen items-center justify-center bg-bg-main text-primary-dark">Chargement M-Biz...</div>;
  }

  return (
    <AppContext.Provider value={value}>
      {isAuthenticated ? children : <Auth />}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
