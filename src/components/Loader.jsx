import React from 'react';

const Loader = ({ message = "Chargement..." }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] w-full">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-bold text-text-muted animate-pulse">{message}</p>
    </div>
  );
};

export default Loader;
