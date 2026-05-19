import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ShoppingCart, Box, Users, PiggyBank } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAppContext } from '../context/AppContext';

const BottomNav = () => {
  const { activeCommerceId } = useAppContext();

  // Compter les produits avec stock bas pour le badge d'alerte
  const stockAlertCount = useLiveQuery(
    () => activeCommerceId
      ? db.produits
          .where('commerceId').equals(activeCommerceId)
          .filter(p => !p.isFood && p.actif !== 0 && p.stock <= (p.stockMin ?? 5))
          .count()
      : Promise.resolve(0),
    [activeCommerceId]
  ) || 0;

  const navItems = [
    { path: '/', label: 'Tableau', icon: <Home size={21} /> },
    { path: '/caisse', label: 'Caisse', icon: <ShoppingCart size={21} /> },
    { 
      path: '/stock', 
      label: 'Stock', 
      icon: <Box size={21} />,
      badge: stockAlertCount 
    },
    { path: '/dettes', label: 'Dettes', icon: <Users size={21} /> },
    { path: '/cotisations', label: 'Cotiser', icon: <PiggyBank size={21} /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[480px] z-50 bg-white/95 backdrop-blur-md border-t border-black/10 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <nav className="flex justify-around items-center py-2.5 px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-[10px] font-semibold transition-all duration-300 py-1 flex-1 ${isActive ? 'text-primary' : 'text-text-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                {/* Icône avec badge conditionnel */}
                <div className={`relative mb-1 transition-all duration-300 ${isActive ? 'scale-110 text-primary' : 'text-text-muted'}`}>
                  {item.icon}
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#FF6B6B] text-white text-[8px] font-bold flex items-center justify-center leading-none shadow-sm">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={isActive ? 'text-primary font-bold' : 'text-text-muted'}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default BottomNav;
