import React from 'react';
import { Button } from '@/components/ui/button';
import { Menu, BrainCircuit } from 'lucide-react'; // Import Menu icon for hamburger
import { Link } from 'react-router-dom';

interface TopNavBarProps {
  onToggleMobileMenu: () => void;
}

const TopNavBar = ({ onToggleMobileMenu }: TopNavBarProps) => {
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
      {/* Mobile: Hamburger Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleMobileMenu}
        className="md:hidden" // Only show on mobile
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      {/* Mobile: Logo/Brand */}
      <Link to="/tools" className="flex items-center space-x-2 md:hidden">
        <BrainCircuit className="h-6 w-6 text-blue-600" />
        <span className="font-bold text-lg text-gray-800">DigiSehat</span>
      </Link>

      {/* Placeholder for potential right-side elements on mobile */}
      <div className="w-8"></div>
    </div>
  );
};

export default TopNavBar;
