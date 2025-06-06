import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Need Input for age
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Curb65State {
  confusion: boolean;
  ureaGreaterThan7: boolean; // BUN > 19 mg/dL or Urea > 7 mmol/L
  respiratoryRateGreaterThan30: boolean;
  lowBloodPressure: boolean; // SBP < 90 mmHg or DBP <= 60 mmHg
  ageGreaterThan65: boolean;
}

const Curb65Score: React.FC = () => {
  const { t } = useTranslation();
  const [criteria, setCriteria] = useState<Curb65State>({
    confusion: false,
    ureaGreaterThan7: false,
    respiratoryRateGreaterThan30: false,
    lowBloodPressure: false,
    ageGreaterThan65: false,
  });
  const [age, setAge] = useState<string>(''); // Store age as string for input

  const handleCheckboxChange = (id: keyof Omit<Curb65State, 'ageGreaterThan65'>) => {
    setCriteria((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAgeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newAge = event.target.value;
    setAge(newAge);
    const ageNum = parseInt(newAge, 10);
    setCriteria((prev) => ({
      ...prev,
      ageGreaterThan65: !isNaN(ageNum) && ageNum >= 65,
    }));
  };

  const score = useMemo(() => {
    let calculatedScore = 0;
    if (criteria.confusion) calculatedScore += 1;
    if (criteria.ureaGreaterThan7) calculatedScore += 1;
    if (criteria.respiratoryRateGreaterThan30) calculatedScore += 1;
    if (criteria.lowBloodPressure) calculatedScore += 1;
    if (criteria.ageGreaterThan65) calculatedScore += 1;

    return calculatedScore;
  }, [criteria]);

  const interpretation = useMemo(() => {
    // Interpretation based on CURB-65 score for mortality risk and site of care decision
    switch (score) {
      case 0:
      case 1:
        return t('curb65Score.interpretation.low_risk', { score });
      case 2:
        return t('curb65Score.interpretation.moderate_risk', { score });
      case 3:
      case 4:
      case 5:
        return t('curb65Score.interpretation.high_risk', { score });
      default:
        return t('curb65Score.interpretation.pending');
    }
  }, [score, t]);

  const resetCalculator = () => {
    setCriteria({
      confusion: false,
      ureaGreaterThan7: false,
      respiratoryRateGreaterThan30: false,
      lowBloodPressure: false,
      ageGreaterThan65: false,
    });
    setAge('');
  };

  return (
    <Card className="w-full max-w-lg mx-auto mt-6">
      <CardHeader>
        <CardTitle>{t('curb65Score.title')}</CardTitle>
        <CardDescription className="text-justify">{t('curb65Score.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {/* Confusion */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="confusion"
              checked={criteria.confusion}
              onCheckedChange={() => handleCheckboxChange('confusion')}
            />
            <Label htmlFor="confusion" className="text-justify">{t('curb65Score.criteria.confusion')}</Label>
          </div>
          {/* Urea */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ureaGreaterThan7"
              checked={criteria.ureaGreaterThan7}
              onCheckedChange={() => handleCheckboxChange('ureaGreaterThan7')}
            />
            <Label htmlFor="ureaGreaterThan7" className="text-justify">{t('curb65Score.criteria.ureaGreaterThan7')}</Label>
          </div>
          {/* Respiratory Rate */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="respiratoryRateGreaterThan30"
              checked={criteria.respiratoryRateGreaterThan30}
              onCheckedChange={() => handleCheckboxChange('respiratoryRateGreaterThan30')}
            />
            <Label htmlFor="respiratoryRateGreaterThan30" className="text-justify">{t('curb65Score.criteria.respiratoryRateGreaterThan30')}</Label>
          </div>
          {/* Blood Pressure */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="lowBloodPressure"
              checked={criteria.lowBloodPressure}
              onCheckedChange={() => handleCheckboxChange('lowBloodPressure')}
            />
            <Label htmlFor="lowBloodPressure" className="text-justify">{t('curb65Score.criteria.lowBloodPressure')}</Label>
          </div>
          {/* Age */}
          <div className="flex items-center space-x-2">
             <Label htmlFor="age" className="w-20">{t('curb65Score.criteria.ageLabel')}</Label>
             <Input
               id="age"
               type="number"
               value={age}
               onChange={handleAgeChange}
               placeholder={t('curb65Score.criteria.agePlaceholder')}
               className="flex-1"
             />
             <Label className="ml-2">{t('curb65Score.criteria.ageCriteria')}</Label>
           </div>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('curb65Score.calculatedScoreTitle', { score })}</AlertTitle>
          <AlertDescription className="text-justify">
            {interpretation}
          </AlertDescription>
        </Alert>
         <Alert variant="destructive">
           <Info className="h-4 w-4" />
           <AlertTitle>{t('curb65Score.disclaimerTitle')}</AlertTitle>
           <AlertDescription className="text-justify">
             {t('curb65Score.disclaimerText')}
           </AlertDescription>
         </Alert>
      </CardContent>
      <CardFooter>
        <Button onClick={resetCalculator} variant="outline" className="w-full">
          {t('curb65Score.resetButton')}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default Curb65Score;
