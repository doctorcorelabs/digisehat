import { useEffect, useState, useCallback } from 'react'; // Added useState, useCallback
import { useTranslation } from 'react-i18next'; // Import useTranslation
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stethoscope, Book, Brain, FlaskConical, FileSearch, Calculator, Pill, HeartPulse, Apple, FileText, Computer, AlertTriangle, Network, ClipboardList, XCircle, Bot } from 'lucide-react'; // Added XCircle
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Import hook
import { FeatureName } from '@/lib/quotas';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

// Define a type for the tool data, including the feature name key
interface ToolData {
  id: number;
  titleKey: string; // Changed from title to titleKey
  descriptionKey: string; // Changed from description to descriptionKey
  icon: React.ElementType; // Use ElementType for component icons
  path: string;
  featureName?: FeatureName; // Make featureName optional
  comingSoon: boolean;
}

// Updated toolsData with translation keys
const toolsData: ToolData[] = [
  {
    id: 1,
    featureName: 'medical_calculator',
    titleKey: 'toolsPage.medicalCalculator.title',
    descriptionKey: 'toolsPage.medicalCalculator.description',
    icon: Calculator,
    path: '/tools/medical-calculator',
    comingSoon: false
  },
  {
    id: 2,
    featureName: 'drug_reference',
    titleKey: 'toolsPage.drugReference.title',
    descriptionKey: 'toolsPage.drugReference.description',
    icon: Pill,
    path: '/tools/drug-reference',
    comingSoon: false
  },
  {
    id: 3,
    featureName: 'nutrition_database',
    titleKey: 'toolsPage.nutritionDatabase.title',
    descriptionKey: 'toolsPage.nutritionDatabase.description',
    icon: Apple,
    path: '/tools/nutrition-database',
    comingSoon: false
  },
  {
    id: 4,
    featureName: 'disease_library',
    titleKey: 'toolsPage.diseaseLibrary.title',
    descriptionKey: 'toolsPage.diseaseLibrary.description',
    icon: Book,
    path: '/tools/disease-library',
    comingSoon: false
  },
  {
    id: 5,
    featureName: 'clinical_guidelines',
    titleKey: 'toolsPage.clinicalGuidelines.title',
    descriptionKey: 'toolsPage.clinicalGuidelines.description',
    icon: FileSearch,
    path: '/tools/clinical-guidelines',
    comingSoon: false
  },
  {
    id: 6,
    featureName: 'ai_chatbot',
    titleKey: 'toolsPage.aiChatbot.title',
    descriptionKey: 'toolsPage.aiChatbot.description',
    icon: Brain,
    path: '/tools/ai-chatbot',
    comingSoon: false
  },
  {
    id: 7,
    featureName: 'ai_peer_review',
    titleKey: 'toolsPage.aiPeerReview.title',
    descriptionKey: 'toolsPage.aiPeerReview.description',
    icon: FileText,
    path: '/tools/ai-peer-review',
    comingSoon: false
  },
  {
    id: 8,
    featureName: 'explore_gemini',
    titleKey: 'toolsPage.exploreGemini.title',
    descriptionKey: 'toolsPage.exploreGemini.description',
    icon: Computer,
    path: '/tools/explore-gemini',
    comingSoon: false
  },
  {
    id: 9,
    featureName: 'explore_deepseek',
    titleKey: 'toolsPage.exploreDeepSeek.title',
    descriptionKey: 'toolsPage.exploreDeepSeek.description',
    icon: Bot,
    path: '/tools/explore-deepseek',
    comingSoon: false
  },
  {
    id: 10,
    featureName: 'interaction_checker',
    titleKey: 'toolsPage.interactionChecker.title',
    descriptionKey: 'toolsPage.interactionChecker.description',
    icon: AlertTriangle,
    path: '/tools/interaction-checker',
    comingSoon: false
  },
  {
    id: 11,
    featureName: 'mind_map_maker',
    titleKey: 'toolsPage.aiMindMapGenerator.title',
    descriptionKey: 'toolsPage.aiMindMapGenerator.description',
    icon: Network,
    path: '/tools/ai-mindmap-generator',
    comingSoon: false
  },
  {
    id: 12,
    featureName: 'clinical_scoring',
    titleKey: 'toolsPage.clinicalScoringHub.title',
    descriptionKey: 'toolsPage.clinicalScoringHub.description',
    icon: ClipboardList,
    path: '/tools/clinical-scoring-hub',
    comingSoon: false
  },
  {
    id: 13,
    titleKey: 'toolsPage.learningResources.title',
    descriptionKey: 'toolsPage.learningResources.description',
    icon: Book,
    path: '/tools/learning-resources',
    comingSoon: false
  }
];

// --- ToolCard Component ---
interface ToolCardProps {
  tool: ToolData;
  onDisabledClick: (titleKey: string) => void; // Changed to titleKey
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onDisabledClick }) => {
  const { t } = useTranslation(); // Add useTranslation here
  const { checkAccess } = useFeatureAccess();
  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading

  useEffect(() => {
    let isMounted = true;
    // Only check access if a featureName is provided
    if (tool.featureName) {
      const verifyAccess = async () => {
        try {
          // Ensure featureName exists before calling checkAccess
          if (tool.featureName) {
            const result = await checkAccess(tool.featureName);
            if (isMounted) {
              setIsDisabled(result.isDisabled ?? false); // Set disabled state based on check
            }
          } else {
             // Should not happen due to outer check, but safe fallback
             if (isMounted) setIsDisabled(false);
          }
        } catch (error) {
          console.error(`Error checking access for ${tool.featureName}:`, error);
          if (isMounted) {
            setIsDisabled(false); // Default to not disabled on error
          }
        } finally {
           if (isMounted) setIsLoading(false); // Finish loading regardless of outcome
        }
      };
      verifyAccess();
    } else {
      // If no featureName, the tool is always enabled and not loading access status
      setIsDisabled(false);
      setIsLoading(false);
    }
    return () => { isMounted = false; };
  }, [checkAccess, tool.featureName]); // Keep dependencies

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault(); // Prevent default if it was somehow wrapped in a link
      onDisabledClick(tool.titleKey); // Trigger the modal, use titleKey
    }
    // If not disabled, the Link component will handle navigation
  };

  const renderButton = () => {
    if (tool.comingSoon) {
      return (
        <Button className="w-full bg-gray-400 cursor-not-allowed" disabled>
          Coming Soon
        </Button>
      );
    }

    if (isLoading) {
      // Only show skeleton if loading is relevant (i.e., featureName exists)
      return tool.featureName ? <Skeleton className="h-10 w-full" /> : null;
    }

    // Determine if the button should be disabled (only relevant if featureName exists)
    const isEffectivelyDisabled = tool.featureName ? isDisabled : false;

    const buttonContent = (
      <Button
        className={`w-full ${isEffectivelyDisabled ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed' : 'bg-medical-teal hover:bg-medical-blue'}`}
        onClick={isEffectivelyDisabled ? handleButtonClick : undefined} // Only attach onClick if disabled
        aria-disabled={isEffectivelyDisabled} // Indicate disabled state for accessibility
      >
        Launch Tool
      </Button>
    );

    // If effectively disabled (and has a featureName), wrap in AlertDialogTrigger
    // Otherwise (enabled or no featureName), wrap in Link
    return isEffectivelyDisabled && tool.featureName ? (
      <AlertDialogTrigger asChild>{buttonContent}</AlertDialogTrigger>
    ) : (
      <Link to={tool.path} className="w-full">
        {buttonContent}
      </Link>
    );
  };

  return (
    <Card className="flex flex-col h-full transition-all duration-300 hover:shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <tool.icon className="h-8 w-8 text-medical-teal" />
          {tool.comingSoon && (
            <span className="text-xs bg-amber-100 text-amber-800 py-1 px-2 rounded-full font-medium">
              Coming Soon
            </span>
          )}
        </div>
        <CardTitle className="mt-2">{t(tool.titleKey)}</CardTitle>
        <CardDescription className="text-justify">{t(tool.descriptionKey)}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {/* Optional: Add more content here if needed */}
      </CardContent>
      <CardFooter>
        {renderButton()}
      </CardFooter>
    </Card>
  );
};
// --- End ToolCard Component ---

const Tools = () => {
  const { t } = useTranslation(); // Add useTranslation here
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitleKey, setModalTitleKey] = useState(''); // Changed to modalTitleKey

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin');
    }
  }, [isAuthenticated, navigate]);

  const handleDisabledToolClick = useCallback((toolTitleKey: string) => { // Changed to toolTitleKey
    setModalTitleKey(toolTitleKey); // Changed to setModalTitleKey
    setIsModalOpen(true);
  }, []);

  return (
    <>
      <PageHeader
        title="toolsPage.header.title" // Use translation key
        subtitle="toolsPage.header.subtitle" // Use translation key
       />

      {/* Adjusted padding for better mobile spacing */}
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {toolsData.map((tool) => (
            // Use AlertDialog for each card to manage its own trigger state
            <AlertDialog key={tool.id} open={isModalOpen && modalTitleKey === tool.titleKey} onOpenChange={(open) => { if (!open) setIsModalOpen(false); }}>
              <ToolCard tool={tool} onDisabledClick={handleDisabledToolClick} />
              {/* Modal Content - Placed inside the loop but only shown when triggered */}
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                     <XCircle className="h-5 w-5 text-red-500" /> {t('toolsPage.accessDenied.title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('toolsPage.accessDenied.description', { toolName: t(modalTitleKey) })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setIsModalOpen(false)}>Close</AlertDialogCancel>
                  {/* No action button needed */}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ))}
        </div>
      </div>
    </>
  );
};

export default Tools;
