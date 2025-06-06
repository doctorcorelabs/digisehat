import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, X, Loader2, Sparkles, ArrowLeft, Terminal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // useAuth is already imported
import { useNavigate, Link } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Import feature access hook
import { FeatureName } from '@/lib/quotas'; // Import FeatureName from quotas.ts
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

interface InteractionResult {
  pair: string[];
  severity: string;
  description: string;
  summary?: string;
  isSummarizing?: boolean;
  summaryError?: string;
}

const InteractionChecker = () => {
  const featureName: FeatureName = 'interaction_checker';
  const { isAuthenticated, openUpgradeDialog } = useAuth(); // Get openUpgradeDialog
  // Get isLoadingToggles from the hook
  const { checkAccess, incrementUsage, isLoadingToggles } = useFeatureAccess();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation(); // Destructure i18n here
  const [drugs, setDrugs] = useState<string[]>(['', '']);
  const [results, setResults] = useState<InteractionResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for access check result
  // Removed isCheckingInitialAccess state
  const [initialAccessAllowed, setInitialAccessAllowed] = useState(false);
  const [initialAccessMessage, setInitialAccessMessage] = useState<string | null>(null);

  // Initial access check on mount
  useEffect(() => {
    // Only run verifyAccess if the hook is done loading toggles
    if (!isLoadingToggles) {
      const verifyInitialAccess = async () => {
        // Removed setIsCheckingInitialAccess(true)
        setInitialAccessMessage(null); // Clear message before check
        if (!isAuthenticated) {
          // Should ideally be handled by ProtectedRoute, but double-check
          navigate('/signin');
          return;
        }
        try {
          const result = await checkAccess(featureName);
         if (result.quota === 0 || result.isDisabled) { // Check if denied by level/toggle
              setInitialAccessAllowed(false);
              setInitialAccessMessage(result.message || t('interactionCheckerPage.accessDenied.defaultMessage'));
         } else {
              setInitialAccessAllowed(true); // Allow rendering the UI
         }
       } catch (error) {
         console.error("Error checking initial feature access:", error);
         setInitialAccessAllowed(false);
         setInitialAccessMessage(t('interactionCheckerPage.accessDenied.failedToVerify'));
         toast({
           title: t('interactionCheckerPage.toastTitles.error'),
           description: t('interactionCheckerPage.accessDenied.couldNotVerify'),
           variant: "destructive",
         });
       } // Removed finally block
    };
      verifyInitialAccess();
    }
  }, [isLoadingToggles]); // Simplify dependency array

  const handleInputChange = (index: number, value: string) => {
    const newDrugs = [...drugs];
    newDrugs[index] = value;
    setDrugs(newDrugs);
  };

  const addDrugInput = () => {
    setDrugs([...drugs, '']);
  };

  const removeDrugInput = (index: number) => {
    if (drugs.length > 2) {
      const newDrugs = drugs.filter((_, i) => i !== index);
      setDrugs(newDrugs);
    }
  };

  const handleCheckInteractions = async () => {
    const validDrugs = drugs.map(d => d.trim()).filter(d => d.length > 0);
    if (validDrugs.length < 2) {
      setError(t('interactionCheckerPage.errorMessages.atLeastTwoDrugs'));
      setResults(null);
      return;
    }

    // --- Action Access Check ---
     const accessResult = await checkAccess(featureName);
     if (!accessResult.allowed) {
       toast({
         title: t('interactionCheckerPage.toastTitles.accessDenied'),
         description: accessResult.message || t('interactionCheckerPage.toastDescriptions.accessDeniedInteractionCheck'),
         variant: "destructive",
       });
       openUpgradeDialog(); // Open the upgrade dialog
       return; // Stop the check
    }
    // --- End Action Access Check ---

    setIsLoading(true);
    setError(null);
    setResults(null);

    const isProduction = import.meta.env.MODE === 'production';
    const interactionWorkerUrl = isProduction
      ? 'https://interaction-checker-worker.daivanfebrijuansetiya.workers.dev'
      : 'http://127.0.0.1:8787';

    try {
      console.log(`Sending drugs to worker (${isProduction ? 'prod' : 'dev'}):`, validDrugs);
      const response = await fetch(interactionWorkerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs: validDrugs }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Worker API Error:', data);
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      console.log('Received interactions from worker:', data.interactions);
      setResults(data.interactions || []);

    } catch (err: any) {
      console.error('Error checking interactions:', err);
      setError(err.message || t('interactionCheckerPage.errorMessages.failedToFetch'));
      setResults(null);
    } finally {
      setIsLoading(false);
    }

    // --- Increment Usage ---
    await incrementUsage(featureName);
    // --- End Increment Usage ---
  };

  const handleSummarize = useCallback(async (index: number) => {
    if (!results || !results[index] || !results[index].description) return;

    let textToSummarizeForWorker = results[index].description;
    const currentLanguage = i18n.language;

    if (currentLanguage === 'id') {
      textToSummarizeForWorker = `Tolong ringkas teks berikut dalam Bahasa Indonesia: "${results[index].description}"`;
    }

    if (!textToSummarizeForWorker || textToSummarizeForWorker.trim().length === 0) {
      console.warn(`Attempted to summarize empty description for interaction index ${index}. Aborting.`);
      toast({
           title: t('interactionCheckerPage.toastTitles.cannotSummarize'),
           description: t('interactionCheckerPage.toastDescriptions.cannotSummarizeEmpty'),
           variant: "destructive",
      });
      return;
    }

    setResults(currentResults =>
      currentResults?.map((res, i) =>
        i === index ? { ...res, isSummarizing: true, summaryError: undefined, summary: undefined } : res
      ) || null
    );

    const isProduction = import.meta.env.MODE === 'production';
    const geminiWorkerUrl = isProduction
      ? 'https://gemini-cf-worker.daivanfebrijuansetiya.workers.dev'
      : 'http://127.0.0.1:8788';

    try {
      console.log(`Sending text to Gemini worker (${isProduction ? 'prod' : 'dev'}) for summarization (interaction index ${index})`);
      const response = await fetch(geminiWorkerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textToSummarize: textToSummarizeForWorker }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Gemini Worker API Error:', data);
        throw new Error(data.error || `Summarization request failed with status ${response.status}`);
      }

      console.log(`Received summary from Gemini worker (interaction index ${index})`);
      setResults(currentResults =>
        currentResults?.map((res, i) =>
          i === index ? { ...res, isSummarizing: false, summary: data.responseText || t('interactionCheckerPage.errorMessages.summaryNotAvailable') } : res
        ) || null
      );

    } catch (err: any) {
      console.error('Error summarizing interaction:', err);
      setResults(currentResults =>
        currentResults?.map((res, i) =>
          i === index ? { ...res, isSummarizing: false, summaryError: err.message || t('interactionCheckerPage.errorMessages.failedToGetSummary') } : res
        ) || null
      );
    }
  }, [results, toast, i18n.language]); // Add i18n.language to dependencies

  const renderMarkdown = (text: string) => {
    if (!text) return { __html: '' };
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br />');
    return { __html: html };
  };

  return (
    <>
      <PageHeader
        title={t('interactionCheckerPage.headerTitle')}
        subtitle={t('interactionCheckerPage.headerSubtitle')}
      />
      <div className="container max-w-4xl mx-auto px-4 py-12">

        {/* Show Skeleton only based on the hook's loading state */}
        {isLoadingToggles && (
           <div className="flex flex-col space-y-3 mt-4">
             <Skeleton className="h-[150px] w-full rounded-lg" />
             <Skeleton className="h-[200px] w-full rounded-lg" />
           </div>
         )}

         {/* Access Denied Message (Show only if hook is NOT loading and access is denied) */}
         {!isLoadingToggles && !initialAccessAllowed && (
            <Alert variant="destructive" className="mt-4">
              <Terminal className="h-4 w-4" />
              <AlertTitle>{t('interactionCheckerPage.accessDenied.title')}</AlertTitle>
              <AlertDescription>
                {initialAccessMessage || t('interactionCheckerPage.accessDenied.defaultMessage')}
              </AlertDescription>
            </Alert>
          )}

        {/* Render content only if NOT loading and access IS allowed */}
        {!isLoadingToggles && initialAccessAllowed && (
         <>
            <Card>
              <CardHeader>
                <CardTitle>{t('interactionCheckerPage.enterDrugsCard.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {drugs.map((drug, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      type="text"
                      placeholder={t('interactionCheckerPage.enterDrugsCard.drugInputPlaceholder', { index: index + 1 })}
                      value={drug}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      className="flex-grow"
                    />
                    {drugs.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => removeDrugInput(index)} aria-label={t('interactionCheckerPage.enterDrugsCard.removeDrugButtonLabel')}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center">
                   <Button variant="outline" onClick={addDrugInput}>
                     {t('interactionCheckerPage.enterDrugsCard.addAnotherDrugButton')}
                   </Button>
                   <Button
                     onClick={handleCheckInteractions}
                     disabled={isLoading || drugs.filter(d => d.trim().length > 0).length < 2}
                     className="bg-medical-teal hover:bg-medical-blue"
                   >
                     {isLoading ? t('interactionCheckerPage.enterDrugsCard.checkingButton') : t('interactionCheckerPage.enterDrugsCard.checkInteractionsButton')}
                   </Button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-300 rounded">
                <p>{error}</p>
              </div>
            )}

            {isLoading && (
               <div className="mt-6 text-center">
                 <Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />
                 <span>{t('interactionCheckerPage.loadingText')}</span>
               </div>
             )}

            {results && !isLoading && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>{t('interactionCheckerPage.resultsCard.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {results.length === 0 ? (
                    <p>{t('interactionCheckerPage.resultsCard.noSignificantInteractions')}</p>
                  ) : (
                    <ul className="space-y-4">
                      {results.map((result, index) => (
                        <li key={index} className="p-4 border rounded shadow-sm">
                          <div className="flex items-center mb-2">
                            <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                            <strong className="text-lg">{result.pair.join(' + ')}</strong>
                          </div>
                          <p className="text-gray-700 text-justify mb-3">{result.description}</p>
                          {i18n.language === 'id' && (
                            <p className="text-xs text-gray-500 italic mt-1 mb-2">
                              {t('interactionCheckerPage.resultsCard.openFDANote')}
                            </p>
                          )}
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            {result.isSummarizing ? (
                              <div className="flex items-center text-sm text-gray-500">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('interactionCheckerPage.resultsCard.generatingSummary')}
                              </div>
                            ) : result.summaryError ? (
                              <div className="text-sm text-red-600">
                                {t('interactionCheckerPage.resultsCard.errorSummarizing', { error: result.summaryError })}
                              </div>
                            ) : result.summary ? (
                              <div>
                                <h4 className="text-sm font-semibold mb-1 flex items-center">
                                  <Sparkles className="h-4 w-4 mr-1 text-yellow-500" />
                                  {t('interactionCheckerPage.resultsCard.aiSummaryTitle')}
                                </h4>
                                <p
                                  className="text-sm text-gray-600 text-justify"
                                  dangerouslySetInnerHTML={renderMarkdown(result.summary)}
                                />
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSummarize(index)}
                                disabled={result.isSummarizing}
                              >
                                {t('interactionCheckerPage.resultsCard.summarizeWithAIButton')}
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                     </ul>
                   )}
                    <p className="mt-4 text-sm text-gray-500 italic text-justify">
                      {t('interactionCheckerPage.resultsCard.disclaimer')}
                    </p>
                 </CardContent>
              </Card>
            )}
         </>
        )} {/* End of initialAccessAllowed block */}
      </div>

      {/* Back to Tools Button - Always visible outside the conditional block */}
      <div className="flex justify-center mt-8 mb-4">
        <Link to="/tools">
          <Button variant="outline" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('interactionCheckerPage.backToToolsButton')}
          </Button>
        </Link>
      </div>
    </>
  );
};

export default InteractionChecker;
