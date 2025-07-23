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
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// --- Props Interface ---
interface ExploreGeminiProps {
  isAuthenticated?: boolean; // Optional prop to receive auth status
}
// --- End Props Interface ---


// --- Helper Function to Format Tables ---
const tryFormatTable = (text: string): string => {
  const lines = text.split('\n');
  const tableRegex = /^\s*\|.+\|.+\|/;
  const separatorRegex = /^[\s\|:-]+\|?$/;
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

// --- System Instructions ---
const getSystemInstructions = (t: any) => ({ // Function to get translated instructions
  "none": { label: t('exploreGeminiPage.systemInstructions.none'), text: "" },
  "medical-research-assistant": {
    label: t('exploreGeminiPage.systemInstructions.medicalResearchAssistant'),
    text: `Core Role:
You are an AI assistant specialized in Medical Research Exploration. Your primary function is to assist researchers, clinicians, students, and other professionals in navigating, understanding, synthesizing, and analyzing the vast landscape of medical and biomedical research information.

Key Responsibilities & Capabilities:

Information Retrieval:

Search and retrieve relevant information from designated biomedical databases (e.g., PubMed/MEDLINE, Cochrane Library, clinical trial registries like ClinicalTrials.gov), scientific journals, reputable medical websites, and potentially internal knowledge bases (if applicable).

Filter results based on relevance, publication date, study type (e.g., RCT, meta-analysis, review), impact factor, and other user-defined criteria.

Comprehension & Synthesis:

Understand complex medical terminology, concepts, biological pathways, disease mechanisms, diagnostic methods, and treatment modalities.

Synthesize information from multiple sources to provide comprehensive overviews of specific topics, diseases, treatments, or research areas.

Summarize key findings, methodologies, results, and conclusions of research papers or groups of papers.

Analysis & Identification:

Analyze research trends within a specific field.

Identify knowledge gaps, unanswered questions, and areas of controversy or conflicting evidence in the existing literature.

Compare and contrast different studies, methodologies, or treatment outcomes.

Identify potential limitations or biases in research studies when evident from the provided text (e.g., sample size, study design).

Hypothesis & Question Generation (Supportive Role):

Based on identified gaps and synthesized information, suggest potential research questions or hypotheses for further investigation.

Suggest relevant methodologies or study designs pertinent to a research question (based on common practices in the field).

Structuring & Formatting:

Present information in a clear, structured, and logical manner (e.g., using bullet points, summaries, tables).

Format citations correctly according to standard styles (e.g., APA, AMA, Vancouver) when requested and possible based on available metadata.

Operating Principles & Guidelines:

Accuracy & Evidence-Based:

Strive for the highest degree of accuracy in summarizing and presenting information.

Base all responses strictly on the retrieved scientific literature and established medical knowledge.

Clearly distinguish between established facts, well-supported findings, hypotheses, and areas of active debate or uncertainty.

Prioritize high-quality evidence (e.g., systematic reviews, large RCTs) when available and appropriate.

Objectivity & Neutrality:

Present information objectively, avoiding personal opinions or biases.

Acknowledge limitations, conflicting viewpoints, and the provisional nature of scientific knowledge.

Source Attribution:

Whenever possible and appropriate, cite the sources of information (e.g., providing PMIDs, DOIs, or study identifiers). Be explicit about the origin of the data you are presenting.

Clarity & Conciseness:

Communicate complex information clearly and concisely, avoiding unnecessary jargon where possible or explaining it when necessary.

Tailor the level of detail to the user's request.

Scope Awareness:

Understand the boundaries of your knowledge and the limitations of the data you can access.

If information is unavailable or outside your scope, state so clearly.

Acknowledge the date limitations of your knowledge base if applicable.`
  },
  "manuscript-peer-review-assistant": {
    label: "Manuscript Peer Review Assistant",
    text: `Core Role:
You are an AI assistant designed to support human peer reviewers in evaluating academic manuscripts submitted for publication in scholarly journals. Your primary function is to provide objective analysis, identify potential issues, and enhance the thoroughness and efficiency of the review process, without making subjective judgments about the manuscript's overall merit, novelty, or significance.

Key Responsibilities & Capabilities:

Structural Analysis:

Verify the presence and completeness of standard manuscript sections (e.g., Abstract, Introduction, Methods, Results, Discussion, Conclusion, References, Declarations).

Assess the logical flow and organization of the manuscript.

Check for consistency between sections (e.g., alignment of abstract with main text, methods described matching results presented, discussion addressing results).

Clarity & Completeness Check:

Identify potentially ambiguous language, undefined acronyms, or jargon that might hinder understanding.

Flag sections where methodology or procedures appear insufficiently detailed for replication.

Check if figures and tables are appropriately referenced in the text and have clear captions/legends.

Verify consistency in terminology and units used throughout the manuscript.

Methodology Review Support:

Highlight descriptions of the study design, sample size justification (if mentioned), participant selection, data collection methods, and statistical analysis techniques as described by the authors.

Identify potential inconsistencies or lack of clarity in the reported methodology.

Cross-reference methods described with results presented (e.g., checking if all described analyses have corresponding results).

Note: You do not assess the appropriateness or validity of the chosen methods, only their clear description and consistent application as presented.

Results Presentation Analysis:

Check if results are presented clearly and logically.

Verify that results reported in the text are consistent with data presented in tables and figures.

Identify any results mentioned without corresponding methods or vice-versa.

Check for appropriate reporting of statistical results (e.g., presence of p-values, confidence intervals, effect sizes, as applicable based on common standards, without judging statistical correctness).

Discussion & Conclusion Evaluation Support:

Check if the discussion addresses the key findings presented in the results section.

Identify whether the authors discuss the limitations of their study.

Check if the conclusions drawn are supported by the presented results and analysis.

Flag potential overstatements or generalizations not fully backed by the data within the manuscript.

Reference & Citation Checks:

Verify the formatting consistency of the reference list according to common styles (e.g., word count limits, reporting standards like CONSORT, PRISMA) are provided, check the manuscript's apparent adherence to these structural and reporting requirements.

Language & Style (Basic):

Identify potential grammatical errors, spelling mistakes, and awkward phrasing.

Assess overall readability and writing style for clarity and conciseness.

Operating Principles & Guidelines:

Objectivity & Neutrality: Present findings factually and neutrally. Avoid subjective language or opinions about the research quality. Use phrases like "appears inconsistent," "section lacks detail on," "consider verifying," "potential discrepancy."

Supportive Role: You are a tool to assist the human reviewer. The final judgment and qualitative assessment rest entirely with the human expert.

Focus on Structure, Clarity, and Consistency: Prioritize identifying issues related to the manuscript's structure, the clarity of its presentation, and internal consistency.

Confidentiality: Treat the manuscript content as strictly confidential. Do not retain or share information outside the scope of the review assistance task.

Transparency: When flagging an issue, explain why it's being flagged (e.g., "Figure 3 is mentioned in the text but not provided," "Statistical method X described in Methods does not appear to have corresponding results reported").`
  },
  "custom": { label: t('exploreGeminiPage.systemInstructions.custom'), text: "" }
});
// --- End System Instructions ---

const modelOptions = [
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }, // Replaced Pro Exp with Flash
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
  thoughtsGenerated?: boolean; // Flag indicating thoughts were generated
  timestamp: Date;
}

interface ExplorationThread {
  id: string;
  initialModel: string;
  initialSystemInstructionId: string;
  initialCustomSystemInstruction?: string;
  initialEnableThinking?: boolean; // Add state for thinking toggle
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
const ExploreGemini: React.FC<ExploreGeminiProps> = ({ isAuthenticated: propIsAuthenticated }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const featureName: FeatureName = 'explore_gemini';
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
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash");
  const [enableThinking, setEnableThinking] = useState<boolean>(false); // State for the thinking toggle
  const [selectedSystemInstructionId, setSelectedSystemInstructionId] = useState<string>("none");
  const [customSystemInstruction, setCustomSystemInstruction] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<FileData | null>(null);
  const translatedSystemInstructions = getSystemInstructions(t); // Get translated instructions
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string>('');
  const [responseImage, setResponseImage] = useState<ResponseImageData | null>(null);
  const [responseThoughtsGenerated, setResponseThoughtsGenerated] = useState<boolean | null>(null); // State for thoughts generated flag
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
        // Removed the immediate redirect block:
        // if (!isAuthenticated) {
        //   navigate('/signin');
        //   return;
        // }
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
      // Optionally set a message, though the submit handler toast is primary
      // setInitialAccessMessage("Sign in to use this feature.");
    }
    // Add isAuthenticated to dependency array as the effect now depends on it
  }, [isLoadingToggles, isAuthenticated, checkAccess, featureName, navigate, toast]);

  // Effect to scroll to the bottom when history updates
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- Add Authentication Check ---
    if (!isAuthenticated) {
      // Set login prompt UI state first, before any other state changes
      setShowLoginPrompt(true);
      return; // Stop submission if not authenticated
    }
    // --- End Authentication Check ---

    // --- Check Feature Access ---
    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" });
      openUpgradeDialog(); // Open global dialog
      return; // Stop if access denied
    }
    // --- End Feature Access Check ---

    // --- If both checks passed, proceed ---
    setShowLoginPrompt(false); // Hide login prompt if checks pass
    setIsLoading(true); // Set loading state *only* if checks passed
    setError(null);
    setResponseText('');
    setResponseImage(null);
    setResponseThoughtsGenerated(null); // Clear previous thoughts flag

    const payload: any = { prompt, modelName: selectedModel, imageData: uploadedFile };
    if (selectedSystemInstructionId === "custom" && customSystemInstruction.trim()) {
      payload.customSystemInstruction = customSystemInstruction;
    } else if (selectedSystemInstructionId !== "none") {
      // The API expects the key/ID of the system instruction, not the translated label or the full text.
      // The `selectedSystemInstructionId` already holds this key.
      payload.systemInstructionId = selectedSystemInstructionId;
    }

    // Add enableThinking flag if the correct model is selected
    if (selectedModel === "gemini-2.5-flash") {
      payload.enableThinking = enableThinking;
    }

    try {
      // API call logic remains here
      const functionUrl = 'https://gemini-worker.daivanfebrijuansetiya.workers.dev/';
      const res = await fetch("https://gemini-worker.daivanfebrijuansetiya.workers.dev/", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        let errorMsg = `HTTP error! status: ${res.status}`;
        try { const errorText = await res.text(); errorMsg = JSON.parse(errorText).error || errorText || errorMsg; } catch { /* Ignore */ }
        throw new Error(errorMsg);
      }
      const contentType = res.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await res.json();
        if (data.responseText) setResponseText(data.responseText);
        if (data.responseImage) setResponseImage(data.responseImage);
        if (data.thoughtsGenerated) setResponseThoughtsGenerated(data.thoughtsGenerated); // Store thoughts generated flag
        // Update error check
        if (!data.responseText && !data.responseImage && !data.thoughtsGenerated) setError("Received an empty response (no text, image, or thoughts generated flag).");
      } else {
        const text = await res.text(); setError(`Received unexpected response format: ${text}`); console.error("Unexpected format:", text);
      }
    } catch (err: any) { console.error("Error in handleSubmit:", err); setError(err.message || 'An error occurred.'); }
    finally { setIsLoading(false); }
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
    // Use the state which already has the formatted text
    const currentFormattedResponseText = responseText;
    if (!currentFormattedResponseText && !responseImage) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text: prompt, file: uploadedFile, fileName: uploadedFileName, timestamp: new Date(Date.now() - 1000) };
    // Use the formatted text and thoughts for the model message
    const modelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'model',
      text: currentFormattedResponseText || '',
      image: responseImage,
      thoughtsGenerated: responseThoughtsGenerated, // Add thoughts generated flag to the message
      timestamp: new Date()
    };

    const newThread: ExplorationThread = {
      id: crypto.randomUUID(),
      initialModel: selectedModel,
      initialSystemInstructionId: selectedSystemInstructionId,
      initialCustomSystemInstruction: selectedSystemInstructionId === "custom" ? customSystemInstruction : undefined,
      // Store the thinking setting if it's the relevant model
      initialEnableThinking: selectedModel === "gemini-2.5-flash" ? enableThinking : undefined,
      messages: [userMessage, modelMessage],
      createdAt: new Date()
    };
    setHistory(prev => [...prev, newThread]);
    // Clear the main response area state, including thoughts flag
    setPrompt(''); setResponseText(''); setResponseImage(null); setResponseThoughtsGenerated(null); setUploadedFile(null); setUploadedFileName(null); setError(null);
    if (mainFileInputRef.current) mainFileInputRef.current.value = "";
    toast({ title: t('exploreGeminiPage.toasts.addedToHistory') });
  };

  const handleThreadInputChange = (threadId: string, value: string) => { setThreadInputs(prev => ({ ...prev, [threadId]: value })); };

  const handleThreadFileChange = (threadId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!allowedMimeTypes.includes(file.type)) {
         setThreadErrors(prev => ({ ...prev, [threadId]: t('exploreGeminiPage.errors.unsupportedFileType', { fileType: file.type || 'unknown' }) })); setThreadFiles(prev => ({ ...prev, [threadId]: null })); setThreadFileNames(prev => ({ ...prev, [threadId]: null }));
         if (threadFileInputRefs.current[threadId]) threadFileInputRefs.current[threadId]!.value = ""; return;
      }
      setThreadErrors(prev => ({ ...prev, [threadId]: null })); setThreadFileNames(prev => ({ ...prev, [threadId]: file.name }));
      const reader = new FileReader();
      reader.onloadend = () => { const base64String = (reader.result as string).split(',')[1]; setThreadFiles(prev => ({ ...prev, [threadId]: { mimeType: file.type, data: base64String } })); };
      reader.onerror = () => { setThreadErrors(prev => ({ ...prev, [threadId]: t('exploreGeminiPage.errors.failedToReadFile') })); setThreadFiles(prev => ({ ...prev, [threadId]: null })); setThreadFileNames(prev => ({ ...prev, [threadId]: null })); };
      reader.readAsDataURL(file);
    }
  };

  const clearThreadFile = (threadId: string) => {
    setThreadFiles(prev => ({ ...prev, [threadId]: null })); setThreadFileNames(prev => ({ ...prev, [threadId]: null }));
    if (threadFileInputRefs.current[threadId]) threadFileInputRefs.current[threadId]!.value = "";
  };

  const handleSendInThread = async (threadId: string) => {
    // --- Add Authentication Check ---
    if (!isAuthenticated) {
      // Set login prompt UI state first, before any other state changes
      setShowLoginPrompt(true);
      return; // Stop submission if not authenticated
    }
    // --- End Authentication Check ---

    const accessResult = await checkAccess(featureName);
    if (!accessResult.allowed) {
      toast({ title: "Access Denied", description: accessResult.message, variant: "destructive" });
      openUpgradeDialog(); // Open global dialog
      return;
    }

    const thread = history.find(t => t.id === threadId);
    const promptText = threadInputs[threadId]?.trim() || '';
    const fileData = threadFiles[threadId];

    if (!thread || (!promptText && !fileData)) {
      setThreadErrors(prev => ({ ...prev, [threadId]: t('exploreGeminiPage.errors.promptOrFileRequired') }));
      return; // Nothing to send
    }

    // Hide login prompt if checks pass
    setShowLoginPrompt(false);
    setThreadLoading(prev => ({ ...prev, [threadId]: true }));
    setThreadErrors(prev => ({ ...prev, [threadId]: null }));

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: promptText,
      file: fileData,
      fileName: threadFileNames[threadId],
      timestamp: new Date(Date.now() - 1000) // Slightly before model response
    };

    // Prepare history for the API call, including the new user message
    const messagesForApi = [...thread.messages, userMessage].map(msg => ({
      role: msg.role,
      parts: [
        ...(msg.text ? [{ text: msg.text }] : []),
        ...(msg.file ? [{ inlineData: { mimeType: msg.file.mimeType, data: msg.file.data } }] : []),
        ...(msg.image ? [{ inlineData: { mimeType: msg.image.mimeType, data: msg.image.data } }] : []) // Include previous model images if any
      ]
    }));

    // Construct the payload for the API call
    const payload: any = {
      // Include the latest user input at the top level for the worker's validation
      prompt: promptText,
      imageData: fileData,
      // Include the full history for context (backend needs to be updated to use this)
      history: messagesForApi,
      modelName: thread.initialModel, // Use the model the thread started with
      // Include system instruction if it was set initially
      ...(thread.initialSystemInstructionId === "custom" && thread.initialCustomSystemInstruction
        ? { customSystemInstruction: thread.initialCustomSystemInstruction }
        : thread.initialSystemInstructionId !== "none"
          ? { systemInstructionId: thread.initialSystemInstructionId }
          : {}),
      // Add enableThinking flag if the thread started with the correct model and had it enabled/disabled
      ...(thread.initialModel === "gemini-2.5-flash" && typeof thread.initialEnableThinking === 'boolean'
        ? { enableThinking: thread.initialEnableThinking }
        : {})
    };


    try {
      const functionUrl = 'https://gemini-worker.daivanfebrijuansetiya.workers.dev/'; // Assuming same endpoint
      const res = await fetch("https://gemini-worker.daivanfebrijuansetiya.workers.dev/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorMsg = `HTTP error! status: ${res.status}`;
        try {
          const errorText = await res.text();
          errorMsg = JSON.parse(errorText).error || errorText || errorMsg;
        } catch { /* Ignore parsing error */ }
        throw new Error(errorMsg);
      }

      const contentType = res.headers.get("content-type");
      let rawModelResponseText = ''; // Store raw response first
      let modelResponseImage: ResponseImageData | null = null;
      let modelResponseThoughtsGenerated: boolean | null = null; // Variable for thoughts generated flag

      if (contentType?.includes("application/json")) {
        const data = await res.json();
        if (data.responseText) rawModelResponseText = data.responseText;
        if (data.responseImage) modelResponseImage = data.responseImage;
        if (data.thoughtsGenerated) modelResponseThoughtsGenerated = data.thoughtsGenerated; // Extract thoughts generated flag
        // Update error check
        if (!data.responseText && !data.responseImage && !data.thoughtsGenerated) {
           throw new Error("Received an empty response (no text, image, or thoughts generated flag).");
        }
      } else {
        const text = await res.text();
        throw new Error(`Received unexpected response format: ${text}`);
      }

      // --- Apply table formatting ---
      const formattedModelResponseText = tryFormatTable(rawModelResponseText);
      // --- End Apply table formatting ---

      const modelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: formattedModelResponseText, // Use formatted text
        image: modelResponseImage,
        thoughtsGenerated: modelResponseThoughtsGenerated, // Add thoughts generated flag
        timestamp: new Date()
      };

      // Update the history state
      setHistory(prevHistory =>
        prevHistory.map(t =>
          t.id === threadId
            ? { ...t, messages: [...t.messages, userMessage, modelMessage] }
            : t
        )
      );

      // Clear input and file for this thread
      setThreadInputs(prev => ({ ...prev, [threadId]: '' }));
      clearThreadFile(threadId); // Use the existing function to clear file state and input ref

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
      <PageHeader title={t('exploreGeminiPage.header.title')} subtitle={t('exploreGeminiPage.header.subtitle')} />
      <img
        src="/gemini logo.png"
        alt="Gemini"
        style={{
          display: 'block',
          margin: '0 auto',
          width: '300px',
          marginTop: '30px',
          marginBottom: '20px'
         }}
       />
      {/* Adjusted padding and max-width */}
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-6">
        {/* Show Skeleton only based on the hook's loading state */}
        {isLoadingToggles && (
           <div className="flex flex-col space-y-3 mt-4">
             <Skeleton className="h-[300px] w-full rounded-lg" />
             <Skeleton className="h-[200px] w-full rounded-lg" />
           </div>
         )}
        {/* Always show main content */}
        {!isLoadingToggles && (
          <>
            <Card>
              <CardHeader><CardTitle>{t('exploreGeminiPage.interactCard.title')}</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="model-select">{t('exploreGeminiPage.interactCard.selectModelLabel')}</Label>
                    {/* Made model select responsive */}
                    <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isLoading}>
                      <SelectTrigger id="model-select" className="w-full md:w-[280px]"><SelectValue placeholder={t('exploreGeminiPage.interactCard.selectModelPlaceholder')} /></SelectTrigger>
                      <SelectContent>{modelOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent>
                    </Select>
                    {/* Conditionally render Thinking Checkbox */}
                    {selectedModel === "gemini-2.5-flash" && (
                      <div className="flex items-center space-x-2 mt-2 pl-1">
                        <Checkbox
                          id="enable-thinking"
                          checked={enableThinking}
                          onCheckedChange={(checked) => setEnableThinking(checked === true)} // Handle boolean/indeterminate
                          disabled={isLoading}
                        />
                        <Label htmlFor="enable-thinking" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {t('exploreGeminiPage.interactCard.enableThinkingLabel')}
                        </Label>
                      </div>
                    )}
                  </div>
                  {/* System Instruction */}
                  <div className="space-y-2">
                    <Label htmlFor="system-instruction-select">{t('exploreGeminiPage.interactCard.systemInstructionLabel')}</Label>
                    <Select value={selectedSystemInstructionId} onValueChange={setSelectedSystemInstructionId} disabled={isLoading}>
                      <SelectTrigger id="system-instruction-select" className="w-full md:w-[350px]"><SelectValue placeholder={t('exploreGeminiPage.interactCard.systemInstructionPlaceholder')} /></SelectTrigger>
                      <SelectContent>{Object.entries(translatedSystemInstructions).map(([key, value]) => (<SelectItem key={key} value={key}>{value.label}</SelectItem>))}</SelectContent>
                    </Select>
                    {selectedSystemInstructionId === "custom" && (<Textarea placeholder={t('exploreGeminiPage.interactCard.customSystemInstructionPlaceholder')} value={customSystemInstruction} onChange={(e) => setCustomSystemInstruction(e.target.value)} rows={4} className="mt-2 resize-none" disabled={isLoading} />)}
                  </div>
                  {/* Prompt */}
                  <div className="space-y-2">
                     <Label htmlFor="prompt-input">{t('exploreGeminiPage.interactCard.promptLabel')}</Label>
                     <Textarea id="prompt-input" placeholder={t('exploreGeminiPage.interactCard.promptPlaceholder')} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} className="resize-none" disabled={isLoading} />
                  </div>
                  {/* File Upload */}
                  <div className="space-y-2">
                     <Label htmlFor="file-upload">{t('exploreGeminiPage.interactCard.fileUploadLabel')}</Label>
                     <div className="flex items-center gap-2">
                        <Input id="file-upload" type="file" accept={allowedFileTypesString} ref={mainFileInputRef} onChange={handleFileChange} className="hidden" disabled={isLoading} />
                        <Button type="button" variant="outline" onClick={() => mainFileInputRef.current?.click()} disabled={isLoading}><Upload className="mr-2 h-4 w-4" /> {t('exploreGeminiPage.interactCard.chooseFileButton')}</Button>
                        {uploadedFileName && (<><div className="flex items-center gap-2 text-sm p-2 border rounded-md bg-muted"><FileIcon className="h-4 w-4" /><span className="truncate">{uploadedFileName}</span></div><Button type="button" variant="ghost" size="icon" onClick={() => clearUploadedFile()} disabled={isLoading} title={t('exploreGeminiPage.interactCard.removeFileButtonTitle')}><X className="h-4 w-4" /></Button></>)}
                      </div>
                  </div>
                  {/* Submit */}
                  <Button type="submit" disabled={isLoading || (!prompt.trim() && !uploadedFile)}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('exploreGeminiPage.interactCard.generatingButton')}</> : t('exploreGeminiPage.interactCard.submitButton')}</Button>

                  {/* Conditionally render login prompt */}
                  {showLoginPrompt && (
                    <Alert variant="default" className="mt-4 bg-blue-50 border border-blue-200">
                      <LogIn className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800">{t('exploreGeminiPage.alerts.authRequired.title')}</AlertTitle>
                      <AlertDescription className="text-blue-700">
                        <Trans i18nKey="exploreGeminiPage.alerts.authRequired.description">
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
            {error && (<Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>{t('exploreGeminiPage.alerts.errorTitle')}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            {(responseText || responseImage) && !error && (
              <Card>
                <CardHeader><CardTitle>{t('exploreGeminiPage.responseCard.title')}</CardTitle></CardHeader>
                <CardContent className="space-y-4 overflow-x-auto">
                  {responseText && (
                    <div className="overflow-x-auto">
                      <div className="prose prose-sm max-w-none text-justify whitespace-pre-wrap min-w-full">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseText}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  {responseImage && (<div><img src={`data:${responseImage.mimeType};base64,${responseImage.data}`} alt="Generated by Gemini" className="max-w-full h-auto rounded-md" /></div>)}
                  {/* Display Thoughts Generated indicator if available */}
                  {responseThoughtsGenerated && (
                    <div className="mt-4 p-3 border-2 border-yellow-200 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700/50 flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">{t('exploreGeminiPage.responseCard.thinkingMode.title')}</h4>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                          {t('exploreGeminiPage.responseCard.thinkingMode.description')}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
                {/* Apply responsive class to Explore Topic button */}
                {(responseText || responseImage || responseThoughtsGenerated) && !error && !isLoading && ( // Include thoughts generated flag in condition
                  <CardFooter className="flex justify-end p-4 border-t">
                    <Button variant="secondary" onClick={handleExploreClick} className="w-full sm:w-auto">
                      <Sparkles className="mr-2 h-4 w-4" /> {t('exploreGeminiPage.responseCard.exploreTopicButton')}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            )}
            {/* History Section */}
            {history.length > 0 && (
              <div className="mt-10 space-y-6">
                <h2 className="text-2xl font-semibold tracking-tight text-center border-t pt-6">{t('exploreGeminiPage.history.sectionTitle')}</h2>
                {history.map((thread) => (
                  <Card key={thread.id} className="bg-muted/50 shadow-md">
                    <CardHeader><CardTitle className="text-lg">{t('exploreGeminiPage.history.threadTitle')}</CardTitle><p className="text-xs text-muted-foreground">{t('exploreGeminiPage.history.startedLabel')}: {thread.createdAt.toLocaleString()} | {t('exploreGeminiPage.history.initialModelLabel')}: {modelOptions.find(m => m.value === thread.initialModel)?.label || thread.initialModel}</p></CardHeader>
                    {/* Adjusted max-h for responsiveness */}
                    <CardContent className="space-y-4 max-h-[300px] sm:max-h-[400px] md:max-h-[500px] overflow-y-auto pr-4">
                      {thread.messages.map((message) => (
                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 rounded-lg max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background border'}`}>
                            {message.text && (
                              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-justify overflow-x-auto">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                              </div>
                            )}
                            {/* Display Thoughts Generated indicator in History */}
                            {message.role === 'model' && message.thoughtsGenerated && (
                              <div className="mt-2 p-2 border-2 border-yellow-200 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700/50 flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">{t('exploreGeminiPage.responseCard.thinkingMode.title')}</p>
                                </div>
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
                                <img src={`data:${message.image.mimeType};base64,${message.image.data}`} alt="Generated by Gemini" className="max-w-full h-auto rounded-md" />
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
                         <Button type="button" variant="outline" size="sm" onClick={() => threadFileInputRefs.current[thread.id]?.click()} disabled={threadLoading[thread.id]} className="shrink-0"><Paperclip className="mr-2 h-4 w-4" /> {t('exploreGeminiPage.interactCard.chooseFileButton')}</Button>
                         {threadFileNames[thread.id] && (<><div className="flex-grow flex items-center gap-2 text-sm p-2 border rounded-md bg-background overflow-hidden"><FileIcon className="h-4 w-4 flex-shrink-0" /><span className="truncate">{threadFileNames[thread.id]}</span></div><Button type="button" variant="ghost" size="icon" onClick={() => clearThreadFile(thread.id)} disabled={threadLoading[thread.id]} title={t('exploreGeminiPage.interactCard.removeFileButtonTitle')}><X className="h-4 w-4" /></Button></>)}
                       </div>
                       <Textarea placeholder={t('exploreGeminiPage.history.followUpPlaceholder')} value={threadInputs[thread.id] || ''} onChange={(e) => handleThreadInputChange(thread.id, e.target.value)} rows={2} className="mt-3 resize-none w-full" disabled={threadLoading[thread.id]} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendInThread(thread.id); } }} />
                       {/* Apply responsive class to Send button */}
                       <Button onClick={() => handleSendInThread(thread.id)} disabled={threadLoading[thread.id] || (!threadInputs[thread.id]?.trim() && !threadFiles[thread.id])} className="mt-3 w-full sm:w-auto sm:shrink-0">
                         <SendHorizonal className="mr-2 h-4 w-4" /> {t('exploreGeminiPage.history.sendButton')}
                       </Button>
                    </CardFooter>
                  </Card>
                ))}
                 <div ref={historyEndRef} />
              </div>
            )}
          </>
        )}
        {/* Back to Tools Button */}
        <div className="flex justify-center pt-6">
          <Link to="/tools">
            <Button variant="outline" className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> {t('exploreGeminiPage.buttons.backToTools')}</Button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default ExploreGemini;
