import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component
import { Globe } from 'lucide-react'; // Optional: if you want an icon

const LanguageToggleButton = () => {
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'id' ? 'en' : 'id';
    i18n.changeLanguage(newLang);
  };

  return (
    <Button
      onClick={toggleLanguage}
      variant="outline"
      size="icon" // Makes the button square, good for icons or short text
      className="fixed top-4 right-4 z-50 rounded-full p-2 shadow-lg bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
      aria-label={i18n.language === 'id' ? t('switchToEnglish') : t('switchToIndonesian')} // For accessibility
      title={i18n.language === 'id' ? t('switchToEnglish') : t('switchToIndonesian')} // Tooltip
    >
      {/* <Globe className="h-5 w-5 mr-1" /> Optional Icon */}
      <span className="font-semibold">
        {i18n.language === 'id' ? 'EN' : 'ID'}
      </span>
    </Button>
  );
};

export default LanguageToggleButton;
