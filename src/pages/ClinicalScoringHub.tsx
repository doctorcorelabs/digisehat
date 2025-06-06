import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/PageHeader';
import ChadsvascScore from '@/components/scores/ChadsvascScore';
import WellsScoreDvt from '@/components/scores/WellsScoreDvt';
import WellsScorePe from '@/components/scores/WellsScorePe';
import GcsScore from '@/components/scores/GcsScore';
import Curb65Score from '@/components/scores/Curb65Score';
import MeldScore from '@/components/scores/MeldScore';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Terminal } from 'lucide-react'; // Added Terminal
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Import hook
import { FeatureName } from '@/lib/quotas'; // Import FeatureName from quotas.ts
import { useToast } from '@/components/ui/use-toast'; // Added toast
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Added Alert
import { Skeleton } from '@/components/ui/skeleton'; // Added Skeleton
import { useTranslation } from 'react-i18next'; // Added for i18n

const ClinicalScoringHub: React.FC = () => {
  const { t } = useTranslation(); // Added for i18n
  const featureName: FeatureName = 'clinical_scoring';
  const { checkAccess, incrementUsage, isLoadingToggles } = useFeatureAccess();
  const { toast } = useToast();

  // State for access check result
  const [initialAccessAllowed, setInitialAccessAllowed] = useState(false);
  const [initialAccessMessage, setInitialAccessMessage] = useState<string | null>(null);

  // Initial access check on mount
  useEffect(() => {
    // Define the async function first
    const verifyInitialAccess = async () => {
      setInitialAccessMessage(null);
      try {
        const result = await checkAccess(featureName);
         // Check the result inside the try block
         if (result.quota === 0 || result.isDisabled) {
            setInitialAccessAllowed(false);
            setInitialAccessMessage(result.message || 'Access denied.');
         } else {
            setInitialAccessAllowed(true);
         }
       } catch (error) { // Catch block correctly placed for the try
         console.error("Error checking initial feature access:", error);
         setInitialAccessAllowed(false);
         setInitialAccessMessage('Failed to check feature access.');
         toast({
           title: "Error",
           description: "Could not verify feature access at this time.",
           variant: "destructive",
         });
       }
    }; // End of verifyInitialAccess async function

    // Only run verifyAccess if the hook is done loading toggles
    if (!isLoadingToggles) {
      verifyInitialAccess(); // Call the function conditionally
    } // End of if (!isLoadingToggles)
  }, [isLoadingToggles]); // Simplify dependency array

  // TODO: Pass incrementUsage down to individual score components or have them use the hook.
  // For now, usage is only checked on initial load.

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title={t('clinicalScoringHubPage.header.title')}
        subtitle={t('clinicalScoringHubPage.header.subtitle')}
      />

      {/* Show Skeleton only based on the hook's loading state */}
      {isLoadingToggles && (
         <div className="flex flex-col space-y-3 mt-6">
           <Skeleton className="h-[150px] w-full rounded-lg" />
           <Skeleton className="h-[150px] w-full rounded-lg" />
           <Skeleton className="h-[300px] w-full rounded-lg" />
         </div>
       )}

       {/* Access Denied Message (Show only if hook is NOT loading and access is denied) */}
       {!isLoadingToggles && !initialAccessAllowed && (
          <Alert variant="destructive" className="mt-6">
            <Terminal className="h-4 w-4" />
            <AlertTitle>{t('clinicalScoringHubPage.accessDenied.title')}</AlertTitle>
            <AlertDescription>
              {initialAccessMessage || t('clinicalScoringHubPage.accessDenied.defaultMessage')}
            </AlertDescription>
          </Alert>
        )}

      {/* Render content only if NOT loading and access IS allowed */}
      {!isLoadingToggles && initialAccessAllowed && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {/* Placeholder for Score Categories/Calculators */}
            <Card>
          <CardHeader>
            <CardTitle>{t('clinicalScoringHubPage.cardiologyScores.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-justify">{t('clinicalScoringHubPage.cardiologyScores.description')}</p>
            {/* Links or embedded calculators will go here */}
            <p className="mt-4 text-sm text-muted-foreground text-justify">{t('clinicalScoringHubPage.cardiologyScores.examples')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('clinicalScoringHubPage.pulmonologyScores.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-justify">{t('clinicalScoringHubPage.pulmonologyScores.description')}</p>
            {/* Links or embedded calculators will go here */}
             <p className="mt-4 text-sm text-muted-foreground text-justify">{t('clinicalScoringHubPage.pulmonologyScores.examples')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('clinicalScoringHubPage.gastroenterologyScores.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-justify">{t('clinicalScoringHubPage.gastroenterologyScores.description')}</p>
            {/* Links or embedded calculators will go here */}
             <p className="mt-4 text-sm text-muted-foreground text-justify">{t('clinicalScoringHubPage.gastroenterologyScores.examples')}</p>
          </CardContent>
        </Card>

         <Card>
          <CardHeader>
            <CardTitle>{t('clinicalScoringHubPage.otherScores.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-justify">{t('clinicalScoringHubPage.otherScores.description')}</p>
            {/* Links or embedded calculators will go here */}
             <p className="mt-4 text-sm text-muted-foreground text-justify">{t('clinicalScoringHubPage.otherScores.examples')}</p>
          </CardContent>
        </Card>
        {/* Add more category cards as needed */}
      </div>

      {/* Display Calculators Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">{t('clinicalScoringHubPage.calculatorsSectionTitle')}</h2>
        {/* We can add logic here later to select which calculator to show */}
        {/* For now, just display the CHADS2-VASc */}
        <ChadsvascScore />
        <WellsScoreDvt />
        <WellsScorePe />
        <GcsScore />
        <Curb65Score />
        <MeldScore />

        {/* Placeholder for other calculators */}
      </div>

      {/* Back to Tools Button */}
      <div className="mt-12 mb-8 flex justify-center">
        <Link to="/tools">
          <Button variant="outline" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('clinicalScoringHubPage.buttons.backToTools')}
          </Button>
        </Link>
      </div>
     </>
    )} {/* End of initialAccessAllowed block */}
    </div>
  );
};

export default ClinicalScoringHub;
