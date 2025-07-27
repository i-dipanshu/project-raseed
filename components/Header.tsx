
import React from 'react';
import type { View } from '../types';
import { LogoIcon, DashboardIcon, UploadIcon, ChatIcon, InsightsIcon } from './icons';
import { GoogleColors } from '../constants/colors';

interface HeaderProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const navItems: { view: View; label: string; icon: React.ReactNode; disabled?: boolean; comingSoon?: boolean }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <DashboardIcon className="w-5 h-5" /> },
    { view: 'upload', label: 'Upload Receipt', icon: <UploadIcon className="w-5 h-5" /> },
    { view: 'insights', label: 'Insights', icon: <InsightsIcon className="w-5 h-5" /> },
    { view: 'chat', label: 'Chat with AI', icon: <ChatIcon className="w-5 h-5" />, disabled: true, comingSoon: true },
  ];

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-3">
            <LogoIcon className="h-8 w-8" style={{ color: GoogleColors.blue }} />
            <h1 className="text-2xl font-bold" style={{ color: GoogleColors.gray[800] }}>Raseed</h1>
          </div>
          <nav className="hidden md:flex space-x-2 p-1 rounded-full" style={{ backgroundColor: GoogleColors.gray[100] }}>
            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => !item.disabled && onNavigate(item.view)}
                disabled={item.disabled}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 relative ${
                  item.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : currentView === item.view
                    ? 'bg-white shadow'
                    : 'hover:bg-white hover:bg-opacity-50'
                }`}
                style={{
                  color: item.disabled ? GoogleColors.gray[400] : currentView === item.view ? GoogleColors.blue : GoogleColors.gray[600]
                }}
                title={item.comingSoon ? 'Coming Soon - Advanced AI chat features' : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.comingSoon && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                    Coming Soon
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
       {/* Mobile Nav */}
       <nav className="md:hidden flex justify-around p-2 bg-white" style={{ borderTop: `1px solid ${GoogleColors.gray[200]}` }}>
            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => !item.disabled && onNavigate(item.view)}
                disabled={item.disabled}
                className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors duration-200 w-full relative ${
                  item.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : currentView === item.view
                    ? ''
                    : 'hover:bg-opacity-10'
                }`}
                style={{
                  color: item.disabled ? GoogleColors.gray[400] : currentView === item.view ? GoogleColors.blue : GoogleColors.gray[500],
                  backgroundColor: currentView === item.view ? 'transparent' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (currentView !== item.view && !item.disabled) {
                    e.currentTarget.style.backgroundColor = GoogleColors.gray[100];
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentView !== item.view && !item.disabled) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {item.icon}
                <span className="text-xs">{item.label}</span>
                {item.comingSoon && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1 py-0.5 rounded-full text-xs">
                    Soon
                  </span>
                )}
              </button>
            ))}
        </nav>
    </header>
  );
};

export default Header;
