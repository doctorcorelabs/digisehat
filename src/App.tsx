import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // Import Navigate
import Layout from "./components/Layout";
import Home from "./pages/Home"; // Import the new Home component
import NotFound from "./pages/NotFound";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword"; // Import ForgotPassword
import ResetPassword from "./pages/ResetPassword"; // Import ResetPassword
import Tools from "./pages/Tools";
import MedicalCalculator from "./pages/MedicalCalculator";
import DrugReference from "./pages/DrugReference"; 
import NutritionDatabase from "./pages/NutritionDatabase"; // Import NutritionDatabase
import DiseaseLibrary from "./pages/DiseaseLibrary"; // Import DiseaseLibrary
import ClinicalGuidelines from "./pages/ClinicalGuidelines"; // Import ClinicalGuidelines
import AIChatbot from "./pages/AIChatbot"; // Import AIChatbot
import AIPeerReview from "./pages/AIPeerReview"; // Import AIPeerReview
import ExploreGemini from "./pages/ExploreGemini"; // Import ExploreGemini
import InteractionChecker from "./pages/InteractionChecker"; // Import InteractionChecker
import MindMapMaker from "./pages/MindMapMaker"; // Import MindMapMaker
import ClinicalScoringHub from "./pages/ClinicalScoringHub"; // Import ClinicalScoringHub
import ExploreDeepSeek from "./pages/ExploreDeepSeek"; // Import ExploreDeepSeek
import ExploreChatGPT from "./pages/ExploreChatGPT"; // Import ExploreChatGPT
import AdminDashboard from "./pages/AdminDashboard"; // Import AdminDashboard
import NucleusArchive from "./pages/NucleusArchive"; // Import NucleusArchive
import NucleusPost from "./pages/NucleusPost"; // Import NucleusPost
import LearningResources from "./pages/LearningResources"; // Import LearningResources
import LearningCoursera from "./pages/LearningCoursera"; // Import LearningCoursera
import LearningOsmosis from "./pages/LearningOsmosis"; // Import LearningOsmosis
import LearningUpToDate from "./pages/LearningUpToDate"; // Import LearningUpToDate
import LearningOther from "./pages/LearningOther"; // Import LearningOther
import LearningSinera from "./pages/LearningSinera"; // Import LearningSinera
import AuthorPage from "./pages/Author"; // Import AuthorPage
// Removed StreamInteraction import
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout><Home /></Layout>} /> {/* Render Home component at root */}
            <Route path="/nucleus" element={<Layout><NucleusArchive /></Layout>} /> {/* Add Nucleus Archive route */}
            <Route path="/nucleus/:slug" element={<Layout><NucleusPost /></Layout>} /> {/* Add route for individual NUCLEUS posts */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} /> {/* Add ForgotPassword route */}
            <Route path="/reset-password" element={<ResetPassword />} /> {/* Add ResetPassword route */}
            <Route 
              path="/tools" 
              element={
                <ProtectedRoute>
                  <Layout><Tools /></Layout> {/* Wrap Tools in Layout */}
                </ProtectedRoute>
              } 
            />
            {/* Add route for Medical Calculator */}
            <Route 
              path="/tools/medical-calculator" 
              element={
                <ProtectedRoute>
                  <Layout><MedicalCalculator /></Layout>
                </ProtectedRoute>
              } 
            />
            {/* Add route for Drug Reference */}
            <Route 
              path="/tools/drug-reference" 
              element={
                <ProtectedRoute>
                  <Layout><DrugReference /></Layout>
                </ProtectedRoute>
              } 
            />
            {/* Add route for Nutrition Database */}
            <Route 
              path="/tools/nutrition-database" 
              element={
                <ProtectedRoute>
                  <Layout><NutritionDatabase /></Layout>
                </ProtectedRoute>
              } 
            />
            {/* Add route for Disease Library */}
            <Route 
              path="/tools/disease-library" 
              element={
                <ProtectedRoute>
                  <Layout><DiseaseLibrary /></Layout>
                 </ProtectedRoute>
               } 
             />
             {/* Add route for Clinical Guidelines */}
             <Route 
               path="/tools/clinical-guidelines" 
               element={
                 <ProtectedRoute>
                   <Layout><ClinicalGuidelines /></Layout>
                 </ProtectedRoute>
               }
             />
             {/* Add route for Explore GEMINI */}
             <Route
               path="/tools/explore-gemini"
               element={
                 <ProtectedRoute>
                   <Layout><ExploreGemini /></Layout>
                 </ProtectedRoute>
               }
             />
             {/* Add route for AI Chatbot */}
             <Route 
               path="/tools/ai-chatbot"
               element={
                 <ProtectedRoute>
                  <Layout><AIChatbot /></Layout>
                </ProtectedRoute>
              } 
            />
            {/* Add route for AI Peer-Review */}
            <Route 
              path="/tools/ai-peer-review" 
              element={
                <ProtectedRoute>
                  <Layout><AIPeerReview /></Layout>
                </ProtectedRoute>
              } 
            />
            {/* Add route for Interaction Checker */}
            <Route
              path="/tools/interaction-checker"
              element={
                <ProtectedRoute>
                  <Layout><InteractionChecker /></Layout>
                 </ProtectedRoute>
               }
             />
             {/* Add route for AI Mind Map Generator */}
             <Route
               path="/tools/ai-mindmap-generator"
               element={
                 <ProtectedRoute>
                   <Layout><MindMapMaker /></Layout>
                 </ProtectedRoute>
               }
             />
             {/* Add route for Clinical Scoring Hub */}
            <Route
              path="/tools/clinical-scoring-hub"
              element={
                <ProtectedRoute>
                  <Layout><ClinicalScoringHub /></Layout>
                 </ProtectedRoute>
               }
             />
             {/* Add route for Explore DeepSeek */}
             <Route
               path="/tools/explore-deepseek"
               element={
                 <ProtectedRoute>
                  <Layout><ExploreDeepSeek /></Layout>
                </ProtectedRoute>
              }
            />
            {/* Add route for Explore ChatGPT */}
            <Route
              path="/tools/explore-chatgpt"
              element={
                <ProtectedRoute>
                  <Layout><ExploreChatGPT /></Layout>
                </ProtectedRoute>
              }
            />
            {/* Add routes for Learning Resources */}
            <Route
              path="/tools/learning-resources"
              element={
                <ProtectedRoute>
                  <Layout><LearningResources /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/learning-resources/coursera"
              element={
                <ProtectedRoute>
                  <Layout><LearningCoursera /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/learning-resources/osmosis"
              element={
                <ProtectedRoute>
                  <Layout><LearningOsmosis /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/learning-resources/uptodate"
              element={
                <ProtectedRoute>
                  <Layout><LearningUpToDate /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/learning-resources/other"
              element={
                <ProtectedRoute>
                  <Layout><LearningOther /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/learning-resources/sinera"
              element={
                <ProtectedRoute>
                  <Layout><LearningSinera /></Layout>
                </ProtectedRoute>
              }
            />
            {/* Add route for Admin Dashboard */}
            <Route
              path="/admin-dashboard"
               element={
                 <ProtectedRoute requiredLevel="Administrator">
                   <Layout><AdminDashboard /></Layout>
                 </ProtectedRoute>
               }
             />
             {/* Add route for Author Page */}
             <Route
               path="/author"
               element={
                 <ProtectedRoute>
                   <Layout><AuthorPage /></Layout>
                 </ProtectedRoute>
               }
             />
             {/* Removed Stream Interaction route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
