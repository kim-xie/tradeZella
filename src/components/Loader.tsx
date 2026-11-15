import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2.5px] overflow-hidden bg-transparent pointer-events-none">
      <div className="h-full w-full bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 animate-pulse transition-all duration-300 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></div>
    </div>
  );
};

export default Loader;
