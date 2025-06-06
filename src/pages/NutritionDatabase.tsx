import { useState, useEffect } from 'react'; // Added useEffect
import { useTranslation } from 'react-i18next'; // Added for i18n
import { Link } from 'react-router-dom';
import axios from 'axios';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Terminal, Loader2, ArrowLeft } from "lucide-react";
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Added hook
import { FeatureName } from '@/lib/quotas'; // Import FeatureName from quotas.ts
import { useAuth } from '@/contexts/AuthContext'; // Added Auth context
import { useToast } from '@/components/ui/use-toast'; // Added toast
import { Skeleton } from "@/components/ui/skeleton"; // Added Skeleton

// --- Interfaces ---
interface Nutrient {
  nutrientId: number;
  nutrientName?: string; // Made optional as it might be missing
  name?: string; // Added potential alternative
  description?: string; // Added potential alternative
  nutrientNumber: string;
  unitName: string;
  value: number;
}

interface FoodNutrient {
  nutrient: Nutrient; 
  amount?: number; 
  nutrientAnalysisDetails?: any; 
  id: number; 
  type: string;
}

interface FoodItem {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  ingredients?: string;
}

interface FoodDetail extends FoodItem {
  foodNutrients?: FoodNutrient[];
}

interface FdcApiResponse {
  foods: FoodItem[];
  totalHits: number;
}

// --- Component ---
const NutritionDatabase = () => {
  const { t } = useTranslation(); // Added for i18n
  const featureName: FeatureName = 'nutrition_database';
  // Get isLoadingToggles from the hook
  const { checkAccess, incrementUsage, isLoadingToggles } = useFeatureAccess();
  const { toast } = useToast();
  const { openUpgradeDialog } = useAuth(); // Get the dialog function

  // State for initial access check
  const [isCheckingInitialAccess, setIsCheckingInitialAccess] = useState(true);
  const [initialAccessAllowed, setInitialAccessAllowed] = useState(false);
  const [initialAccessMessage, setInitialAccessMessage] = useState<string | null>(null);

  // Component state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false); // Loading for search action
  const [searchError, setSearchError] = useState<string | null>(null); // Error for search action

  const [selectedFoodDetails, setSelectedFoodDetails] = useState<FoodDetail | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // Loading for detail fetch
  const [detailError, setDetailError] = useState<string | null>(null); // Error for detail fetch

  const apiKey = import.meta.env.VITE_FDC_API_KEY;
  const searchApiUrl = 'https://api.nal.usda.gov/fdc/v1/foods/search';
  const detailApiUrlBase = 'https://api.nal.usda.gov/fdc/v1/food/';

  // Initial access check on mount
  useEffect(() => {
    // Only run verifyAccess if the hook is done loading toggles
    if (!isLoadingToggles) {
      const verifyInitialAccess = async () => {
        setIsCheckingInitialAccess(true); // Start page-specific check
        setInitialAccessMessage(null);
        try {
         const result = await checkAccess(featureName);
         if (result.quota === 0) {
              setInitialAccessAllowed(false);
              setInitialAccessMessage(result.message || t('nutritionDatabase.accessDeniedDefaultDescription'));
         } else {
              setInitialAccessAllowed(true);
         }
       } catch (error) {
         console.error("Error checking initial feature access:", error);
         setInitialAccessAllowed(false);
         setInitialAccessMessage(t('nutritionDatabase.toastAccessCheckError'));
         toast({
           title: t('nutritionDatabase.toastErrorTitle'),
           description: t('nutritionDatabase.toastAccessCheckError'),
           variant: "destructive",
         });
       } finally {
          setIsCheckingInitialAccess(false); // Finish page-specific check
        }
      };
      verifyInitialAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToggles]); // Re-run when hook loading state changes


  // --- Search Logic ---
  const handleSearch = async () => {
    // --- Action Access Check ---
     const accessResult = await checkAccess(featureName);
     if (!accessResult.allowed) {
       toast({
         title: t('nutritionDatabase.toastAccessDeniedTitle'),
         description: accessResult.message || t('nutritionDatabase.toastCannotSearchDescription'),
         variant: "destructive",
       });
       openUpgradeDialog(); // Open the upgrade dialog
       return; // Stop the search
    }
    // --- End Action Access Check ---

    if (!query.trim()) {
      // Use toast or keep setSearchError
      toast({ title: t('nutritionDatabase.toastInputErrorTitle'), description: t('nutritionDatabase.toastInputErrorDescription'), variant: "default" });
      // setSearchError(t('nutritionDatabase.toastInputErrorDescription'));
      setResults([]);
      return;
    }
    if (!apiKey) {
      setSearchError(t('nutritionDatabase.toastApiKeyMissingSearch'));
      return;
    }

    setIsLoadingSearch(true);
    setSearchError(null);
    setResults([]);
    setSelectedFoodDetails(null); 

    try {
      const response = await axios.get<FdcApiResponse>(searchApiUrl, {
        params: { api_key: apiKey, query: query, pageSize: 20 }
      });
      if (response.data?.foods?.length > 0) {
        setResults(response.data.foods);
      } else {
        setSearchError(t('nutritionDatabase.toastNoResultsForQuery', { query: query }));
      }
    } catch (err) {
      console.error("Search API Error:", err);
      setSearchError(axios.isAxiosError(err) ? t('nutritionDatabase.searchFailedError', { errorMessage: err.response?.data?.message || err.message }) : t('nutritionDatabase.unexpectedSearchError'));
    } finally {
      setIsLoadingSearch(false);
    }

    // --- Increment Usage ---
    await incrementUsage(featureName);
    // --- End Increment Usage ---
  };

  // --- Detail Fetch Logic ---
  // TODO: Consider if viewing details should consume a quota.
  // For now, it doesn't consume the 'nutrition_database' quota.
  const fetchFoodDetails = async (fdcId: number) => {
    if (!apiKey) {
      setDetailError(t('nutritionDatabase.toastApiKeyMissingDetails'));
      return;
    }
    
    setIsLoadingDetails(true);
    setDetailError(null);
    setSelectedFoodDetails(null); 

    try {
      const response = await axios.get<FoodDetail>(`${detailApiUrlBase}${fdcId}`, {
        params: { api_key: apiKey }
      });
      // --- ADDED CONSOLE LOG ---
      console.log("FDC Detail API Response:", response.data); 
      // --- END CONSOLE LOG ---
      setSelectedFoodDetails(response.data);
    } catch (err) {
      console.error("Detail API Error:", err);
      setDetailError(axios.isAxiosError(err) ? t('nutritionDatabase.fetchDetailsFailedError', { errorMessage: err.response?.data?.message || err.message }) : t('nutritionDatabase.unexpectedDetailError'));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  // --- Render ---
  return (
    <>
      <PageHeader 
        title={t('nutritionDatabase.pageTitle')}
        subtitle={t('nutritionDatabase.pageSubtitle')}
      />
      <div className="container max-w-7xl mx-auto px-4 py-12 space-y-6">

        {/* Show Skeleton if overall loading is true */}
        {(isCheckingInitialAccess || isLoadingToggles) && (
           <div className="flex flex-col space-y-3 mt-4">
             <Skeleton className="h-[50px] w-full max-w-lg mx-auto rounded-lg" />
             <Skeleton className="h-[200px] w-full rounded-lg" />
           </div>
         )}

         {/* Access Denied Message (Show only if NOT loading and access is denied) */}
         {!(isCheckingInitialAccess || isLoadingToggles) && !initialAccessAllowed && (
            <Alert variant="destructive" className="mt-4">
              <Terminal className="h-4 w-4" />
              <AlertTitle>{t('nutritionDatabase.accessDeniedTitle')}</AlertTitle>
              <AlertDescription>
                {initialAccessMessage || t('nutritionDatabase.accessDeniedDefaultDescription')}
              </AlertDescription>
            </Alert>
          )}

        {/* Render content only if NOT loading and access IS allowed */}
        {!(isCheckingInitialAccess || isLoadingToggles) && initialAccessAllowed && (
          <>
            {/* Search Bar */}
            <div className="flex w-full max-w-lg items-center space-x-2 mx-auto">
          <Input 
            type="text" 
            placeholder={t('nutritionDatabase.searchInputPlaceholder')}
            value={query}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isLoadingSearch}
          />
          <Button onClick={handleSearch} disabled={isLoadingSearch}>
            {isLoadingSearch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoadingSearch ? t('nutritionDatabase.searchingButton') : t('nutritionDatabase.searchButton')}
          </Button>
        </div>

        {/* Search Error Display */}
        {searchError && (
           <Alert variant="destructive" className="max-w-lg mx-auto">
             <Terminal className="h-4 w-4" />
             <AlertTitle>{t('nutritionDatabase.searchErrorTitle')}</AlertTitle>
             <AlertDescription>{searchError}</AlertDescription>
           </Alert>
        )}

        {/* Search Loading Indicator */}
        {isLoadingSearch && <p className="text-center">{t('nutritionDatabase.loadingSearchResults')}</p>}

        {/* Search Results Grid */}
        {!isLoadingSearch && results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((food) => (
              <Card key={food.fdcId} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{food.description}</CardTitle>
                  {food.brandOwner && <CardDescription>{t('nutritionDatabase.brandLabel')}: {food.brandOwner}</CardDescription>}
                  {food.dataType && <CardDescription>{t('nutritionDatabase.typeLabel')}: {food.dataType}</CardDescription>}
                </CardHeader>
                <CardContent className="flex-grow">
                  {food.ingredients && <p className="text-sm text-muted-foreground">{t('nutritionDatabase.ingredientsLabel')}: {food.ingredients.substring(0, 100)}{food.ingredients.length > 100 ? '...' : ''}</p>}
                  <p className="text-xs text-muted-foreground mt-2">{t('nutritionDatabase.fdcIdLabel')}: {food.fdcId}</p>
                </CardContent>
                <CardContent> 
                  {/* --- Detail Dialog Trigger --- */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full" onClick={() => fetchFoodDetails(food.fdcId)}>
                        {t('nutritionDatabase.viewDetailsButton')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[625px]">
                      <DialogHeader>
                        <DialogTitle>{selectedFoodDetails?.description ?? t('nutritionDatabase.detailsDialogLoadingTitle')}</DialogTitle>
                        <DialogDescription>
                          {t('nutritionDatabase.detailsDialogDescription')}
                        </DialogDescription>
                      </DialogHeader>
                      
                      {/* Detail Loading/Error/Content */}
                      {isLoadingDetails && <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                      {detailError && (
                        <Alert variant="destructive">
                          <Terminal className="h-4 w-4" />
                          <AlertTitle>{t('nutritionDatabase.errorLoadingDetailsTitle')}</AlertTitle>
                          <AlertDescription>{detailError}</AlertDescription>
                        </Alert>
                      )}
                      {!isLoadingDetails && selectedFoodDetails && (
                        <div className="max-h-[60vh] overflow-y-auto pr-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('nutritionDatabase.nutrientColumnHeader')}</TableHead>
                                <TableHead className="text-right">{t('nutritionDatabase.amountColumnHeader')}</TableHead>
                                <TableHead>{t('nutritionDatabase.unitColumnHeader')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedFoodDetails.foodNutrients && selectedFoodDetails.foodNutrients.length > 0 ? (
                                selectedFoodDetails.foodNutrients
                                  // Filter for nutrients that have a defined amount or value
                                  .filter(fn => (fn.amount !== undefined && fn.amount !== null) || (fn.nutrient?.value !== undefined && fn.nutrient?.value !== null))
                                  .map((fn) => {
                                    // --- Attempt to find nutrient name from multiple potential properties ---
                                    let nutrientNameDisplay = t('nutritionDatabase.nutrientNameMissing'); // Default if name cannot be found
                                    let unitNameDisplay = t('nutritionDatabase.unitNameMissing'); // Default unit
                                    
                                    if (fn.nutrient) { // Check if nutrient object exists
                                      // Try nutrientName, then name, then description
                                      nutrientNameDisplay = (fn.nutrient.nutrientName && fn.nutrient.nutrientName.trim() !== '') 
                                                            ? fn.nutrient.nutrientName 
                                                            : (fn.nutrient.name && fn.nutrient.name.trim() !== '')
                                                              ? fn.nutrient.name
                                                              : (fn.nutrient.description && fn.nutrient.description.trim() !== '')
                                                                ? fn.nutrient.description
                                                                : t('nutritionDatabase.nutrientNameMissing'); // Final fallback if all are missing/empty
                                      
                                      // Check if unitName exists and is not empty
                                      unitNameDisplay = fn.nutrient.unitName && fn.nutrient.unitName.trim() !== '' 
                                                          ? fn.nutrient.unitName 
                                                          : t('nutritionDatabase.unitNameMissing'); // Fallback if unit is missing/empty
                                    } else {
                                      nutrientNameDisplay = t('nutritionDatabase.nutrientDataMissing'); // Fallback if nutrient object itself is missing
                                    }

                                    // Determine the amount to display
                                    const displayAmount = (fn.amount ?? fn.nutrient?.value)?.toFixed(2) ?? t('nutritionDatabase.amountMissing');

                                    return (
                                      <TableRow key={fn.id || fn.nutrient?.nutrientId}>
                                        <TableCell>{nutrientNameDisplay}</TableCell> 
                                        <TableCell className="text-right">{displayAmount}</TableCell>
                                        <TableCell>{unitNameDisplay}</TableCell>
                                      </TableRow>
                                    );
                                  })
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center">{t('nutritionDatabase.noNutrientData')}</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="secondary">
                            {t('nutritionDatabase.closeButton')}
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
            )}
          </>
        )} {/* End of initialAccessAllowed block */}

        {/* Back to Tools Button */}
        <div className="flex justify-center mt-8 mb-4">
          <Link to="/tools">
            <Button variant="outline" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('nutritionDatabase.backToToolsButton')}
            </Button>
          </Link>
        </div>
        
      </div>
    </>
  );
};

export default NutritionDatabase;
