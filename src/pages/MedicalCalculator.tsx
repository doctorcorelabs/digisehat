import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { TFunction } from 'i18next'; // Import TFunction
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, AlertTriangle, Terminal } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Import hook
import { FeatureName } from '@/lib/quotas'; // Import FeatureName from quotas.ts
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from "@/components/ui/skeleton";

// --- Helper Functions ---
// BMI Calculation
const calculateBMI = (weightKg: number, heightM: number): number | null => {
  if (heightM <= 0 || weightKg <= 0) return null;
  return weightKg / (heightM * heightM);
};

// BMI Interpretation
const interpretBMI = (bmi: number | null, t: TFunction): { text: string; color: string } => {
  if (bmi === null) return { text: '', color: 'text-gray-500' };
  if (bmi < 18.5) return { text: t('medicalCalculatorPage.bmi.interpretation.underweight'), color: 'text-blue-600' };
  if (bmi < 25) return { text: t('medicalCalculatorPage.bmi.interpretation.normal'), color: 'text-green-600' };
  if (bmi < 30) return { text: t('medicalCalculatorPage.bmi.interpretation.overweight'), color: 'text-yellow-600' };
  return { text: t('medicalCalculatorPage.bmi.interpretation.obese'), color: 'text-red-600' };
};

// BSA Calculation (Mosteller)
const calculateBSA = (weightKg: number, heightCm: number): number | null => {
  if (weightKg <= 0 || heightCm <= 0) return null;
  return Math.sqrt((weightKg * heightCm) / 3600);
};

// BSA Interpretation
const interpretBSA = (bsa: number | null, t: TFunction): { text: string; color: string } => {
  if (bsa === null) return { text: '', color: 'text-gray-500' };
  return {
    text: t('medicalCalculatorPage.bsa.interpretation.typical'),
    color: 'text-gray-600'
  };
};

// eGFR Calculation (CKD-EPI 2021 without race)
const calculateGFR_CKDEPI = (creatinineMgDl: number, age: number, sex: 'male' | 'female'): number | null => {
  if (creatinineMgDl <= 0 || age <= 0) return null;
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const sexFactor = sex === 'female' ? 1.012 : 1.0;
  const scrOverKappa = creatinineMgDl / kappa;
  const term1 = Math.min(scrOverKappa, 1) ** alpha;
  const term2 = Math.max(scrOverKappa, 1) ** -1.200;
  const ageFactor = 0.9938 ** age;
  const egfr = 142 * term1 * term2 * ageFactor * sexFactor;
  return egfr;
};

// eGFR Interpretation (KDIGO Stages)
const interpretGFR = (gfr: number | null, t: TFunction): { text: string; stage: string; color: string } => {
  if (gfr === null) return { text: '', stage: '', color: 'text-gray-500' };
  if (gfr >= 90) return { text: t('medicalCalculatorPage.egfr.interpretation.stage1_desc'), stage: t('medicalCalculatorPage.egfr.interpretation.stage1'), color: 'text-green-600' };
  if (gfr >= 60) return { text: t('medicalCalculatorPage.egfr.interpretation.stage2_desc'), stage: t('medicalCalculatorPage.egfr.interpretation.stage2'), color: 'text-lime-600' };
  if (gfr >= 45) return { text: t('medicalCalculatorPage.egfr.interpretation.stage3a_desc'), stage: t('medicalCalculatorPage.egfr.interpretation.stage3a'), color: 'text-yellow-600' };
  if (gfr >= 30) return { text: t('medicalCalculatorPage.egfr.interpretation.stage3b_desc'), stage: t('medicalCalculatorPage.egfr.interpretation.stage3b'), color: 'text-orange-600' };
  if (gfr >= 15) return { text: t('medicalCalculatorPage.egfr.interpretation.stage4_desc'), stage: t('medicalCalculatorPage.egfr.interpretation.stage4'), color: 'text-red-600' };
  return { text: t('medicalCalculatorPage.egfr.interpretation.stage5_desc'), stage: t('medicalCalculatorPage.egfr.interpretation.stage5'), color: 'text-red-800' };
};

// IBW Calculation (Devine)
const calculateIBW_Devine = (heightCm: number, sex: 'male' | 'female'): number | null => {
  if (heightCm <= 0) return null;
  const heightInches = heightCm / 2.54;
  const inchesOver5Feet = Math.max(0, heightInches - 60);
  if (sex === 'male') {
    return 50 + (2.3 * inchesOver5Feet);
  } else { // female
    return 45.5 + (2.3 * inchesOver5Feet);
  }
};

// IBW Interpretation
const interpretIBW = (ibw: number | null, t: TFunction): { text: string; color: string } => {
  if (ibw === null) return { text: '', color: 'text-gray-500' };
  return {
    text: t('medicalCalculatorPage.ibw.interpretation.devine'),
    color: 'text-gray-600'
  };
};

// AdjBW Calculation
const calculateAdjBW = (actualWeightKg: number, idealWeightKg: number): number | null => {
  if (actualWeightKg <= 0 || idealWeightKg <= 0) return null;
  if (actualWeightKg > idealWeightKg * 1.2) {
    return idealWeightKg + 0.4 * (actualWeightKg - idealWeightKg);
  }
  return null;
};

// AdjBW Interpretation
const interpretAdjBW = (adjbw: number | null, abw: number, ibw: number, t: TFunction): { text: string; color: string } => {
  if (adjbw === null) {
    if (abw > 0 && ibw > 0 && abw <= ibw * 1.2) {
      return { text: t('medicalCalculatorPage.adjbw.interpretation.notTypicallyCalculated'), color: 'text-gray-500' };
    }
    return { text: '', color: 'text-gray-500' };
  }
  return {
    text: t('medicalCalculatorPage.adjbw.interpretation.purpose'),
    color: 'text-gray-600'
  };
};

// BMR Calculation (Mifflin-St Jeor)
const calculateBMR_MifflinStJeor = (weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number | null => {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return null;
  const sexConstant = sex === 'male' ? 5 : -161;
  const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexConstant;
  return bmr;
};

// BMR Interpretation
const interpretBMR = (bmr: number | null, t: TFunction): { text: string; color: string } => {
  if (bmr === null) return { text: '', color: 'text-gray-500' };
  return {
    text: t('medicalCalculatorPage.bmr.interpretation.definition'),
    color: 'text-gray-600'
  };
};

// Corrected Calcium Calculation
const calculateCorrectedCalcium = (totalCalciumMgDl: number, albuminGdl: number): number | null => {
  if (totalCalciumMgDl <= 0 || albuminGdl <= 0) return null;
  return totalCalciumMgDl + 0.8 * (4.0 - albuminGdl);
};

// Corrected Calcium Interpretation
const interpretCorrectedCalcium = (correctedCa: number | null, totalCa: number, albumin: number, t: TFunction): { text: string; color: string } => {
  if (correctedCa === null) return { text: '', color: 'text-gray-500' };
  
  let interpretation = t('medicalCalculatorPage.correctedCalcium.interpretation.prefix', { albumin: albumin.toFixed(1) });
  let color = 'text-gray-600';

  if (correctedCa < 8.5) {
    interpretation += ` ${t('medicalCalculatorPage.correctedCalcium.interpretation.belowRange')}`;
    color = 'text-blue-600';
  } else if (correctedCa > 10.5) {
    interpretation += ` ${t('medicalCalculatorPage.correctedCalcium.interpretation.aboveRange')}`;
    color = 'text-red-600';
  } else {
    interpretation += ` ${t('medicalCalculatorPage.correctedCalcium.interpretation.withinRange')}`;
    color = 'text-green-600';
  }
  return { text: interpretation, color: color };
};

// --- Component ---
const MedicalCalculator = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const featureName: FeatureName = 'medical_calculator';
  const { checkAccess, incrementUsage, isLoadingToggles } = useFeatureAccess();
  const { toast } = useToast();

  // State for access check result
  const [initialAccessAllowed, setInitialAccessAllowed] = useState(false);
  const [initialAccessMessage, setInitialAccessMessage] = useState<string | null>(null);

  // BMI State
  const [bmiWeight, setBmiWeight] = useState<string>('');
  const [bmiHeight, setBmiHeight] = useState<string>('');
  const [bmiResult, setBmiResult] = useState<number | null>(null);
  const [bmiInterpretation, setBmiInterpretation] = useState<{ text: string; color: string }>({ text: '', color: '' });

  // BSA State
  const [bsaWeight, setBsaWeight] = useState<string>('');
  const [bsaHeight, setBsaHeight] = useState<string>('');
  const [bsaResult, setBsaResult] = useState<number | null>(null);
  const [bsaInterpretation, setBsaInterpretation] = useState<{ text: string; color: string }>({ text: '', color: '' });

  // eGFR State
  const [gfrCreatinine, setGfrCreatinine] = useState<string>('');
  const [gfrAge, setGfrAge] = useState<string>('');
  const [gfrSex, setGfrSex] = useState<'male' | 'female' | ''>('');
  const [gfrResult, setGfrResult] = useState<number | null>(null);
  const [gfrInterpretation, setGfrInterpretation] = useState<{ text: string; stage: string; color: string }>({ text: '', stage: '', color: '' });

  // IBW State
  const [ibwHeight, setIbwHeight] = useState<string>('');
  const [ibwSex, setIbwSex] = useState<'male' | 'female' | ''>('');
  const [ibwResult, setIbwResult] = useState<number | null>(null);
  const [ibwInterpretation, setIbwInterpretation] = useState<{ text: string; color: string }>({ text: '', color: '' });

  // AdjBW State
  const [adjBwActualWeight, setAdjBwActualWeight] = useState<string>('');
  const [adjBwResult, setAdjBwResult] = useState<number | null>(null);
  const [adjBwInterpretation, setAdjBwInterpretation] = useState<{ text: string; color: string }>({ text: '', color: '' });

  // BMR State
  const [bmrWeight, setBmrWeight] = useState<string>('');
  const [bmrHeight, setBmrHeight] = useState<string>('');
  const [bmrAge, setBmrAge] = useState<string>('');
  const [bmrSex, setBmrSex] = useState<'male' | 'female' | ''>('');
  const [bmrResult, setBmrResult] = useState<number | null>(null);
  const [bmrInterpretation, setBmrInterpretation] = useState<{ text: string; color: string }>({ text: '', color: '' });

  // Corrected Calcium State
  const [ccTotalCalcium, setCcTotalCalcium] = useState<string>('');
  const [ccAlbumin, setCcAlbumin] = useState<string>('');
  const [ccResult, setCcResult] = useState<number | null>(null);
  const [ccInterpretation, setCcInterpretation] = useState<{ text: string; color: string }>({ text: '', color: '' });

  // Error State
  const [error, setError] = useState<string>('');

  // Initial access check on mount
  useEffect(() => {
    // Only run verifyAccess if the hook is done loading toggles
    if (!isLoadingToggles) {
      const verifyInitialAccess = async () => {
        setInitialAccessMessage(null); // Clear message before check
        try {
          const result = await checkAccess(featureName);
          setInitialAccessAllowed(result.allowed);
          if (!result.allowed) {
            setInitialAccessMessage(result.message || 'Akses ditolak.');
          }
        } catch (error) {
          console.error("Error checking initial feature access:", error);
          setInitialAccessAllowed(false);
          setInitialAccessMessage('Gagal memeriksa akses fitur.');
          toast({
            title: "Error",
            description: "Tidak dapat memverifikasi akses fitur saat ini.",
            variant: "destructive",
          });
        }
      };
      verifyInitialAccess();
    }
  }, [isLoadingToggles]); // Simplify dependency array

  // --- Calculation Handlers (with Access Check) ---
  const handleBmiCalculate = async () => {
    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" }); return;
    }
    setError('');
    const weightNum = parseFloat(bmiWeight);
    const heightNum = parseFloat(bmiHeight);
    if (isNaN(weightNum) || isNaN(heightNum) || weightNum <= 0 || heightNum <= 0) {
      setError(t('medicalCalculatorPage.error.bmiInputs'));
      setBmiResult(null); setBmiInterpretation({ text: '', color: '' }); return;
    }
    const heightM = heightNum / 100;
    const result = calculateBMI(weightNum, heightM);
    setBmiResult(result); setBmiInterpretation(interpretBMI(result, t));
    await incrementUsage(featureName);
  };

  const handleBsaCalculate = async () => {
    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" }); return;
    }
    setError('');
    const weightNum = parseFloat(bsaWeight);
    const heightNum = parseFloat(bsaHeight);
    if (isNaN(weightNum) || isNaN(heightNum) || weightNum <= 0 || heightNum <= 0) {
      setError(t('medicalCalculatorPage.error.bsaInputs'));
      setBsaResult(null); setBsaInterpretation({ text: '', color: '' }); return;
    }
    const result = calculateBSA(weightNum, heightNum);
    setBsaResult(result); setBsaInterpretation(interpretBSA(result, t));
    await incrementUsage(featureName);
  };

  const handleGfrCalculate = async () => {
    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" }); return;
    }
    setError('');
    const creatinineNum = parseFloat(gfrCreatinine);
    const ageNum = parseInt(gfrAge, 10);
    if (isNaN(creatinineNum) || isNaN(ageNum) || creatinineNum <= 0 || ageNum <= 0 || !gfrSex) {
      setError(t('medicalCalculatorPage.error.egfrInputs'));
      setGfrResult(null); setGfrInterpretation({ text: '', stage: '', color: '' }); return;
    }
    const result = calculateGFR_CKDEPI(creatinineNum, ageNum, gfrSex);
    setGfrResult(result); setGfrInterpretation(interpretGFR(result, t));
    await incrementUsage(featureName);
  };

  const handleIbwCalculate = async () => {
    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" }); return;
    }
    setError('');
    const heightNum = parseFloat(ibwHeight);
    if (isNaN(heightNum) || heightNum <= 0 || !ibwSex) {
      setError(t('medicalCalculatorPage.error.ibwInputs'));
      setIbwResult(null); setIbwInterpretation({ text: '', color: '' }); return;
    }
    const result = calculateIBW_Devine(heightNum, ibwSex);
    setIbwResult(result); setIbwInterpretation(interpretIBW(result, t));
    await incrementUsage(featureName);
  };

  const handleAdjBwCalculate = async () => {
    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" }); return;
    }
    setError('');
    const actualWeightNum = parseFloat(adjBwActualWeight);
    const ibwNum = ibwResult;
    if (isNaN(actualWeightNum) || actualWeightNum <= 0) {
       setError(t('medicalCalculatorPage.error.adjbwActualWeightInput'));
       setAdjBwResult(null); setAdjBwInterpretation({ text: '', color: '' }); return;
    }
    if (ibwNum === null || ibwNum <= 0) {
       setError(t('medicalCalculatorPage.error.adjbwIbwRequired'));
       setAdjBwResult(null); setAdjBwInterpretation({ text: '', color: '' }); return;
    }
    const result = calculateAdjBW(actualWeightNum, ibwNum);
    setAdjBwResult(result); setAdjBwInterpretation(interpretAdjBW(result, actualWeightNum, ibwNum, t));
    if (result !== null) {
        await incrementUsage(featureName);
    }
  };

  const handleBmrCalculate = async () => {
     const accessResult = await checkAccess(featureName);
     if (!accessResult.allowed) {
       toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" }); return;
     }
     setError('');
     const weightNum = parseFloat(bmrWeight);
     const heightNum = parseFloat(bmrHeight);
     const ageNum = parseInt(bmrAge, 10);
     if (isNaN(weightNum) || isNaN(heightNum) || isNaN(ageNum) || weightNum <= 0 || heightNum <= 0 || ageNum <= 0 || !bmrSex) {
       setError(t('medicalCalculatorPage.error.bmrInputs'));
       setBmrResult(null); setBmrInterpretation({ text: '', color: '' }); return;
     }
     const result = calculateBMR_MifflinStJeor(weightNum, heightNum, ageNum, bmrSex);
     setBmrResult(result); setBmrInterpretation(interpretBMR(result, t));
     await incrementUsage(featureName);
  };

  const handleCorrectedCalciumCalculate = async () => {
     const accessResult = await checkAccess(featureName);
     if (!accessResult.allowed) {
       toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" }); return;
     }
     setError('');
     const totalCaNum = parseFloat(ccTotalCalcium);
     const albuminNum = parseFloat(ccAlbumin);
     if (isNaN(totalCaNum) || isNaN(albuminNum) || totalCaNum <= 0 || albuminNum <= 0) {
       setError(t('medicalCalculatorPage.error.correctedCaInputs'));
       setCcResult(null); setCcInterpretation({ text: '', color: '' }); return;
     }
     const result = calculateCorrectedCalcium(totalCaNum, albuminNum);
     setCcResult(result); setCcInterpretation(interpretCorrectedCalcium(result, totalCaNum, albuminNum, t));
     await incrementUsage(featureName);
  };

  return (
    <div>
      <PageHeader
        title={t('medicalCalculatorPage.pageTitle')}
        subtitle={t('medicalCalculatorPage.pageSubtitle')}
      />

      <div className="container-custom">

        {/* Show Skeleton only based on the hook's loading state */}
        {isLoadingToggles && (
           <div className="flex flex-col space-y-3 mt-8">
             <Skeleton className="h-[50px] w-full rounded-lg" />
             <Skeleton className="h-[250px] w-full rounded-lg" />
             <Skeleton className="h-[250px] w-full rounded-lg" />
           </div>
         )}

        {/* Access Denied Message (Show only if hook is NOT loading and access is denied) */}
        {!isLoadingToggles && !initialAccessAllowed && (
           <Alert variant="destructive" className="mt-8">
             <Terminal className="h-4 w-4" />
             <AlertTitle>{t('medicalCalculatorPage.accessDenied.title')}</AlertTitle>
             <AlertDescription>
               {initialAccessMessage || t('medicalCalculatorPage.accessDenied.defaultMessage')}
             </AlertDescription>
           </Alert>
         )}

        {/* Render content only if NOT loading and access IS allowed */}
        {!isLoadingToggles && initialAccessAllowed && (
         <>
            {/* Disclaimer */}
        <Alert variant="destructive" className="mb-8 bg-red-50 border-red-500 text-red-800">
          <AlertTriangle className="h-4 w-4 !text-red-800" />
          <AlertTitle className="font-bold">{t('medicalCalculatorPage.disclaimer.title')}</AlertTitle>
          <AlertDescription>
            {t('medicalCalculatorPage.disclaimer.text')}
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('medicalCalculatorPage.error.title')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Changed grid layout for more calculators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* BMI Calculator */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{t('medicalCalculatorPage.bmi.cardTitle')}</CardTitle>
              <CardDescription>{t('medicalCalculatorPage.bmi.cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div>
                <Label htmlFor="bmi-weight">{t('medicalCalculatorPage.bmi.labelWeight')}</Label>
                <Input id="bmi-weight" type="number" value={bmiWeight} onChange={(e) => setBmiWeight(e.target.value)} placeholder={t('medicalCalculatorPage.bmi.placeholderWeight')} />
              </div>
              <div>
                <Label htmlFor="bmi-height">{t('medicalCalculatorPage.bmi.labelHeight')}</Label>
                <Input id="bmi-height" type="number" value={bmiHeight} onChange={(e) => setBmiHeight(e.target.value)} placeholder={t('medicalCalculatorPage.bmi.placeholderHeight')} />
              </div>
              <Button onClick={handleBmiCalculate} className="w-full">{t('medicalCalculatorPage.bmi.buttonCalculate')}</Button>
              {bmiResult !== null && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{t('medicalCalculatorPage.common.resultLabel')}</p>
                  <p className="text-2xl font-bold text-medical-blue">{bmiResult.toFixed(1)} {t('medicalCalculatorPage.bmi.unit')}</p>
                  <p className={`mt-1 font-semibold text-justify ${bmiInterpretation.color}`}>{bmiInterpretation.text}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* BSA Calculator */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{t('medicalCalculatorPage.bsa.cardTitle')}</CardTitle>
              <CardDescription>{t('medicalCalculatorPage.bsa.cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div>
                <Label htmlFor="bsa-weight">{t('medicalCalculatorPage.bsa.labelWeight')}</Label>
                <Input id="bsa-weight" type="number" value={bsaWeight} onChange={(e) => setBsaWeight(e.target.value)} placeholder={t('medicalCalculatorPage.bsa.placeholderWeight')} />
              </div>
              <div>
                <Label htmlFor="bsa-height">{t('medicalCalculatorPage.bsa.labelHeight')}</Label>
                <Input id="bsa-height" type="number" value={bsaHeight} onChange={(e) => setBsaHeight(e.target.value)} placeholder={t('medicalCalculatorPage.bsa.placeholderHeight')} />
              </div>
              <Button onClick={handleBsaCalculate} className="w-full">{t('medicalCalculatorPage.bsa.buttonCalculate')}</Button>
              {bsaResult !== null && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{t('medicalCalculatorPage.common.resultLabel')}</p>
                  <p className="text-2xl font-bold text-medical-blue">{bsaResult.toFixed(2)} {t('medicalCalculatorPage.bsa.unit')}</p>
                  <p className={`mt-1 text-sm text-justify ${bsaInterpretation.color}`}>{bsaInterpretation.text}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* eGFR Calculator */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{t('medicalCalculatorPage.egfr.cardTitle')}</CardTitle>
              <CardDescription>{t('medicalCalculatorPage.egfr.cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div>
                <Label htmlFor="gfr-creatinine">{t('medicalCalculatorPage.egfr.labelCreatinine')}</Label>
                <Input id="gfr-creatinine" type="number" value={gfrCreatinine} onChange={(e) => setGfrCreatinine(e.target.value)} placeholder={t('medicalCalculatorPage.egfr.placeholderCreatinine')} />
              </div>
              <div>
                <Label htmlFor="gfr-age">{t('medicalCalculatorPage.egfr.labelAge')}</Label>
                <Input id="gfr-age" type="number" value={gfrAge} onChange={(e) => setGfrAge(e.target.value)} placeholder={t('medicalCalculatorPage.egfr.placeholderAge')} />
              </div>
              <div>
                 <Label>{t('medicalCalculatorPage.common.labelSex')}</Label>
                 <Select onValueChange={(value: 'male' | 'female') => setGfrSex(value)} value={gfrSex}>
                   <SelectTrigger> <SelectValue placeholder={t('medicalCalculatorPage.common.placeholderSelectSex')} /> </SelectTrigger>
                   <SelectContent> <SelectItem value="male">{t('medicalCalculatorPage.common.sexMale')}</SelectItem> <SelectItem value="female">{t('medicalCalculatorPage.common.sexFemale')}</SelectItem> </SelectContent>
                 </Select>
              </div>
              <Button onClick={handleGfrCalculate} className="w-full">{t('medicalCalculatorPage.egfr.buttonCalculate')}</Button>
              {gfrResult !== null && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{t('medicalCalculatorPage.common.resultLabel')}</p>
                  <p className="text-2xl font-bold text-medical-blue">{gfrResult.toFixed(0)} {t('medicalCalculatorPage.egfr.unit')}</p>
                  <p className={`mt-1 font-semibold text-justify ${gfrInterpretation.color}`}>{gfrInterpretation.stage}</p>
                  <p className={`mt-1 text-sm text-justify ${gfrInterpretation.color}`}>{gfrInterpretation.text}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* IBW Calculator */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{t('medicalCalculatorPage.ibw.cardTitle')}</CardTitle>
              <CardDescription>{t('medicalCalculatorPage.ibw.cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div>
                <Label htmlFor="ibw-height">{t('medicalCalculatorPage.ibw.labelHeight')}</Label>
                <Input id="ibw-height" type="number" value={ibwHeight} onChange={(e) => setIbwHeight(e.target.value)} placeholder={t('medicalCalculatorPage.ibw.placeholderHeight')} />
              </div>
              <div>
                 <Label>{t('medicalCalculatorPage.common.labelSex')}</Label>
                 <Select onValueChange={(value: 'male' | 'female') => setIbwSex(value)} value={ibwSex}>
                   <SelectTrigger> <SelectValue placeholder={t('medicalCalculatorPage.common.placeholderSelectSex')} /> </SelectTrigger>
                   <SelectContent> <SelectItem value="male">{t('medicalCalculatorPage.common.sexMale')}</SelectItem> <SelectItem value="female">{t('medicalCalculatorPage.common.sexFemale')}</SelectItem> </SelectContent>
                 </Select>
              </div>
              <Button onClick={handleIbwCalculate} className="w-full">{t('medicalCalculatorPage.ibw.buttonCalculate')}</Button>
              {ibwResult !== null && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{t('medicalCalculatorPage.common.resultLabel')}</p>
                  <p className="text-2xl font-bold text-medical-blue">{ibwResult.toFixed(1)} {t('medicalCalculatorPage.ibw.unit')}</p>
                  <p className={`mt-1 text-sm text-justify ${ibwInterpretation.color}`}>{ibwInterpretation.text}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AdjBW Calculator */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{t('medicalCalculatorPage.adjbw.cardTitle')}</CardTitle>
              <CardDescription>{t('medicalCalculatorPage.adjbw.cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div>
                <Label htmlFor="adjbw-actual-weight">{t('medicalCalculatorPage.adjbw.labelActualWeight')}</Label>
                <Input id="adjbw-actual-weight" type="number" value={adjBwActualWeight} onChange={(e) => setAdjBwActualWeight(e.target.value)} placeholder={t('medicalCalculatorPage.adjbw.placeholderActualWeight')} />
              </div>
               <div>
                 <Label>{t('medicalCalculatorPage.adjbw.labelIdealWeight')}</Label>
                 <Input type="number" value={ibwResult !== null ? ibwResult.toFixed(1) : ''} readOnly disabled placeholder={t('medicalCalculatorPage.adjbw.placeholderIdealWeight')} />
               </div>
              <Button onClick={handleAdjBwCalculate} className="w-full" disabled={ibwResult === null}>{t('medicalCalculatorPage.adjbw.buttonCalculate')}</Button>
              {adjBwResult !== null && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{t('medicalCalculatorPage.common.resultLabel')}</p>
                  <p className="text-2xl font-bold text-medical-blue">{adjBwResult.toFixed(1)} {t('medicalCalculatorPage.adjbw.unit')}</p>
                  <p className={`mt-1 text-sm text-justify ${adjBwInterpretation.color}`}>{adjBwInterpretation.text}</p>
                </div>
              )}
               {/* Show interpretation even if AdjBW is null but calculation was attempted */}
               {adjBwResult === null && adjBwInterpretation.text && ibwResult !== null && (
                 <div className="mt-4 p-4 bg-gray-50 rounded">
                   <p className={`mt-1 text-sm text-justify ${adjBwInterpretation.color}`}>{adjBwInterpretation.text}</p>
                 </div>
               )}
            </CardContent>
          </Card>

          {/* BMR Calculator */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{t('medicalCalculatorPage.bmr.cardTitle')}</CardTitle>
              <CardDescription>{t('medicalCalculatorPage.bmr.cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div>
                <Label htmlFor="bmr-weight">{t('medicalCalculatorPage.bmr.labelWeight')}</Label>
                <Input id="bmr-weight" type="number" value={bmrWeight} onChange={(e) => setBmrWeight(e.target.value)} placeholder={t('medicalCalculatorPage.bmr.placeholderWeight')} />
              </div>
              <div>
                <Label htmlFor="bmr-height">{t('medicalCalculatorPage.bmr.labelHeight')}</Label>
                <Input id="bmr-height" type="number" value={bmrHeight} onChange={(e) => setBmrHeight(e.target.value)} placeholder={t('medicalCalculatorPage.bmr.placeholderHeight')} />
              </div>
              <div>
                <Label htmlFor="bmr-age">{t('medicalCalculatorPage.bmr.labelAge')}</Label>
                <Input id="bmr-age" type="number" value={bmrAge} onChange={(e) => setBmrAge(e.target.value)} placeholder={t('medicalCalculatorPage.bmr.placeholderAge')} />
              </div>
              <div>
                 <Label>{t('medicalCalculatorPage.common.labelSex')}</Label>
                 <Select onValueChange={(value: 'male' | 'female') => setBmrSex(value)} value={bmrSex}>
                   <SelectTrigger> <SelectValue placeholder={t('medicalCalculatorPage.common.placeholderSelectSex')} /> </SelectTrigger>
                   <SelectContent> <SelectItem value="male">{t('medicalCalculatorPage.common.sexMale')}</SelectItem> <SelectItem value="female">{t('medicalCalculatorPage.common.sexFemale')}</SelectItem> </SelectContent>
                 </Select>
              </div>
              <Button onClick={handleBmrCalculate} className="w-full">{t('medicalCalculatorPage.bmr.buttonCalculate')}</Button>
              {bmrResult !== null && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{t('medicalCalculatorPage.common.resultLabel')}</p>
                  <p className="text-2xl font-bold text-medical-blue">{bmrResult.toFixed(0)} {t('medicalCalculatorPage.bmr.unit')}</p>
                  <p className={`mt-1 text-sm text-justify ${bmrInterpretation.color}`}>{bmrInterpretation.text}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Corrected Calcium Calculator */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>{t('medicalCalculatorPage.correctedCalcium.cardTitle')}</CardTitle>
              <CardDescription>{t('medicalCalculatorPage.correctedCalcium.cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div>
                <Label htmlFor="cc-calcium">{t('medicalCalculatorPage.correctedCalcium.labelTotalCalcium')}</Label>
                <Input id="cc-calcium" type="number" value={ccTotalCalcium} onChange={(e) => setCcTotalCalcium(e.target.value)} placeholder={t('medicalCalculatorPage.correctedCalcium.placeholderTotalCalcium')} />
              </div>
              <div>
                <Label htmlFor="cc-albumin">{t('medicalCalculatorPage.correctedCalcium.labelAlbumin')}</Label>
                <Input id="cc-albumin" type="number" value={ccAlbumin} onChange={(e) => setCcAlbumin(e.target.value)} placeholder={t('medicalCalculatorPage.correctedCalcium.placeholderAlbumin')} />
              </div>
              <Button onClick={handleCorrectedCalciumCalculate} className="w-full">{t('medicalCalculatorPage.correctedCalcium.buttonCalculate')}</Button>
              {ccResult !== null && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">{t('medicalCalculatorPage.common.resultLabel')}</p>
                  <p className="text-2xl font-bold text-medical-blue">{ccResult.toFixed(1)} {t('medicalCalculatorPage.correctedCalcium.unit')}</p>
                  <p className={`mt-1 text-sm text-justify ${ccInterpretation.color}`}>{ccInterpretation.text}</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Back Button */}
        <div className="mt-12 flex justify-center"> 
          <Link to="/tools">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft size={16} />
              {t('medicalCalculatorPage.common.backToToolsButton')}
            </Button>
          </Link>
        </div>
       </>
      )} {/* End of initialAccessAllowed block */}
      </div>
    </div>
  );
};

export default MedicalCalculator;
