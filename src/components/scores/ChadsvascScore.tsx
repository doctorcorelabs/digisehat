import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChadsvascState {
  congestiveHeartFailure: boolean;
  hypertension: boolean;
  age75OrOlder: boolean;
  diabetesMellitus: boolean;
  strokeTiaThromboembolism: boolean;
  vascularDisease: boolean;
  age65To74: boolean;
  sexCategoryFemale: boolean;
}

const ChadsvascScore: React.FC = () => {
  const { t } = useTranslation();
  const [criteria, setCriteria] = useState<ChadsvascState>({
    congestiveHeartFailure: false,
    hypertension: false,
    age75OrOlder: false,
    diabetesMellitus: false,
    strokeTiaThromboembolism: false,
    vascularDisease: false,
    age65To74: false,
    sexCategoryFemale: false,
  });

  const handleCheckboxChange = (id: keyof ChadsvascState) => {
    setCriteria((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const score = useMemo(() => {
    let calculatedScore = 0;
    if (criteria.congestiveHeartFailure) calculatedScore += 1;
    if (criteria.hypertension) calculatedScore += 1;
    if (criteria.age75OrOlder) calculatedScore += 2;
    if (criteria.diabetesMellitus) calculatedScore += 1;
    if (criteria.strokeTiaThromboembolism) calculatedScore += 2;
    if (criteria.vascularDisease) calculatedScore += 1;
    if (criteria.age65To74) calculatedScore += 1; // Note: Age 75+ takes precedence
    if (criteria.sexCategoryFemale) calculatedScore += 1;

    // Correction: If Age >= 75 is checked, Age 65-74 should not add points
    if (criteria.age75OrOlder && criteria.age65To74) {
        calculatedScore -= 1; // Remove the point added by age65To74
    }


    return calculatedScore;
  }, [criteria]);

  const interpretation = useMemo(() => {
    // Simplified interpretation based on common guidelines (e.g., ESC 2020 AF Guidelines)
    // This is illustrative and should be verified against current guidelines.
    if (criteria.sexCategoryFemale) {
      if (score === 1) return t('chadsvascScore.interpretation.female_score_1');
      if (score >= 2) return t('chadsvascScore.interpretation.female_score_gte_2', { score });
      return t('chadsvascScore.interpretation.female_score_0');
    } else {
      if (score === 0) return t('chadsvascScore.interpretation.male_score_0');
      if (score >= 1) return t('chadsvascScore.interpretation.male_score_gte_1', { score });
      return t('chadsvascScore.interpretation.male_fallback');
    }
  }, [score, criteria.sexCategoryFemale, t]);

  const resetCalculator = () => {
    setCriteria({
      congestiveHeartFailure: false,
      hypertension: false,
      age75OrOlder: false,
      diabetesMellitus: false,
      strokeTiaThromboembolism: false,
      vascularDisease: false,
      age65To74: false,
      sexCategoryFemale: false,
    });
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>{t('chadsvascScore.title')}</CardTitle>
        <CardDescription className="text-justify">{t('chadsvascScore.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {(Object.keys(criteria) as Array<keyof ChadsvascState>).map((key) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={criteria[key]}
                onCheckedChange={() => handleCheckboxChange(key)}
                disabled={key === 'age65To74' && criteria.age75OrOlder} // Disable 65-74 if 75+ is checked
              />
              <Label htmlFor={key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-justify">
                {t(`chadsvascScore.criteria.${key}`)}
              </Label>
            </div>
          ))}
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('chadsvascScore.calculatedScoreTitle', { score })}</AlertTitle>
          <AlertDescription className="text-justify">
            {interpretation}
          </AlertDescription>
        </Alert>
         <Alert variant="destructive">
           <Info className="h-4 w-4" />
           <AlertTitle>{t('chadsvascScore.disclaimerTitle')}</AlertTitle>
           <AlertDescription className="text-justify">
             {t('chadsvascScore.disclaimerText')}
           </AlertDescription>
         </Alert>
      </CardContent>
      <CardFooter>
        <Button onClick={resetCalculator} variant="outline" className="w-full">
          {t('chadsvascScore.resetButton')}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ChadsvascScore;
