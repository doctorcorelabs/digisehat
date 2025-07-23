import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Bot, BrainCircuit, Library, Pill, Calculator, Link as LinkIcon, Stethoscope, Microscope, BookOpen, Cpu, Database, HeartPulse, Users, Lightbulb } from 'lucide-react'; // Added Cpu and Database icons

const Home = () => {
  const { isAuthenticated, user } = useAuth(); // Assuming user object might have name
  const { t, i18n } = useTranslation(); // Initialize useTranslation

  // Define tool structure for easier mapping
  const tools = [
    { nameKey: 'tools.nutritionDatabase', path: '/tools/nutrition-database', icon: Database, descriptionKey: 'toolDescriptions.nutritionDatabase' },
    { nameKey: 'tools.aiMindMapGenerator', path: '/tools/ai-mindmap-generator', icon: BrainCircuit, descriptionKey: 'toolDescriptions.aiMindMapGenerator' },
    { nameKey: 'tools.diseaseLibrary', path: '/tools/disease-library', icon: Stethoscope, descriptionKey: 'toolDescriptions.diseaseLibrary' },
    { nameKey: 'tools.drugReference', path: '/tools/drug-reference', icon: Pill, descriptionKey: 'toolDescriptions.drugReference' },
    { nameKey: 'tools.clinicalScoringHub', path: '/tools/clinical-scoring-hub', icon: Calculator, descriptionKey: 'toolDescriptions.clinicalScoringHub' },
    { nameKey: 'tools.interactionChecker', path: '/tools/interaction-checker', icon: LinkIcon, descriptionKey: 'toolDescriptions.interactionChecker' },
    { nameKey: 'tools.learningResources', path: '/tools/learning-resources', icon: BookOpen, descriptionKey: 'toolDescriptions.learningResources' },
    { nameKey: 'tools.aiPeerReview', path: '/tools/ai-peer-review', icon: Microscope, descriptionKey: 'toolDescriptions.aiPeerReview' },
    // Note: Explore DeepSeek is featured, not listed here, but its route is /tools/explore-deepseek
  ];


  // Determine the welcome message
  const welcomeMessage = isAuthenticated && user?.email
    ? t('welcomeMessage', { user: user.email }) // Using translation with interpolation
    : t('welcomeMessage');

  const keyFeatures = [
    { titleKey: "home.features.trustedInfo.title", descriptionKey: "home.features.trustedInfo.description", icon: BookOpen, tools: [t('tools.diseaseLibrary'), t('tools.drugReference')] },
    { titleKey: "home.features.smartTools.title", descriptionKey: "home.features.smartTools.description", icon: BrainCircuit, tools: [t('tools.clinicalScoringHub'), t('tools.medicalCalculator'), t('tools.aiChatbot')] },
    { titleKey: "home.features.interactiveLearning.title", descriptionKey: "home.features.interactiveLearning.description", icon: Lightbulb, tools: [t('tools.aiMindMapGenerator'), t('tools.learningResources')] }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-green-500 text-white py-20 px-4 md:px-8 text-center">
        <div className="container mx-auto">
          <img src="/daivanlabs.png" alt={t('altText.daivanlabsLogo')} className="h-24 w-auto mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('home.hero.headline')}</h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">{t('home.hero.subheadline')}</p>
          <Link to="/tools">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
              {t('home.hero.cta')}
            </Button>
          </Link>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 px-4 md:px-8">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">{t('home.features.sectionTitle')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {keyFeatures.map((feature, index) => (
              <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="items-center">
                  <feature.icon className="h-12 w-12 text-blue-600 mb-4" />
                  <CardTitle className="text-xl font-semibold">{t(feature.titleKey)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-3">{t(feature.descriptionKey)}</p>
                  <p className="text-sm text-gray-600"><i>{t('home.features.includes')}: {feature.tools.join(', ')}</i></p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Placeholder - A proper footer would be in Layout.tsx or its own component */}
      <footer className="py-8 text-center text-gray-600 border-t">
        <p>&copy; {new Date().getFullYear()} {t('brandName')}. {t('home.footer.allRightsReserved')}</p>
      </footer>
    </div>
  );
};

export default Home;
