import React from 'react';
import { Outlet } from 'react-router-dom';
import { UnifiedNavbar } from './UnifiedNavbar';
import { UnifiedFooter } from './UnifiedFooter';
import { AuthModal } from '../auth/AuthModal';

export const PublicLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <UnifiedNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <UnifiedFooter />
      <AuthModal />
    </div>
  );
};
