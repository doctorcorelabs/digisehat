
import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import TopNavBar from './TopNavBar'; // Import TopNavBar
import LanguageToggleButton from './LanguageToggleButton'; // Import LanguageToggleButton
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import UpgradePlanDialogContent from '@/components/UpgradePlanDialog';

interface LayoutProps {
  children: ReactNode;
}
// Removed duplicate interface definition below

const Layout = ({ children }: LayoutProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu
  const { isUpgradeDialogOpen, closeUpgradeDialog } = useAuth();

  const toggleDesktopSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <LanguageToggleButton /> {/* Add the language toggle button here */}
      {/* Sidebar for Desktop (md and up) - ADDED fixed positioning classes */}
      <div className="hidden md:flex md:flex-shrink-0 md:fixed md:inset-y-0 md:left-0 md:z-30">
        <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleDesktopSidebar} />
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Background Overlay */}
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          {/* Mobile Sidebar */}
          <div className="fixed inset-y-0 left-0 z-40 flex md:hidden">
            <Sidebar isCollapsed={false} onToggle={closeMobileMenu} /> {/* Always expanded on mobile, toggle closes it */}
          </div>
        </>
      )}

      {/* Main Content Container - ADDED dynamic padding */}
      <div className={`flex flex-1 flex-col ${isSidebarCollapsed ? 'md:pl-16' : 'md:pl-64'}`}>
        {/* Top Navigation Bar for Mobile */}
        <TopNavBar onToggleMobileMenu={toggleMobileMenu} />

        {/* Main Content Area - REMOVED overflow-y-auto */}
        <main className="flex-1 bg-white"> {/* Moved bg-white here */}
          {/* REMOVED h-full from this div */}
          <div>
            {children}
          </div>
        </main>
      </div>

      {/* Global Upgrade Dialog */}
      <AlertDialog open={isUpgradeDialogOpen} onOpenChange={closeUpgradeDialog}>
        {/* Apply layout styles directly to the global dialog content container */}
        <AlertDialogContent className="max-h-[90vh] flex flex-col"> 
          <UpgradePlanDialogContent />
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Layout;
