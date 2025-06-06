import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, FileText, GraduationCap, Lightbulb } from 'lucide-react'; // Added icons
// Removed unused imports: useFeatureAccess, FeatureName, useToast, Alert, AlertDescription, AlertTitle, Skeleton

// Define icons for each resource
const resourceIcons: { [key: string]: React.ElementType } = {
  coursera: GraduationCap,
  osmosis: Lightbulb, // Example icon, adjust as needed
  uptodate: FileText, // Example icon, adjust as needed
  other: FileText, // Example icon, adjust as needed
  sinera: BookOpen,
};

const resources = [
  {
    id: 'coursera',
    title: 'Coursera',
    description: 'Explore courses and specializations from top universities and companies.',
    path: '/tools/learning-resources/coursera',
    icon: resourceIcons.coursera,
  },
  {
    id: 'osmosis',
    title: 'Osmosis',
    description: 'Visual learning platform for medical students and professionals.',
    path: '/tools/learning-resources/osmosis',
    icon: resourceIcons.osmosis,
  },
  {
    id: 'uptodate',
    title: 'UpToDate',
    description: 'Evidence-based clinical decision support resource.',
    path: '/tools/learning-resources/uptodate',
    icon: resourceIcons.uptodate,
  },
  {
    id: 'other',
    title: 'Other Resources',
    description: 'A collection of various other learning materials and links.',
    path: '/tools/learning-resources/other',
    icon: resourceIcons.other,
  },
  {
    id: 'sinera',
    title: 'SINERA X DaivanLabs',
    description: 'Exclusive literature review materials.',
    path: '/tools/learning-resources/sinera',
    icon: resourceIcons.sinera,
  },
];

const LearningResources: React.FC = () => {
  const { t } = useTranslation();
  // Removed feature access check logic

  return (
    <>
      <PageHeader
        title={t('learningResourcesPage.header.title')}
        subtitle={t('learningResourcesPage.header.subtitle')}
      />
      <div className="container max-w-7xl mx-auto px-4 py-12">
        {/* Always render the cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {resources.map((resource) => {
            const IconComponent = resource.icon; // Get the icon component
            return (
              <Card key={resource.id} className="flex flex-col h-full transition-all duration-300 hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {IconComponent && <IconComponent className="h-5 w-5" />} {/* Render icon */}
                    {resource.title}
                  </CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  {null}
                </CardContent>
                <CardFooter>
                  <Link to={resource.path} className="w-full">
                    <Button className="w-full">Explore</Button>
                  </Link>
                </CardFooter>
            </Card>
          ); // Added semicolon here
          })}
        </div>

        <div className="mt-12 text-center">
          <Link to="/tools">
            <Button variant="outline" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('learningResourcesPage.buttons.backToTools')}
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default LearningResources;
