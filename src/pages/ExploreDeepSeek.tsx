import React, { useState, useCallback, useRef, useEffect } from 'react'; // Consolidated imports
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog"; // Added AlertDialog imports
import { Terminal, Sparkles, SendHorizonal, Loader2, Paperclip, X, ArrowLeft } from "lucide-react";
import { useTranslation } from 'react-i18next'; // Added for i18n
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom'; // Added Link import
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import * as pdfjsLib from 'pdfjs-dist';
import { useAuth } from '@/contexts/AuthContext'; // Added useAuth
import { supabase } from '@/lib/supabaseClient'; // Added supabase
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Added useFeatureAccess
import UpgradePlanDialogContent from '@/components/UpgradePlanDialog'; // Corrected Import
import { FeatureName } from '@/lib/quotas'; // Added FeatureName

// Configure the worker source for pdfjs-dist
// Make sure the worker file is copied to your public directory during build

// i18n hook
// const { t } = useTranslation(); // This will be moved inside the component

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Define model types & message structure
type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';
interface Message {
  id: string; // Unique ID for React key
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
interface ExplorationThread {
  id: string; // Unique ID for React key
  initialModel: DeepSeekModel;
  messages: Message[];
  createdAt: Date;
}

const ExploreDeepSeek: React.FC = () => {
  const { t } = useTranslation(); // i18n hook
  const { toast } = useToast();
  // Get user, level, and the function to open the global dialog (will be added to context later)
  const { user, level, openUpgradeDialog } = useAuth(); 
  const { checkAccess, incrementUsage } = useFeatureAccess(); // Corrected: Initialize hook
  // Removed local dialog state: const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const [prompt, setPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<DeepSeekModel>('deepseek-chat');
  const [response, setResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false); // General loading for main prompt
  const [error, setError] = useState<string | null>(null); // General error for main prompt
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null); // To store text from main file

  // State for history and thread interactions
  const [history, setHistory] = useState<ExplorationThread[]>([]);
  const [threadInputs, setThreadInputs] = useState<{ [threadId: string]: string }>({});
  const [threadLoading, setThreadLoading] = useState<{ [threadId: string]: boolean }>({}); // Loading state per thread
  const [threadErrors, setThreadErrors] = useState<{ [threadId: string]: string | null }>({}); // Error state per thread
  const [threadFiles, setThreadFiles] = useState<{ [threadId: string]: File | null }>({}); // State for files per thread
  const [threadExtractedTexts, setThreadExtractedTexts] = useState<{ [threadId: string]: string | null }>({}); // State for extracted text per thread
  const fileInputRef = React.useRef<HTMLInputElement>(null); // Ref for main file input
  const threadFileInputRefs = useRef<{ [threadId: string]: HTMLInputElement | null }>({}); // Refs for thread file inputs
  // Removed historyEndRef and associated useEffect


  // --- Main Submit Handler (Non-Streaming) ---
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Check if there's either a prompt or a file with extracted text
    if (!prompt.trim() && !extractedText) {
      setError(t('exploreDeepSeekPage.alerts.promptOrFileRequiredError'));
      return;
    }

    // --- Quota Check ---
    const featureName: FeatureName = 'explore_deepseek';
    const access = await checkAccess(featureName);

    if (!access.allowed) { // Corrected property check based on hook definition
      toast({
        title: t('exploreDeepSeekPage.alerts.accessDeniedTitle'),
        description: access.message || t('exploreDeepSeekPage.alerts.quotaReachedError'),
        variant: "destructive"
      });
      setError(access.message || t('exploreDeepSeekPage.alerts.quotaReachedError'));
      openUpgradeDialog(); // Open the global dialog
      setIsLoading(false); // Stop loading indicator
      return; // Stop execution if no access
    }
    // --- End Quota Check ---

    setIsLoading(true);
    setError(null);
    setResponse('');

    const workerUrl = import.meta.env.VITE_DEEPSEEK_WORKER_URL;
    if (!workerUrl) {
      setError(t('exploreDeepSeekPage.alerts.workerUrlError'));
      setIsLoading(false);
      return;
    }

    // Combine prompt and extracted text if available
    let finalUserContent = prompt;
    if (extractedText && selectedFile) {
        finalUserContent = `[Content from ${selectedFile.name}]:\n\n${extractedText}\n\n[User Prompt]:\n\n${prompt || t('exploreDeepSeekPage.noAdditionalPrompt')}`; // Assuming a key for "(No additional prompt)"
    } else if (!prompt.trim() && !selectedFile) { // Redundant check, handled above, but safe
        setError(t('exploreDeepSeekPage.alerts.promptOrFileRequiredError'));
        setIsLoading(false);
        return;
    }

    const messages: Omit<Message, 'id' | 'timestamp'>[] = [
      { role: 'system', content: t('exploreDeepSeekPage.systemMessage') }, // Assuming a key for "You are a helpful medical assistant."
      { role: 'user', content: finalUserContent }, // Use combined content
    ];

    try {
      // --- Increment Usage (Call but don't check return value for truthiness) ---
      await incrementUsage(featureName);
      // Log potential errors from the hook itself if needed, or handle within the hook
      // --- End Increment Usage ---

      const res = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(t('exploreDeepSeekPage.alerts.workerRequestFailedError', { status: res.status, statusText: res.statusText, errorText }));
      }

      const data = await res.json();
      if (data.responseText) {
        setResponse(data.responseText);
      } else {
        console.warn("Received response without responseText:", data);
        setError(t('exploreDeepSeekPage.alerts.emptyResponseError'));
        setResponse('');
      }

    } catch (err) {
      console.error('Error fetching from worker or parsing JSON:', err);
      setError(err instanceof Error ? err.message : t('exploreDeepSeekPage.alerts.unknownError'));
      setResponse('');
    } finally {
      setIsLoading(false);
      // Clear file state after submission attempt (success or fail)
      setSelectedFile(null);
      setExtractedText(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [prompt, selectedModel, extractedText, selectedFile, toast, checkAccess, incrementUsage, user, level]); // Added dependencies


  // --- File Handling Logic (Main Prompt) ---
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setExtractedText(null); // Reset while processing
    setError(null);
    setIsLoading(true); // Show general loading indicator

    try {
      if (file.type === 'text/plain') {
        const text = await file.text();
        setExtractedText(text);
        toast({ title: t('exploreDeepSeekPage.toasts.fileLoadedSuccess', { fileType: 'TXT' }) });
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // Ensure item.str exists before joining
          fullText += textContent.items.map((item: any) => item.str || '').join(' ') + '\n';
        }
        setExtractedText(fullText.trim());
        toast({ title: t('exploreDeepSeekPage.toasts.pdfExtractedSuccess') });
      } else {
        throw new Error(t('exploreDeepSeekPage.toasts.unsupportedFileTypeError'));
      }
    } catch (err) {
      console.error("Error processing file:", err);
      const errorMsg = err instanceof Error ? t('exploreDeepSeekPage.toasts.errorProcessingFile', { errorMessage: err.message }) : t('exploreDeepSeekPage.toasts.unknownFileProcessingError');
      setError(errorMsg);
      toast({ title: t('exploreDeepSeekPage.toasts.fileProcessingErrorTitle'), description: errorMsg, variant: "destructive" });
      setSelectedFile(null); // Clear invalid file
      setExtractedText(null);
    } finally {
      setIsLoading(false); // Hide general loading indicator
    }

     // Reset the input value so the same file can be selected again if removed
     if (event.target) {
        event.target.value = '';
     }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setExtractedText(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear the input
    }
  };

  // --- Thread File Handling Logic ---
  const handleThreadFileChange = async (event: React.ChangeEvent<HTMLInputElement>, threadId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setThreadFiles(prev => ({ ...prev, [threadId]: file }));
    setThreadExtractedTexts(prev => ({ ...prev, [threadId]: null })); // Reset while processing
    setThreadErrors(prev => ({ ...prev, [threadId]: null })); // Clear previous errors for this thread
    setThreadLoading(prev => ({ ...prev, [threadId]: true })); // Show loading for this thread

    try {
      let extractedThreadText = '';
      if (file.type === 'text/plain') {
        extractedThreadText = await file.text();
        toast({ title: t('exploreDeepSeekPage.toasts.threadFileLoadedSuccess', { fileType: 'TXT' }) });
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
           // Ensure item.str exists before joining
          fullText += textContent.items.map((item: any) => item.str || '').join(' ') + '\n';
        }
        extractedThreadText = fullText.trim();
        toast({ title: t('exploreDeepSeekPage.toasts.threadPdfExtractedSuccess') });
      } else {
        throw new Error(t('exploreDeepSeekPage.toasts.unsupportedFileTypeError'));
      }
      setThreadExtractedTexts(prev => ({ ...prev, [threadId]: extractedThreadText }));
    } catch (err) {
      console.error(`Error processing file for thread ${threadId}:`, err);
      const errorMsg = err instanceof Error ? t('exploreDeepSeekPage.toasts.errorProcessingFile', { errorMessage: err.message }) : t('exploreDeepSeekPage.toasts.unknownFileProcessingError');
      setThreadErrors(prev => ({ ...prev, [threadId]: errorMsg }));
      toast({ title: t('exploreDeepSeekPage.toasts.fileProcessingErrorTitle'), description: errorMsg, variant: "destructive" });
      setThreadFiles(prev => ({ ...prev, [threadId]: null })); // Clear invalid file for this thread
      setThreadExtractedTexts(prev => ({ ...prev, [threadId]: null }));
    } finally {
      setThreadLoading(prev => ({ ...prev, [threadId]: false })); // Hide loading for this thread
    }

    // Reset the input value so the same file can be selected again if removed
    if (event.target) {
      event.target.value = '';
    }
  };

  const triggerThreadFileSelect = (threadId: string) => {
    threadFileInputRefs.current[threadId]?.click();
  };

  const removeThreadFile = (threadId: string) => {
    setThreadFiles(prev => ({ ...prev, [threadId]: null }));
    setThreadExtractedTexts(prev => ({ ...prev, [threadId]: null }));
    const inputRef = threadFileInputRefs.current[threadId];
    if (inputRef) {
      inputRef.value = ''; // Clear the specific input
    }
  };


  // --- Explore Topic Handler ---
  const handleExploreClick = () => {
    // Include extracted text if available when creating the history
    let userContent = prompt;
    if (extractedText && selectedFile) {
        userContent = `[Content from ${selectedFile.name}]:\n\n${extractedText}\n\n[User Prompt]:\n\n${prompt || t('exploreDeepSeekPage.noAdditionalPrompt')}`;
    }

    if (!response && !userContent) return; // Check combined content

    const systemMessage: Message = { id: crypto.randomUUID(), role: 'system', content: t('exploreDeepSeekPage.systemMessage'), timestamp: new Date(Date.now() - 2000) };
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: userContent, timestamp: new Date(Date.now() - 1000) };
    const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: response, timestamp: new Date() };

    const newThread: ExplorationThread = {
      id: crypto.randomUUID(),
      initialModel: selectedModel,
      messages: [systemMessage, userMessage, assistantMessage],
      createdAt: new Date()
    };

    setHistory(prev => [...prev, newThread]);
    setPrompt(''); // Clear main prompt
    setResponse('');
    setSelectedFile(null); // Clear file state
    setExtractedText(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    setError(null);
    toast({ title: t('exploreDeepSeekPage.toasts.addedToHistory') });
  };

  // --- Thread Input Change Handler ---
  const handleThreadInputChange = (threadId: string, value: string) => {
    setThreadInputs(prev => ({ ...prev, [threadId]: value }));
  };

  // --- Send Message within a Thread Handler (Non-Streaming) ---
  const handleSendInThread = async (threadId: string) => {
    const thread = history.find(t => t.id === threadId);
    const threadPrompt = threadInputs[threadId]?.trim() || '';
    const threadFile = threadFiles[threadId];
    const threadFileText = threadExtractedTexts[threadId];

    // Check if there's either a prompt or a file with extracted text for the thread
    if (!thread || (!threadPrompt && !threadFileText)) {
      setThreadErrors(prev => ({ ...prev, [threadId]: t('exploreDeepSeekPage.alerts.threadPromptOrFileRequiredError') }));
      return;
    }

    // --- Quota Check for Thread ---
    const featureName: FeatureName = 'explore_deepseek'; // Same feature key
    const access = await checkAccess(featureName);

    if (!access.allowed) { // Corrected property check based on hook definition
      toast({
        title: t('exploreDeepSeekPage.alerts.accessDeniedTitle'),
        description: access.message || t('exploreDeepSeekPage.alerts.quotaReachedError'),
        variant: "destructive"
      });
      setThreadErrors(prev => ({ ...prev, [threadId]: access.message || t('exploreDeepSeekPage.alerts.quotaReachedError') }));
      openUpgradeDialog(); // Open the global dialog
      setThreadLoading(prev => ({ ...prev, [threadId]: false })); // Stop loading for this thread
      return; // Stop execution
    }
    // --- End Quota Check ---


    setThreadLoading(prev => ({ ...prev, [threadId]: true }));
    setThreadErrors(prev => ({ ...prev, [threadId]: null }));

    // Combine thread prompt and extracted text if available
    let finalThreadUserContent = threadPrompt;
    if (threadFileText && threadFile) {
        finalThreadUserContent = `[Content from ${threadFile.name}]:\n\n${threadFileText}\n\n[User Prompt]:\n\n${threadPrompt || t('exploreDeepSeekPage.noAdditionalPrompt')}`;
    }

    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: finalThreadUserContent, // Use combined content for the thread
      timestamp: new Date(Date.now() - 1000)
    };

    // Get previous messages *excluding* system messages for the API call history
    const messagesForApi = thread.messages
        .filter(msg => msg.role !== 'system')
        .map(({ role, content }) => ({ role, content }));
    // Add the new combined user message
    messagesForApi.push({ role: newUserMessage.role, content: newUserMessage.content });
    // Prepend the original system message (if needed by API, often good practice)
    messagesForApi.unshift({ role: 'system', content: t('exploreDeepSeekPage.systemMessage') });


    const workerUrl = import.meta.env.VITE_DEEPSEEK_WORKER_URL;
    if (!workerUrl) {
      setThreadErrors(prev => ({ ...prev, [threadId]: t('exploreDeepSeekPage.alerts.workerUrlError') }));
      setThreadLoading(prev => ({ ...prev, [threadId]: false }));
      return;
    }

    try {
      // --- Increment Usage ---
      await incrementUsage(featureName);
      // --- End Increment Usage ---

      const res = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi,
          model: thread.initialModel,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(t('exploreDeepSeekPage.alerts.workerRequestFailedError', { status: res.status, statusText: res.statusText, errorText }));
      }

      const data = await res.json();
      let modelResponseContent = '';
      if (data.responseText) {
        modelResponseContent = data.responseText;
      } else {
        console.warn("Received thread response without responseText:", data);
        throw new Error(t('exploreDeepSeekPage.alerts.emptyResponseError')); // Re-use generic empty response error
      }

      const newAssistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: modelResponseContent,
        timestamp: new Date()
      };

      // Update history, adding the *original* user message (combined) and the assistant response
      setHistory(prevHistory =>
        prevHistory.map(t =>
          t.id === threadId
            ? { ...t, messages: [...t.messages, newUserMessage, newAssistantMessage] }
            : t
        )
      );
      // Clear the input and file state for this specific thread
      setThreadInputs(prev => ({ ...prev, [threadId]: '' }));
      setThreadFiles(prev => ({ ...prev, [threadId]: null }));
      setThreadExtractedTexts(prev => ({ ...prev, [threadId]: null }));
      const inputRef = threadFileInputRefs.current[threadId];
      if (inputRef) {
        inputRef.value = '';
      }

      // Scroll the specific thread content area to the bottom
      // Use setTimeout to allow the DOM to update before scrolling
      setTimeout(() => {
        const contentElement = document.getElementById(`thread-content-${threadId}`);
        if (contentElement) {
          contentElement.scrollTop = contentElement.scrollHeight;
        }
      }, 0);

    } catch (err) {
      console.error("Error in handleSendInThread or parsing JSON:", err);
      const errorMsg = err instanceof Error ? err.message : t('exploreDeepSeekPage.alerts.unknownError');
      setThreadErrors(prev => ({ ...prev, [threadId]: errorMsg }));
      toast({ title: t('exploreDeepSeekPage.toasts.errorSendingMessageTitle'), description: errorMsg, variant: "destructive" });
    } finally {
      setThreadLoading(prev => ({ ...prev, [threadId]: false }));
    }
  };


  // --- Render Logic ---
  return (
    <>
      <PageHeader
        title={t('exploreDeepSeekPage.header.title')}
        subtitle={t('exploreDeepSeekPage.header.subtitle')}
      />
      <div className="container max-w-4xl mx-auto px-4 py-12 space-y-6">
        {/* Main Interaction Area */}
        <img src="/deep fix.png" alt="DeepSeek" style={{ display: 'block', margin: '0 auto', width: '300px', marginBottom: '10px' }} />
        <Card>
          <CardHeader><CardTitle>{t('exploreDeepSeekPage.interactCard.title')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {error && ( // Show main error here
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>{t('exploreDeepSeekPage.alerts.errorTitle')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {/* Prompt Input & File Upload */}
            <div className="space-y-2">
              <Label htmlFor="prompt">{t('exploreDeepSeekPage.interactCard.promptLabel')}</Label>
              <div className="relative">
                 <Textarea
                   id="prompt"
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   placeholder={selectedFile ? t('exploreDeepSeekPage.interactCard.promptPlaceholderWithFile', { fileName: selectedFile.name }) : t('exploreDeepSeekPage.interactCard.promptPlaceholder')}
                   rows={5}
                   disabled={isLoading} // Use general isLoading here
                   className="pr-10" // Add padding for the button
                 />
                 <Button
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-2 right-2 h-7 w-7"
                    onClick={triggerFileSelect}
                    title={t('exploreDeepSeekPage.interactCard.attachFileButtonTitle')}
                    disabled={isLoading} // Use general isLoading
                 >
                    <Paperclip className="h-4 w-4" />
                    <span className="sr-only">{t('exploreDeepSeekPage.interactCard.attachFileSrOnly')}</span>
                 </Button>
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".txt,.pdf" // Accept only text and pdf files
                    disabled={isLoading} // Use general isLoading
                 />
              </div>
               {/* Display selected file */}
               {selectedFile && (
                 <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                   <Badge variant="secondary" className="flex items-center gap-1">
                     <Paperclip className="h-3 w-3" />
                     {selectedFile.name}
                   </Badge>
                   <Button variant="ghost" size="icon" onClick={removeSelectedFile} className="h-6 w-6" title={t('exploreDeepSeekPage.interactCard.removeFileButtonTitle')} disabled={isLoading}>
                     <X className="h-4 w-4" />
                     <span className="sr-only">{t('exploreDeepSeekPage.interactCard.removeFileSrOnly')}</span>
                   </Button>
                 </div>
               )}
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>{t('exploreDeepSeekPage.interactCard.selectModelLabel')}</Label>
              <RadioGroup value={selectedModel} onValueChange={(value: string) => setSelectedModel(value as DeepSeekModel)} className="flex space-x-4" disabled={isLoading}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="deepseek-chat" id="model-chat" /><Label htmlFor="model-chat">{t('exploreDeepSeekPage.interactCard.modelChatLabel')}</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="deepseek-reasoner" id="model-reasoner" /><Label htmlFor="model-reasoner">{t('exploreDeepSeekPage.interactCard.modelReasonerLabel')}</Label></div>
              </RadioGroup>
            </div>
            {/* Submit Button - Disable if no prompt AND no file */}
            <Button onClick={handleSubmit} disabled={isLoading || (!prompt.trim() && !selectedFile)}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('exploreDeepSeekPage.interactCard.generatingButton')}</> : t('exploreDeepSeekPage.interactCard.submitButton')}
            </Button>
          </CardContent>
        </Card>

        {/* Current Response Area */}
        {(response || (isLoading && !error)) && (
          <Card>
             <CardHeader><CardTitle>{t('exploreDeepSeekPage.responseCard.title', { modelName: selectedModel })}</CardTitle></CardHeader>
             <CardContent>
               {/* Added prose classes */}
               <div className="p-4 border rounded-md bg-gray-50 text-justify min-h-[50px] gemini-response-container prose prose-sm dark:prose-invert max-w-none">
                 {response ? (
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>
                     {response}
                   </ReactMarkdown>
                 ) : (
                   isLoading && <span className="text-gray-500">{t('exploreDeepSeekPage.responseCard.generatingText')}</span> // Show loading text for non-streaming
                 )}
               </div>
             </CardContent>
             {response && !isLoading && (
               <CardFooter className="flex justify-end p-4 border-t">
                 <Button variant="secondary" onClick={handleExploreClick}><Sparkles className="mr-2 h-4 w-4" /> {t('exploreDeepSeekPage.responseCard.exploreTopicButton')}</Button>
               </CardFooter>
             )}
          </Card>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div className="mt-10 space-y-6">
            <h2 className="text-2xl font-semibold tracking-tight text-center border-t pt-6">{t('exploreDeepSeekPage.history.sectionTitle')}</h2>
            {history.map((thread) => (
              <Card key={thread.id} className="bg-muted/50 shadow-md"> {/* Removed id */}
                <CardHeader> {/* Reverted header */}
                  <CardTitle className="text-lg">{t('exploreDeepSeekPage.history.threadTitle')}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t('exploreDeepSeekPage.history.startedLabel', { dateTime: thread.createdAt.toLocaleString() })} | {t('exploreDeepSeekPage.history.modelLabel', { modelName: thread.initialModel })}</p>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[500px] overflow-y-auto pr-4"> {/* Removed id */}
                  {/* Render messages within the thread, filtering out system messages */}
                  {thread.messages.filter(message => message.role !== 'system').map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-lg max-w-[80%] ${message.role === 'user' ? 'bg-background border' : 'bg-background border'}`}> {/* Changed user message style */}
                        {message.content && (
                          // Added wrapper div with overflow-x-auto
                          <div className="overflow-x-auto">
                             <div className="max-w-none prose prose-sm dark:prose-invert text-justify"> {/* Added text-justify */}
                               <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                 {message.content}
                               </ReactMarkdown>
                             </div>
                          </div>
                        )}
                        <p className="text-xs opacity-70 mt-1.5 text-right">{message.timestamp.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  {/* Loading indicator for this thread */}
                  {threadLoading[thread.id] && (
                    <div className="flex justify-start">
                      <div className="p-3 rounded-lg bg-background border animate-pulse"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    </div>
                  )}
                  {/* Error specific to this thread */}
                  {threadErrors[thread.id] && (
                    <Alert variant="destructive" className="mt-2">
                      <Terminal className="h-4 w-4" />
                      <AlertTitle>{t('exploreDeepSeekPage.alerts.errorTitle')}</AlertTitle>
                      <AlertDescription>{threadErrors[thread.id]}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                {/* Input area for follow-up in this thread */}
                <CardFooter className="border-t pt-4 flex flex-col gap-2">
                   {/* Display selected file for this thread */}
                   {threadFiles[thread.id] && (
                     <div className="flex items-center justify-between p-2 border rounded-md bg-muted w-full">
                       <Badge variant="secondary" className="flex items-center gap-1">
                         <Paperclip className="h-3 w-3" />
                         {threadFiles[thread.id]?.name}
                       </Badge>
                       <Button variant="ghost" size="icon" onClick={() => removeThreadFile(thread.id)} className="h-6 w-6" title={t('exploreDeepSeekPage.interactCard.removeFileButtonTitle')} disabled={threadLoading[thread.id]}>
                         <X className="h-4 w-4" />
                         <span className="sr-only">{t('exploreDeepSeekPage.interactCard.removeFileSrOnly')}</span>
                       </Button>
                     </div>
                   )}
                  <div className="flex items-center gap-2 w-full relative"> {/* Added relative positioning */}
                     <Textarea
                       placeholder={threadFiles[thread.id] ? t('exploreDeepSeekPage.history.followUpPlaceholderWithFile', { fileName: threadFiles[thread.id]?.name }) : t('exploreDeepSeekPage.history.followUpPlaceholder')}
                       value={threadInputs[thread.id] || ''}
                       onChange={(e) => handleThreadInputChange(thread.id, e.target.value)}
                       rows={2}
                       className="flex-grow resize-none pr-10" // Add padding for button
                       disabled={threadLoading[thread.id]}
                       onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendInThread(thread.id); } }}
                     />
                     {/* File Attach Button for Thread */}
                     <Button
                        variant="ghost"
                        size="icon"
                        className="absolute bottom-1 right-12 h-7 w-7" // Position near send button
                        onClick={() => triggerThreadFileSelect(thread.id)}
                        title={t('exploreDeepSeekPage.interactCard.attachFileButtonTitle')}
                        disabled={threadLoading[thread.id]}
                     >
                        <Paperclip className="h-4 w-4" />
                        <span className="sr-only">{t('exploreDeepSeekPage.interactCard.attachFileSrOnly')}</span>
                     </Button>
                     <input
                        type="file"
                        ref={el => threadFileInputRefs.current[thread.id] = el} // Assign ref dynamically
                        onChange={(e) => handleThreadFileChange(e, thread.id)}
                        className="hidden"
                        accept=".txt,.pdf"
                        disabled={threadLoading[thread.id]}
                     />
                     {/* Send Button */}
                     <Button
                       size="icon"
                       onClick={() => handleSendInThread(thread.id)}
                       disabled={threadLoading[thread.id] || (!threadInputs[thread.id]?.trim() && !threadFiles[thread.id])} // Disable if no text AND no file
                       className="shrink-0"
                     >
                       <SendHorizonal className="h-4 w-4" />
                       <span className="sr-only">{t('exploreDeepSeekPage.history.sendButtonSrOnly')}</span>
                     </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
            {/* Removed historyEndRef div */}
          </div>
        )}

        {/* Back to Tools Button */}
        <div className="mt-12 flex justify-center">
          <Button asChild variant="outline">
            <Link to="/tools" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('exploreDeepSeekPage.buttons.backToTools')}
            </Link>
          </Button>
        </div>

      </div> {/* End container */}
      {/* Removed local AlertDialog rendering */}
    </>
  );
};

export default ExploreDeepSeek;
