import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox'; // For dialysis status
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MeldState {
  bilirubin: string; // mg/dL
  creatinine: string; // mg/dL
  inr: string;
  sodium: string; // mEq/L (for MELD-Na)
  dialysisTwiceInWeek: boolean;
}

const MeldScore: React.FC = () => {
  const { t } = useTranslation();
  const [values, setValues] = useState<MeldState>({
    bilirubin: '',
    creatinine: '',
    inr: '',
    sodium: '', // Initialize sodium for MELD-Na
    dialysisTwiceInWeek: false,
  });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const handleCheckboxChange = (id: keyof MeldState) => {
    setValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const { meldScore, meldNaScore } = useMemo(() => {
    const bili = parseFloat(values.bilirubin);
    let creat = parseFloat(values.creatinine);
    const inr = parseFloat(values.inr);
    const sodium = parseFloat(values.sodium); // For MELD-Na
    const dialysis = values.dialysisTwiceInWeek;

    if (isNaN(bili) || isNaN(creat) || isNaN(inr)) {
      return { meldScore: null, meldNaScore: null }; // Need all core values
    }

    // Apply MELD calculation rules
    const biliCalc = Math.max(bili, 1.0);
    let creatCalc = Math.max(creat, 1.0);
    const inrCalc = Math.max(inr, 1.0);

    // If patient had dialysis twice within the last 7 days, creatinine is set to 4.0
    // Also, if creatinine is already > 4.0, it's capped at 4.0
    if (dialysis || creat > 4.0) {
      creatCalc = 4.0;
    }

    // MELD Score Calculation (Original 3-variable)
    let score =
      0.957 * Math.log(creatCalc) +
      0.378 * Math.log(biliCalc) +
      1.120 * Math.log(inrCalc) +
      0.643; // Constant factor

    score = Math.round(score * 10); // Multiply by 10 and round

    // MELD-Na Score Calculation
    let scoreNa: number | null = null;
    if (!isNaN(sodium)) {
        scoreNa = score; // Start with MELD score
        if (score > 11) { // MELD-Na adjustments only apply if MELD > 11
            // Apply Sodium adjustments based on UNOS policy (Jan 2016)
            let sodiumCalc = Math.max(sodium, 125); // Lower bound
            sodiumCalc = Math.min(sodiumCalc, 137); // Upper bound

            scoreNa = score + 1.32 * (137 - sodiumCalc) - (0.033 * score * (137 - sodiumCalc));
        }
         scoreNa = Math.round(scoreNa); // Round final MELD-Na
    }


    // Final score cannot be less than 6 (if calculated < 6, reported as 6)
    // MELD score is capped at 40
    const finalMeldScore = Math.min(Math.max(score, 6), 40);
    const finalMeldNaScore = scoreNa !== null ? Math.min(Math.max(scoreNa, finalMeldScore), 40) : null; // MELD-Na also capped at 40, cannot be lower than MELD

    return { meldScore: finalMeldScore, meldNaScore: finalMeldNaScore };

  }, [values]);

  const interpretation = useMemo(() => {
    if (meldScore === null) return t('meldScore.interpretation.prompt');

    // General interpretation of 3-month mortality risk (approximate)
    let riskKey = '';
    if (meldScore >= 40) riskKey = 'meldScore.interpretation.risk_40_plus';
    else if (meldScore >= 30) riskKey = 'meldScore.interpretation.risk_30_39';
    else if (meldScore >= 20) riskKey = 'meldScore.interpretation.risk_20_29';
    else if (meldScore >= 10) riskKey = 'meldScore.interpretation.risk_10_19';
    else riskKey = 'meldScore.interpretation.risk_0_9'; // Score 6-9

    let naInterpretation = '';
    if (meldNaScore !== null) {
        naInterpretation = t('meldScore.interpretation.meld_na_addon', { meldNaScore });
    }

    return t('meldScore.interpretation.result_format', {
        meldScore,
        risk: t(riskKey),
        naInterpretation
    });
  }, [meldScore, meldNaScore, t]);

  const resetCalculator = () => {
    setValues({
      bilirubin: '',
      creatinine: '',
      inr: '',
      sodium: '',
      dialysisTwiceInWeek: false,
    });
  };

  return (
    <Card className="w-full max-w-lg mx-auto mt-6">
      <CardHeader>
        <CardTitle>{t('meldScore.title')}</CardTitle>
        <CardDescription className="text-justify">{t('meldScore.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bilirubin">{t('meldScore.labels.bilirubin')}</Label>
            <Input
              id="bilirubin"
              type="number"
              step="0.1"
              value={values.bilirubin}
              onChange={handleInputChange}
              placeholder={t('meldScore.placeholders.bilirubin')}
            />
          </div>
          <div>
            <Label htmlFor="creatinine">{t('meldScore.labels.creatinine')}</Label>
            <Input
              id="creatinine"
              type="number"
              step="0.1"
              value={values.creatinine}
              onChange={handleInputChange}
              placeholder={t('meldScore.placeholders.creatinine')}
            />
          </div>
          <div>
            <Label htmlFor="inr">{t('meldScore.labels.inr')}</Label>
            <Input
              id="inr"
              type="number"
              step="0.1"
              value={values.inr}
              onChange={handleInputChange}
              placeholder={t('meldScore.placeholders.inr')}
            />
          </div>
           <div>
            <Label htmlFor="sodium">{t('meldScore.labels.sodium')}</Label>
            <Input
              id="sodium"
              type="number"
              value={values.sodium}
              onChange={handleInputChange}
              placeholder={t('meldScore.placeholders.sodium')}
            />
          </div>
        </div>
         <div className="flex items-center space-x-2">
            <Checkbox
              id="dialysisTwiceInWeek"
              checked={values.dialysisTwiceInWeek}
              onCheckedChange={() => handleCheckboxChange('dialysisTwiceInWeek')}
            />
            <Label htmlFor="dialysisTwiceInWeek" className="text-justify">{t('meldScore.labels.dialysis')}</Label>
          </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('meldScore.calculatedScoreTitle')}</AlertTitle>
          <AlertDescription className="text-justify">
            {interpretation}
          </AlertDescription>
        </Alert>
         <Alert variant="destructive">
           <Info className="h-4 w-4" />
           <AlertTitle>{t('meldScore.disclaimerTitle')}</AlertTitle>
           <AlertDescription className="text-justify">
             {t('meldScore.disclaimerText')}
           </AlertDescription>
         </Alert>
      </CardContent>
      <CardFooter>
        <Button onClick={resetCalculator} variant="outline" className="w-full">
          {t('meldScore.resetButton')}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default MeldScore;
