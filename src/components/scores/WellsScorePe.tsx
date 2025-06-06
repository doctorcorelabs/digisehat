import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WellsPeState {
  clinicalSignsDvt: boolean;
  peMostLikelyDiagnosis: boolean;
  heartRateGreaterThan100: boolean;
  immobilizationOrSurgery: boolean;
  previousPeOrDvt: boolean;
  hemoptysis: boolean;
  malignancy: boolean;
}

const WellsScorePe: React.FC = () => {
  const { t } = useTranslation();
  const [criteria, setCriteria] = useState<WellsPeState>({
    clinicalSignsDvt: false,
    peMostLikelyDiagnosis: false,
    heartRateGreaterThan100: false,
    immobilizationOrSurgery: false,
    previousPeOrDvt: false,
    hemoptysis: false,
    malignancy: false,
  });

  const handleCheckboxChange = (id: keyof WellsPeState) => {
    setCriteria((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const score = useMemo(() => {
    let calculatedScore = 0;
    if (criteria.clinicalSignsDvt) calculatedScore += 3;
    if (criteria.peMostLikelyDiagnosis) calculatedScore += 3;
    if (criteria.heartRateGreaterThan100) calculatedScore += 1.5;
    if (criteria.immobilizationOrSurgery) calculatedScore += 1.5;
    if (criteria.previousPeOrDvt) calculatedScore += 1.5;
    if (criteria.hemoptysis) calculatedScore += 1;
    if (criteria.malignancy) calculatedScore += 1;

    return calculatedScore;
  }, [criteria]);

  const interpretation = useMemo(() => {
    // Interpretation based on original Wells criteria for PE
    // Can also use simplified 2-level stratification (PE Likely > 4, PE Unlikely <= 4)
    if (score > 6) return t('wellsScorePe.interpretation.traditional_high_probability', { score });
    if (score >= 2 && score <= 6) return t('wellsScorePe.interpretation.traditional_moderate_probability', { score });
    if (score < 2) return t('wellsScorePe.interpretation.traditional_low_probability', { score });
    return t('wellsScorePe.interpretation.traditional_pending'); // Fallback
  }, [score, t]);

   const simplifiedInterpretation = useMemo(() => {
    if (score > 4) return t('wellsScorePe.interpretation.simplified_pe_likely', { score });
    if (score <= 4) return t('wellsScorePe.interpretation.simplified_pe_unlikely', { score });
    return t('wellsScorePe.interpretation.simplified_pending');
  }, [score, t]);


  const resetCalculator = () => {
    setCriteria({
      clinicalSignsDvt: false,
      peMostLikelyDiagnosis: false,
      heartRateGreaterThan100: false,
      immobilizationOrSurgery: false,
      previousPeOrDvt: false,
      hemoptysis: false,
      malignancy: false,
    });
  };

  return (
    <Card className="w-full max-w-lg mx-auto mt-6"> {/* Added margin top */}
      <CardHeader>
        <CardTitle>{t('wellsScorePe.title')}</CardTitle>
        <CardDescription className="text-justify">{t('wellsScorePe.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {(Object.keys(criteria) as Array<keyof WellsPeState>).map((key) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={criteria[key]}
                onCheckedChange={() => handleCheckboxChange(key)}
              />
              <Label htmlFor={key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-justify">
                {t(`wellsScorePe.criteria.${key}`)}
              </Label>
            </div>
          ))}
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('wellsScorePe.calculatedScoreTitle', { score })}</AlertTitle>
          <AlertDescription className="text-justify">
            {t('wellsScorePe.interpretationLabels.traditional')}: {interpretation} <br />
            {t('wellsScorePe.interpretationLabels.simplified')}: {simplifiedInterpretation}
          </AlertDescription>
        </Alert>
         <Alert variant="destructive">
           <Info className="h-4 w-4" />
           <AlertTitle>{t('wellsScorePe.disclaimerTitle')}</AlertTitle>
           <AlertDescription className="text-justify">
             {t('wellsScorePe.disclaimerText')}
           </AlertDescription>
         </Alert>
      </CardContent>
      <CardFooter>
        <Button onClick={resetCalculator} variant="outline" className="w-full">
          {t('wellsScorePe.resetButton')}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default WellsScorePe;
