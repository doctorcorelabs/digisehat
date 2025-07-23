import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next'; // Import useTranslation and Trans
import PageHeader from '@/components/PageHeader';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Upload, X, File as FileIcon, ArrowLeft, Loader2, Sparkles, SendHorizonal, Paperclip, LogIn } from "lucide-react"; // Added LogIn icon
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Import hook
import { FeatureName } from '@/lib/quotas'; // Import FeatureName from quotas.ts
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown, { Components } from 'react-markdown'; // Import Components type
import remarkGfm from 'remark-gfm';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// --- Props Interface ---
interface ExploreChatGPTProps {
  isAuthenticated?: boolean; // Optional prop to receive auth status
}
// --- End Props Interface ---


// --- Helper Function to Format Tables ---
const tryFormatTable = (text: string): string => {
  const lines = text.split('\n');
  const tableRegex = /^\s*\|.+\|.+\|/;
  let inTable = false;
  let tableBuffer: string[] = [];
  let formattedLines: string[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Detect table start/continuation
    if (tableRegex.test(trimmed) || (inTable && trimmed.startsWith('|'))) {
      if (!inTable) {
        // New table detected
        inTable = true;
        tableBuffer = [];
      }
      tableBuffer.push(trimmed);
    } else {
      if (inTable) {
        // Process accumulated table lines
        if (tableBuffer.length >= 1) {
          const processedTable = processTableBuffer(tableBuffer);
          formattedLines.push(...processedTable);
        }
        tableBuffer = [];
        inTable = false;
      }
      formattedLines.push(line);
    }

    // Process remaining table at end of text
    if (index === lines.length - 1 && inTable && tableBuffer.length > 0) {
      const processedTable = processTableBuffer(tableBuffer);
      formattedLines.push(...processedTable);
    }
  });

  return formattedLines.join('\n');
};

const processTableBuffer = (buffer: string[]): string[] => {
  // Find separator line index
  const separatorIndex = buffer.findIndex(line =>
    line.replace(/[^\|]/g, '').length > 2 && // At least 2 pipes
    line.replace(/[^:-]/g, '').length >= 2 && // Contains at least 2 : or -
    line.trim().match(/^[\|\s:-]+$/)
  );

  // If no separator found, insert one after first line
  if (separatorIndex === -1 && buffer.length > 0) {
    const header = buffer[0];
    const colCount = (header.match(/\|/g) || []).length - 1;
    const separator = '|' + Array(colCount).fill('---').join('|') + '|';
    buffer.splice(1, 0, separator);
  }

  // Clean up alignment syntax and normalize pipes
  return buffer.map((line, idx) => {
    // Remove leading/trailing whitespace around pipes
    let cleaned = line.trim().replace(/\s*\|\s*/g, '|');

    // Add missing starting/ending pipes
    if (!cleaned.startsWith('|')) cleaned = `|${cleaned}`;
    if (!cleaned.endsWith('|')) cleaned = `${cleaned}|`;

    // Normalize separator line
    if (idx === 1 || (separatorIndex !== -1 && idx === separatorIndex)) {
      return cleaned.replace(/[^|]/g, '-').replace(/\|/g, '|');
    }

    return cleaned;
  });
};

const modelOptions = [
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
];

interface FileData {
  mimeType: string;
  data: string;
}
interface ResponseImageData {
  mimeType: string;
  data: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: ResponseImageData | null;
  file?: FileData | null;
  fileName?: string | null;
  timestamp: Date;
}

interface ExplorationThread {
  id: string;
  initialModel: string;
  messages: Message[];
  createdAt: Date;
}

const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/flac'
];
const allowedFileTypesString = allowedMimeTypes.join(',');

// Update component signature to accept props
const ExploreChatGPT: React.FC<ExploreChatGPTProps> = ({ isAuthenticated: propIsAuthenticated }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const featureName: FeatureName = 'explore_chatgpt';
  const { checkAccess, incrementUsage, isLoadingToggles } = useFeatureAccess();
  const { toast } = useToast();
  // Get auth status from context as fallback or primary source if prop not passed
  const { isAuthenticated: contextIsAuthenticated, navigate, openUpgradeDialog } = useAuth();
  // Determine final auth status (prefer prop if provided)
  const isAuthenticated = typeof propIsAuthenticated === 'boolean' ? propIsAuthenticated : contextIsAuthenticated;

  // State for access check result
  const [initialAccessAllowed, setInitialAccessAllowed] = useState(false);
  const [initialAccessMessage, setInitialAccessMessage] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false); // State for login prompt UI

  // Component state
  const [prompt, setPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>("openai/gpt-4o-mini");
  const [uploadedFile, setUploadedFile] = useState<FileData | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>('');
  const [responseImage, setResponseImage] = useState<ResponseImageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ExplorationThread[]>([]);
  const [threadInputs, setThreadInputs] = useState<{ [threadId: string]: string }>({});
  const [threadLoading, setThreadLoading] = useState<{ [threadId: string]: boolean }>({});
  const [threadErrors, setThreadErrors] = useState<{ [threadId: string]: string | null }>({});
  const [threadFiles, setThreadFiles] = useState<{ [threadId: string]: FileData | null }>({});
  const [threadFileNames, setThreadFileNames] = useState<{ [threadId: string]: string | null }>({});
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const threadFileInputRefs = useRef<{ [threadId: string]: HTMLInputElement | null }>({});
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // We only need to verify feature access if the user is authenticated
    // The component should render even if not authenticated
    if (!isLoadingToggles && isAuthenticated) {
      const verifyInitialAccess = async () => {
        setInitialAccessMessage(null);
        try {
          const result = await checkAccess(featureName);
           setInitialAccessAllowed(result.allowed);
           if (!result.allowed) {
             setInitialAccessMessage(result.message || 'Access denied.');
           }
         } catch (error) {
           console.error("Error checking initial feature access:", error);
           setInitialAccessAllowed(false);
           setInitialAccessMessage('Failed to check feature access.');
           toast({
             title: "Error",
             description: "Could not verify feature access at this time.",
             variant: "destructive",
           });
         }
      };
      verifyInitialAccess();
    } else if (!isLoadingToggles && !isAuthenticated) {
      // If not authenticated, ensure access is marked as disallowed for UI purposes if needed
      // but don't redirect here. Submission handlers will catch it.
      setInitialAccessAllowed(false);
    }
  }, [isLoadingToggles, isAuthenticated, checkAccess, featureName, navigate, toast]);

  // Effect to scroll to the bottom when history updates
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" });
      openUpgradeDialog();
      return;
    }

    setShowLoginPrompt(false);
    setIsLoading(true);
    setError(null);
    setResponseText('');
    setResponseImage(null);

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...(uploadedFile ? [{ type: "image_url", image_url: { url: `data:${uploadedFile.mimeType};base64,${uploadedFile.data}` } }] : [])
        ]
      }
    ];

    const payload = {
      model: selectedModel,
      messages: messages
    };

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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', // Replace with your actual key
          'HTTP-Referer': 'https://digisehat.daivanlabs.com/', // Replace with your site URL
          'X-Title': 'DigiSehat' // Replace with your site name
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorMsg = `HTTP error! status: ${res.status}`;
        try { const errorData = await res.json(); errorMsg = errorData.error?.message || JSON.stringify(errorData.error) || errorMsg; } catch { /* Ignore */ }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const responseContent = data.choices?.[0]?.message?.content;

      if (responseContent) {
        setResponseText(responseContent);
      } else {
        setError("Received an empty response from the model.");
      }

    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
    await incrementUsage(featureName);
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setUploadedFileName(null);
    if (mainFileInputRef.current) mainFileInputRef.current.value = "";
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!allowedMimeTypes.includes(file.type)) {
        setError(`Unsupported file type: ${file.type || 'unknown'}.`);
        setUploadedFile(null);
        setUploadedFileName(null);
        if (mainFileInputRef.current) mainFileInputRef.current.value = "";
        return;
      }

      setError(null);
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setUploadedFile({ mimeType: file.type, data: base64String });
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        setUploadedFile(null);
        setUploadedFileName(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExploreClick = () => {
    const currentFormattedResponseText = tryFormatTable(responseText);
    if (!currentFormattedResponseText && !responseImage) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text: prompt, file: uploadedFile, fileName: uploadedFileName, timestamp: new Date(Date.now() - 1000) };
    const modelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'model',
      text: currentFormattedResponseText || '',
      image: responseImage,
      timestamp: new Date()
    };

    const newThread: ExplorationThread = {
      id: crypto.randomUUID(),
      initialModel: selectedModel,
      messages: [userMessage, modelMessage],
      createdAt: new Date()
    };
    setHistory(prev => [...prev, newThread]);
    setPrompt(''); setResponseText(''); setResponseImage(null); setUploadedFile(null); setUploadedFileName(null); setError(null);
    if (mainFileInputRef.current) mainFileInputRef.current.value = "";
    toast({ title: t('exploreChatGPTPage.toasts.addedToHistory') });
  };

  const handleThreadInputChange = (threadId: string, value: string) => { setThreadInputs(prev => ({ ...prev, [threadId]: value })); };

  const handleThreadFileChange = (threadId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!allowedMimeTypes.includes(file.type)) {
         setThreadErrors(prev => ({ ...prev, [threadId]: t('exploreChatGPTPage.errors.unsupportedFileType', { fileType: file.type || 'unknown' }) })); setThreadFiles(prev => ({ ...prev, [threadId]: null })); setThreadFileNames(prev => ({ ...prev, [threadId]: null }));
         if (threadFileInputRefs.current[threadId]) threadFileInputRefs.current[threadId]!.value = ""; return;
      }
      setThreadErrors(prev => ({ ...prev, [threadId]: null })); setThreadFileNames(prev => ({ ...prev, [threadId]: file.name }));
      const reader = new FileReader();
      reader.onloadend = () => { const base64String = (reader.result as string).split(',')[1]; setThreadFiles(prev => ({ ...prev, [threadId]: { mimeType: file.type, data: base64String } })); };
      reader.onerror = () => { setThreadErrors(prev => ({ ...prev, [threadId]: t('exploreChatGPTPage.errors.failedToReadFile') })); setThreadFiles(prev => ({ ...prev, [threadId]: null })); setThreadFileNames(prev => ({ ...prev, [threadId]: null })); };
      reader.readAsDataURL(file);
    }
  };

  const clearThreadFile = (threadId: string) => {
    setThreadFiles(prev => ({ ...prev, [threadId]: null })); setThreadFileNames(prev => ({ ...prev, [threadId]: null }));
    if (threadFileInputRefs.current[threadId]) threadFileInputRefs.current[threadId]!.value = "";
  };

  const handleSendInThread = async (threadId: string) => {
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" });
      openUpgradeDialog();
      return;
    }

    const thread = history.find(t => t.id === threadId);
    const promptText = threadInputs[threadId]?.trim() || '';
    const fileData = threadFiles[threadId];

    if (!thread || (!promptText && !fileData)) {
      setThreadErrors(prev => ({ ...prev, [threadId]: t('exploreChatGPTPage.errors.promptOrFileRequired') }));
      return;
    }

    setShowLoginPrompt(false);
    setThreadLoading(prev => ({ ...prev, [threadId]: true }));
    setThreadErrors(prev => ({ ...prev, [threadId]: null }));

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: promptText,
      file: fileData,
      fileName: threadFileNames[threadId],
      timestamp: new Date(Date.now() - 1000)
    };

    const messagesForApi = [...thread.messages, userMessage].map(msg => {
      const content: any[] = [];
      if (msg.text) {
        content.push({ type: "text", text: msg.text });
      }
      if (msg.file) {
        content.push({ type: "image_url", image_url: { url: `data:${msg.file.mimeType};base64,${msg.file.data}` } });
      }
      // Note: OpenRouter API doesn't typically accept images from the model role in history.
      // This part might need adjustment based on API behavior.
      if (msg.image) {
         content.push({ type: "text", text: "[Image was generated in a previous turn]" });
      }
      return { role: msg.role, content };
    });


    const payload = {
      model: thread.initialModel,
      messages: messagesForApi,
    };

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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', // Replace with your actual key
          'HTTP-Referer': 'https://digisehat.daivanlabs.com/', // Replace with your site URL
          'X-Title': 'DigiSehat' // Replace with your site name
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorMsg = `HTTP error! status: ${res.status}`;
        try { const errorData = await res.json(); errorMsg = errorData.error?.message || JSON.stringify(errorData.error) || errorMsg; } catch { /* Ignore */ }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const responseContent = data.choices?.[0]?.message?.content;
      let modelResponseImage: ResponseImageData | null = null; // OpenRouter text-only for now

      if (responseContent) {
        const formattedModelResponseText = tryFormatTable(responseContent);
        const modelMessage: Message = {
          id: crypto.randomUUID(),
          role: 'model',
          text: formattedModelResponseText,
          image: modelResponseImage,
          timestamp: new Date()
        };

        setHistory(prevHistory =>
          prevHistory.map(t =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, userMessage, modelMessage] }
              : t
          )
        );

        setThreadInputs(prev => ({ ...prev, [threadId]: '' }));
        clearThreadFile(threadId);
      } else {
        throw new Error("Received an empty response from the model.");
      }

    } catch (err: any) {
      console.error("Error in handleSendInThread:", err);
      setThreadErrors(prev => ({ ...prev, [threadId]: err.message || 'An error occurred.' }));
    } finally {
      setThreadLoading(prev => ({ ...prev, [threadId]: false }));
    }

    await incrementUsage(featureName);
  };


  return (
    <>
      <PageHeader title={t('exploreChatGPTPage.header.title')} subtitle={t('exploreChatGPTPage.header.subtitle')} />
      <img
        src="/chatgpt.png"
        alt="ChatGPT"
        style={{
          display: 'block',
          margin: '0 auto',
          width: '300px',
          marginTop: '30px',
          marginBottom: '20px'
         }}
       />
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-6">
        {isLoadingToggles && (
           <div className="flex flex-col space-y-3 mt-4">
             <Skeleton className="h-[300px] w-full rounded-lg" />
             <Skeleton className="h-[200px] w-full rounded-lg" />
           </div>
         )}
        {!isLoadingToggles && (
          <>
            <Card>
              <CardHeader><CardTitle>{t('exploreChatGPTPage.interactCard.title')}</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="model-select">{t('exploreChatGPTPage.interactCard.selectModelLabel')}</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isLoading}>
                      <SelectTrigger id="model-select" className="w-full md:w-[280px]"><SelectValue placeholder={t('exploreChatGPTPage.interactCard.selectModelPlaceholder')} /></SelectTrigger>
                      <SelectContent>{modelOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="prompt-input">{t('exploreChatGPTPage.interactCard.promptLabel')}</Label>
                     <Textarea id="prompt-input" placeholder={t('exploreChatGPTPage.interactCard.promptPlaceholder')} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} className="resize-none" disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="file-upload">{t('exploreChatGPTPage.interactCard.fileUploadLabel')}</Label>
                     <div className="flex items-center gap-2">
                        <Input id="file-upload" type="file" accept={allowedFileTypesString} ref={mainFileInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
                        <Button type="button" variant="outline" onClick={() => mainFileInputRef.current?.click()} disabled={isLoading}><Upload className="mr-2 h-4 w-4" /> {t('exploreChatGPTPage.interactCard.chooseFileButton')}</Button>
                        {uploadedFileName && (<><div className="flex items-center gap-2 text-sm p-2 border rounded-md bg-muted"><FileIcon className="h-4 w-4" /><span className="truncate">{uploadedFileName}</span></div><Button type="button" variant="ghost" size="icon" onClick={() => clearUploadedFile()} disabled={isLoading} title={t('exploreChatGPTPage.interactCard.removeFileButtonTitle')}><X className="h-4 w-4" /></Button></>)}
                      </div>
                  </div>
                  <Button type="submit" disabled={isLoading || (!prompt.trim() && !uploadedFile)}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('exploreChatGPTPage.interactCard.generatingButton')}</> : t('exploreChatGPTPage.interactCard.submitButton')}</Button>

                  {showLoginPrompt && (
                    <Alert variant="default" className="mt-4 bg-blue-50 border border-blue-200">
                      <LogIn className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800">{t('exploreChatGPTPage.alerts.authRequired.title')}</AlertTitle>
                      <AlertDescription className="text-blue-700">
                        <Trans i18nKey="exploreChatGPTPage.alerts.authRequired.description">
                          Please{' '}
                          <Link to="/signin" className="font-semibold underline hover:text-blue-800">
                            Sign In
                          </Link>{' '}
                          or{' '}
                          <Link to="/signup" className="font-semibold underline hover:text-blue-800">
                            Sign Up
                          </Link>{' '}
                          to use this feature.
                        </Trans>
                      </AlertDescription>
                    </Alert>
                  )}
                </form>
              </CardContent>
            </Card>
            {error && (<Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>{t('exploreChatGPTPage.alerts.errorTitle')}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            {(responseText || responseImage) && !error && (
              <Card>
                <CardHeader><CardTitle>{t('exploreChatGPTPage.responseCard.title')}</CardTitle></CardHeader>
                <CardContent className="space-y-4 overflow-x-auto">
                  {responseText && (
                    <div className="overflow-x-auto">
                      <div className="prose prose-sm max-w-none text-justify whitespace-pre-wrap min-w-full">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseText}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  {responseImage && (<div><img src={`data:${responseImage.mimeType};base64,${responseImage.data}`} alt="Generated by ChatGPT" className="max-w-full h-auto rounded-md" /></div>)}
                </CardContent>
                {(responseText || responseImage) && !error && !isLoading && (
                  <CardFooter className="flex justify-end p-4 border-t">
                    <Button variant="secondary" onClick={handleExploreClick} className="w-full sm:w-auto">
                      <Sparkles className="mr-2 h-4 w-4" /> {t('exploreChatGPTPage.responseCard.exploreTopicButton')}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            )}
            {history.length > 0 && (
              <div className="mt-10 space-y-6">
                <h2 className="text-2xl font-semibold tracking-tight text-center border-t pt-6">{t('exploreChatGPTPage.history.sectionTitle')}</h2>
                {history.map((thread) => (
                  <Card key={thread.id} className="bg-muted/50 shadow-md">
                    <CardHeader><CardTitle className="text-lg">{t('exploreChatGPTPage.history.threadTitle')}</CardTitle><p className="text-xs text-muted-foreground">{t('exploreChatGPTPage.history.startedLabel')}: {thread.createdAt.toLocaleString()} | {t('exploreChatGPTPage.history.initialModelLabel')}: {modelOptions.find(m => m.value === thread.initialModel)?.label || thread.initialModel}</p></CardHeader>
                    <CardContent className="space-y-4 max-h-[300px] sm:max-h-[400px] md:max-h-[500px] overflow-y-auto pr-4">
                      {thread.messages.map((message) => (
                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 rounded-lg max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background border'}`}>
                            {message.text && (
                              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-justify overflow-x-auto">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                              </div>
                            )}
                            {message.role === 'user' && message.fileName && (
                              <div className="mt-2 flex items-center gap-2 text-xs p-1.5 border rounded-md bg-primary/10 text-primary-foreground/80">
                                <Paperclip className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{message.fileName}</span>
                              </div>
                            )}
                            {message.role === 'model' && message.image && (
                              <div className="mt-2">
                                <img src={`data:${message.image.mimeType};base64,${message.image.data}`} alt="Generated by ChatGPT" className="max-w-full h-auto rounded-md" />
                              </div>
                            )}
                            <p className="text-xs opacity-70 mt-1.5 text-right">{message.timestamp.toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))}
                       {threadLoading[thread.id] && (<div className="flex justify-start"><div className="p-3 rounded-lg bg-background border animate-pulse"><Loader2 className="h-4 w-4 animate-spin" /></div></div>)}
                       {threadErrors[thread.id] && (<Alert variant="destructive" className="mt-2"><Terminal className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{threadErrors[thread.id]}</AlertDescription></Alert>)}
                    </CardContent>
                    <CardFooter className="border-t pt-4 flex flex-col items-end">
                       <div className="flex items-center gap-2 w-full">
                         <Input id={`file-upload-${thread.id}`} type="file" accept={allowedFileTypesString} ref={el => threadFileInputRefs.current[thread.id] = el} onChange={(e) => handleThreadFileChange(thread.id, e)} className="hidden" disabled={threadLoading[thread.id]} />
                         <Button type="button" variant="outline" size="sm" onClick={() => threadFileInputRefs.current[thread.id]?.click()} disabled={threadLoading[thread.id]} className="shrink-0"><Paperclip className="mr-2 h-4 w-4" /> {t('exploreChatGPTPage.interactCard.chooseFileButton')}</Button>
                         {threadFileNames[thread.id] && (<><div className="flex-grow flex items-center gap-2 text-sm p-2 border rounded-md bg-background overflow-hidden"><FileIcon className="h-4 w-4 flex-shrink-0" /><span className="truncate">{threadFileNames[thread.id]}</span></div><Button type="button" variant="ghost" size="icon" onClick={() => clearThreadFile(thread.id)} disabled={threadLoading[thread.id]} title={t('exploreChatGPTPage.interactCard.removeFileButtonTitle')}><X className="h-4 w-4" /></Button></>)}
                       </div>
                       <Textarea placeholder={t('exploreChatGPTPage.history.followUpPlaceholder')} value={threadInputs[thread.id] || ''} onChange={(e) => handleThreadInputChange(thread.id, e.target.value)} rows={2} className="mt-3 resize-none w-full" disabled={threadLoading[thread.id]} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendInThread(thread.id); } }} />
                       <Button onClick={() => handleSendInThread(thread.id)} disabled={threadLoading[thread.id] || (!threadInputs[thread.id]?.trim() && !threadFiles[thread.id])} className="mt-3 w-full sm:w-auto sm:shrink-0">
                         <SendHorizonal className="mr-2 h-4 w-4" /> {t('exploreChatGPTPage.history.sendButton')}
                       </Button>
                    </CardFooter>
                  </Card>
                ))}
                 <div ref={historyEndRef} />
              </div>
            )}
          </>
        )}
        <div className="flex justify-center pt-6">
          <Link to="/tools">
            <Button variant="outline" className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> {t('exploreChatGPTPage.buttons.backToTools')}</Button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default ExploreChatGPT;
