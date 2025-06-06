import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft, Terminal } from 'lucide-react'; // Added Terminal
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Import hook
import { FeatureName } from '@/lib/quotas'; // Import FeatureName from quotas.ts
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
const AIChatbot = () => {
  const { t } = useTranslation();
  const featureName: FeatureName = 'ai_chatbot';
  // Get isLoadingToggles from the hook
  const { checkAccess, incrementUsage, isLoadingToggles } = useFeatureAccess();
  const { toast } = useToast();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true); // Still track page-specific check
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Only run verifyAccess if the hook is done loading toggles
    if (!isLoadingToggles) {
      const verifyAccess = async () => {
        setIsCheckingAccess(true); // Start page-specific check
        setAccessMessage(null);
        try {
          const result = await checkAccess(featureName);
          setAccessAllowed(result.allowed);
          if (result.allowed) {
            // Increment usage only if access is granted
            // We increment usage *before* the user interacts with the iframe
            // Alternatively, could increment based on iframe interaction, but that's more complex.
            await incrementUsage(featureName);
            // Optionally show remaining quota
            // if (result.remaining !== null) {
            //   toast({ title: "Info", description: `Remaining quota for ${featureName.replace(/_/g, ' ')}: ${result.remaining}` });
            // }
          } else {
            setAccessMessage(result.message || 'Access denied.'); // Set message if denied
          }
        } catch (error) {
          console.error("Error checking feature access:", error);
          setAccessAllowed(false);
          setAccessMessage('Failed to check feature access.');
          toast({
            title: "Error",
            description: "Could not verify feature access at this time.",
            variant: "destructive",
          });
        } finally {
          setIsCheckingAccess(false); // Finish page-specific check
        }
      };
      verifyAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToggles]); // Re-run when hook loading state changes

  // Determine overall loading state
  const isLoading = isCheckingAccess || isLoadingToggles;

  return (
    <>
      <PageHeader
        title={t('aiChatbotPage.title')}
        subtitle={t('aiChatbotPage.subtitle')}
       />
       {/* Make this container grow and use flexbox for the iframe */}
       <div className="container max-w-7xl mx-auto px-4 flex flex-col flex-grow">

         {/* Show Skeleton if overall loading is true */}
         {isLoading && (
            <div className="flex flex-col space-y-3 mt-4">
              <Skeleton className="h-[50px] w-full rounded-lg" />
              <Skeleton className="h-[600px] w-full rounded-lg" />
            </div>
          )}

           {/* Access Denied Message (Show only if NOT loading and access is denied) */}
           {!isLoading && !accessAllowed && (
              <Alert variant="destructive" className="mt-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>{t('aiChatbotPage.accessDenied.title')}</AlertTitle>
                <AlertDescription>
                  {accessMessage || t('aiChatbotPage.accessDenied.defaultMessage')}
                </AlertDescription>
              </Alert>
            )}

         {/* Feature Content (Iframe) - Render only if NOT loading and access IS allowed */}
         {!isLoading && accessAllowed && (
           <iframe
             className="flex-grow mt-4"
             src="https://udify.app/chatbot/75qYJluLWB08Iupl"
             style={{ width: '100%', border: 'none', minHeight: '700px' }} // Removed fixed height, keep minHeight
              allow="microphone">
            </iframe>
         )}

          {/* Back to Tools Button */}
          <div className="flex justify-center mt-8 mb-4"> {/* Added mb-4 for spacing above footer */}
            <Link to="/tools">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft size={16} />
                {t('aiChatbotPage.backToTools')}
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
};

export default AIChatbot;
