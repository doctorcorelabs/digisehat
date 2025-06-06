import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WellsDvtState {
  activeCancer: boolean;
  paralysisParesisImmobilization: boolean;
  bedriddenRecently: boolean;
  localizedTenderness: boolean;
  entireLegSwollen: boolean;
  calfSwellingDifference: boolean;
  pittingEdema: boolean;
  collateralSuperficialVeins: boolean;
  previousDvt: boolean;
  alternativeDiagnosisLikely: boolean; // This subtracts points
}

const WellsScoreDvt: React.FC = () => {
  const { t } = useTranslation();
  const [criteria, setCriteria] = useState<WellsDvtState>({
    activeCancer: false,
    paralysisParesisImmobilization: false,
    bedriddenRecently: false,
    localizedTenderness: false,
    entireLegSwollen: false,
    calfSwellingDifference: false,
    pittingEdema: false,
    collateralSuperficialVeins: false,
    previousDvt: false,
    alternativeDiagnosisLikely: false,
  });

  const handleCheckboxChange = (id: keyof WellsDvtState) => {
    setCriteria((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const score = useMemo(() => {
    let calculatedScore = 0;
    if (criteria.activeCancer) calculatedScore += 1;
    if (criteria.paralysisParesisImmobilization) calculatedScore += 1;
    if (criteria.bedriddenRecently) calculatedScore += 1;
    if (criteria.localizedTenderness) calculatedScore += 1;
    if (criteria.entireLegSwollen) calculatedScore += 1;
    if (criteria.calfSwellingDifference) calculatedScore += 1;
    if (criteria.pittingEdema) calculatedScore += 1;
    if (criteria.collateralSuperficialVeins) calculatedScore += 1;
    if (criteria.previousDvt) calculatedScore += 1;
    if (criteria.alternativeDiagnosisLikely) calculatedScore -= 2; // Subtract 2 points

    return calculatedScore;
  }, [criteria]);

  const interpretation = useMemo(() => {
    // Interpretation based on original Wells criteria stratification
    if (score >= 3) return t('wellsScoreDvt.interpretation.high_probability', { score });
    if (score >= 1 && score <= 2) return t('wellsScoreDvt.interpretation.moderate_probability', { score });
    if (score <= 0) return t('wellsScoreDvt.interpretation.low_probability', { score });
    return t('wellsScoreDvt.interpretation.pending'); // Fallback
  }, [score, t]);

  const resetCalculator = () => {
    setCriteria({
      activeCancer: false,
      paralysisParesisImmobilization: false,
      bedriddenRecently: false,
      localizedTenderness: false,
      entireLegSwollen: false,
      calfSwellingDifference: false,
      pittingEdema: false,
      collateralSuperficialVeins: false,
      previousDvt: false,
      alternativeDiagnosisLikely: false,
    });
  };

  return (
    <Card className="w-full max-w-lg mx-auto mt-6"> {/* Added margin top */}
      <CardHeader>
        <CardTitle>{t('wellsScoreDvt.title')}</CardTitle>
        <CardDescription className="text-justify">{t('wellsScoreDvt.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {(Object.keys(criteria) as Array<keyof WellsDvtState>).map((key) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={criteria[key]}
                onCheckedChange={() => handleCheckboxChange(key)}
              />
              <Label htmlFor={key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-justify">
                {t(`wellsScoreDvt.criteria.${key}`)}
              </Label>
            </div>
          ))}
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('wellsScoreDvt.calculatedScoreTitle', { score })}</AlertTitle>
          <AlertDescription className="text-justify">
            {interpretation}
          </AlertDescription>
        </Alert>
         <Alert variant="destructive">
           <Info className="h-4 w-4" />
           <AlertTitle>{t('wellsScoreDvt.disclaimerTitle')}</AlertTitle>
           <AlertDescription className="text-justify">
             {t('wellsScoreDvt.disclaimerText')}
           </AlertDescription>
         </Alert>
      </CardContent>
      <CardFooter>
        <Button onClick={resetCalculator} variant="outline" className="w-full">
          {t('wellsScoreDvt.resetButton')}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default WellsScoreDvt;
