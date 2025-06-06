import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GcsState {
  eyeOpening: number; // 1-4
  verbalResponse: number; // 1-5
  motorResponse: number; // 1-6
}

const GcsScore: React.FC = () => {
  const { t } = useTranslation();
  const [criteria, setCriteria] = useState<GcsState>({
    eyeOpening: 0, // Use 0 to indicate not selected
    verbalResponse: 0,
    motorResponse: 0,
  });

  const handleRadioChange = (category: keyof GcsState, value: string) => {
    setCriteria((prev) => ({ ...prev, [category]: parseInt(value, 10) }));
  };

  const score = useMemo(() => {
    // GCS score is valid only if all components are selected
    if (criteria.eyeOpening > 0 && criteria.verbalResponse > 0 && criteria.motorResponse > 0) {
      return criteria.eyeOpening + criteria.verbalResponse + criteria.motorResponse;
    }
    return null; // Return null if not all parts are scored
  }, [criteria]);

  const interpretation = useMemo(() => {
    if (score === null) return t('gcsScore.interpretation.selectOptionsPrompt');

    let severityKey = '';
    if (score >= 13) severityKey = 'gcsScore.interpretation.mildBrainInjury';
    else if (score >= 9) severityKey = 'gcsScore.interpretation.moderateBrainInjury';
    else severityKey = 'gcsScore.interpretation.severeBrainInjury'; // Score 3-8

    return t('gcsScore.interpretation.resultFormat', {
      score,
      severity: t(severityKey),
      eyeScore: criteria.eyeOpening,
      verbalScore: criteria.verbalResponse,
      motorScore: criteria.motorResponse,
    });
  }, [score, criteria, t]);

  const resetCalculator = () => {
    setCriteria({
      eyeOpening: 0,
      verbalResponse: 0,
      motorResponse: 0,
    });
  };

  const eyeOptions = [
    { value: 4, labelKey: 'gcsScore.eyeOptions.4' },
    { value: 3, labelKey: 'gcsScore.eyeOptions.3' },
    { value: 2, labelKey: 'gcsScore.eyeOptions.2' },
    { value: 1, labelKey: 'gcsScore.eyeOptions.1' },
  ];

  const verbalOptions = [
    { value: 5, labelKey: 'gcsScore.verbalOptions.5' },
    { value: 4, labelKey: 'gcsScore.verbalOptions.4' },
    { value: 3, labelKey: 'gcsScore.verbalOptions.3' },
    { value: 2, labelKey: 'gcsScore.verbalOptions.2' },
    { value: 1, labelKey: 'gcsScore.verbalOptions.1' },
  ];

  const motorOptions = [
    { value: 6, labelKey: 'gcsScore.motorOptions.6' },
    { value: 5, labelKey: 'gcsScore.motorOptions.5' },
    { value: 4, labelKey: 'gcsScore.motorOptions.4' },
    { value: 3, labelKey: 'gcsScore.motorOptions.3' },
    { value: 2, labelKey: 'gcsScore.motorOptions.2' },
    { value: 1, labelKey: 'gcsScore.motorOptions.1' },
  ];

  return (
    <Card className="w-full max-w-lg mx-auto mt-6">
      <CardHeader>
        <CardTitle>{t('gcsScore.title')}</CardTitle>
        <CardDescription className="text-justify">{t('gcsScore.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Eye Opening Response */}
        <div>
          <Label className="font-semibold mb-2 block">{t('gcsScore.eyeOpeningResponseTitle')}</Label>
          <RadioGroup
            value={criteria.eyeOpening.toString()}
            onValueChange={(value) => handleRadioChange('eyeOpening', value)}
            className="space-y-1"
          >
            {eyeOptions.map((opt) => (
              <div key={`eye-${opt.value}`} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value.toString()} id={`eye-${opt.value}`} />
                <Label htmlFor={`eye-${opt.value}`}>{t(opt.labelKey)} ({opt.value} {t('gcsScore.pointsSuffix')})</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Verbal Response */}
        <div>
          <Label className="font-semibold mb-2 block">{t('gcsScore.verbalResponseTitle')}</Label>
          <RadioGroup
            value={criteria.verbalResponse.toString()}
            onValueChange={(value) => handleRadioChange('verbalResponse', value)}
            className="space-y-1"
          >
            {verbalOptions.map((opt) => (
              <div key={`verbal-${opt.value}`} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value.toString()} id={`verbal-${opt.value}`} />
                <Label htmlFor={`verbal-${opt.value}`}>{t(opt.labelKey)} ({opt.value} {t('gcsScore.pointsSuffix')})</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Motor Response */}
        <div>
          <Label className="font-semibold mb-2 block">{t('gcsScore.motorResponseTitle')}</Label>
          <RadioGroup
            value={criteria.motorResponse.toString()}
            onValueChange={(value) => handleRadioChange('motorResponse', value)}
            className="space-y-1"
          >
            {motorOptions.map((opt) => (
              <div key={`motor-${opt.value}`} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value.toString()} id={`motor-${opt.value}`} />
                <Label htmlFor={`motor-${opt.value}`}>{t(opt.labelKey)} ({opt.value} {t('gcsScore.pointsSuffix')})</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('gcsScore.calculatedScoreTitle', { score: score ?? t('gcsScore.notApplicable') })}</AlertTitle>
          <AlertDescription className="text-justify">
            {interpretation}
          </AlertDescription>
        </Alert>
         <Alert variant="destructive">
           <Info className="h-4 w-4" />
           <AlertTitle>{t('gcsScore.disclaimerTitle')}</AlertTitle>
           <AlertDescription className="text-justify">
             {t('gcsScore.disclaimerText')}
           </AlertDescription>
         </Alert>
      </CardContent>
      <CardFooter>
        <Button onClick={resetCalculator} variant="outline" className="w-full">
          {t('gcsScore.resetButton')}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GcsScore;
