import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import i18n from '@/i18n'; // Import i18n instance
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MindMapCanvas from '@/components/MindMapCanvas';
import { Node, Edge, Position } from 'reactflow';
import dagre from 'dagre';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { ArrowLeft, Terminal, Loader2 } from 'lucide-react'; // Added Terminal, Loader2
import { useFeatureAccess } from '@/hooks/useFeatureAccess'; // Import hook
import { FeatureName } from '@/lib/quotas'; // Import FeatureName from quotas.ts
import { useAuth } from '@/contexts/AuthContext'; // Added Auth context
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Import Custom Nodes
import RootNode from '@/components/mindmap/RootNode';
import SubTopicNode from '@/components/mindmap/SubTopicNode';

// Define the expected response structure from the worker
interface WorkerResponse {
  summary: string;
  mindMap: { nodes: Node[]; edges: Edge[] };
}

// Define type for layout direction
type LayoutDirection = 'TB' | 'LR';

// --- Helper Function to Assign Node Types ---
const assignNodeTypes = (nodes: Node[], edges: Edge[]): Node[] => {
  const nodesWithTypes: Node[] = [];
  const childrenOfRoot = new Set<string>();
  edges.forEach(edge => { if (edge.source === 'root') childrenOfRoot.add(edge.target); });
  nodes.forEach(node => {
    let type = 'default';
    if (node.id === 'root') type = 'rootNode';
    else if (childrenOfRoot.has(node.id)) type = 'subTopicNode';
    nodesWithTypes.push({ ...node, type });
  });
  return nodesWithTypes;
};

// --- Dagre Layouting Function ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 172;
const nodeHeight = 40;
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction: LayoutDirection = 'TB') => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((node) => g.setNode(node.id, { label: node.data.label, width: nodeWidth, height: nodeHeight }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  dagre.layout(g);
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    const newNode = { ...node };
    if (nodeWithPosition) {
      newNode.position = { x: nodeWithPosition.x - (g.node(node.id).width / 2), y: nodeWithPosition.y - (g.node(node.id).height / 2) };
    } else {
      console.warn(`Node ${node.id} not found in layout graph.`); newNode.position = { x: 0, y: 0 };
    }
    const isHorizontal = direction === 'LR';
    newNode.targetPosition = isHorizontal ? Position.Left : Position.Top;
    newNode.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    return newNode;
  });
  return { nodes: layoutedNodes, edges: [...edges] };
};

const MindMapMaker: React.FC = () => {
  const featureName: FeatureName = 'mind_map_maker';
  const { checkAccess, incrementUsage, isLoadingToggles } = useFeatureAccess();
  const { toast } = useToast();
  const { openUpgradeDialog } = useAuth(); // Get the dialog function
  const { t } = useTranslation(); // Initialize useTranslation

  // State for access check result
  const [isInitiallyLocked, setIsInitiallyLocked] = useState(false); // Track if locked on load

  // Component state
  const [topic, setTopic] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [originalMindMapData, setOriginalMindMapData] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [layoutedMindMapData, setLayoutedMindMapData] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCounter, setNodeCounter] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [dialogInputValue, setDialogInputValue] = useState('');
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('TB');
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);

  const nodeTypes = useMemo(() => ({ rootNode: RootNode, subTopicNode: SubTopicNode }), []);

  useEffect(() => {
    if (originalMindMapData) {
      const nodesWithTypes = assignNodeTypes(originalMindMapData.nodes, originalMindMapData.edges);
      const newLayout = getLayoutedElements(nodesWithTypes, originalMindMapData.edges, layoutDirection);
      setLayoutedMindMapData(newLayout);
    } else {
      setLayoutedMindMapData(null);
    }
  }, [originalMindMapData, layoutDirection]);

  // Initial access check on mount
  useEffect(() => {
    if (!isLoadingToggles) {
      const verifyInitialAccess = async () => {
        try {
          const result = await checkAccess(featureName);
           if (!result.allowed) {
             setIsInitiallyLocked(true);
           } else {
             setIsInitiallyLocked(false);
           }
         } catch (error) {
           console.error("Error checking initial feature access:", error);
           setIsInitiallyLocked(true);
           toast({
             title: t('drugRef.toastErrorTitle'),
             description: t('drugRef.toastAccessCheckError'),
             variant: "destructive",
           });
         }
      };
      verifyInitialAccess();
    }
  }, [isLoadingToggles, checkAccess, featureName, toast]); // Added dependencies

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setEditingNodeId(node.id);
    setDialogInputValue(node.data.label);
    setIsEditDialogOpen(true);
  }, []);

  const handleSaveLabel = () => {
    if (!editingNodeId || !dialogInputValue.trim()) return;
    const updateNodes = (nodes: Node[]) =>
      nodes.map((n) => {
        if (n.id === editingNodeId) {
          return { ...n, data: { ...n.data, label: dialogInputValue.trim() } };
        }
        return n;
      });
    setOriginalMindMapData((prev) => prev ? { ...prev, nodes: updateNodes(prev.nodes) } : null);
    setIsEditDialogOpen(false);
    setEditingNodeId(null);
    setDialogInputValue('');
  };

  const handleAddNode = () => {
    const newNodeLabel = window.prompt(t('mindMapMakerPage.promptNewLabel'));
    if (newNodeLabel !== null && newNodeLabel.trim() !== '') {
      const newNodeId = `manual-node-${nodeCounter}`;
      setNodeCounter(nodeCounter + 1);
      const newNode: Node = {
        id: newNodeId,
        position: { x: 0, y: 0 },
        data: { label: newNodeLabel.trim() },
        type: 'default',
      };
      setOriginalMindMapData((prevData) => {
        const nodes = prevData ? [...prevData.nodes, newNode] : [newNode];
        const edges = prevData ? prevData.edges : [];
        return { nodes, edges };
      });
    }
  };

  const handleGenerate = async () => {
     if (!topic.trim()) {
      setError(t('mindMapMakerPage.errorEnterTopic'));
      return;
    }

     const accessResult = await checkAccess(featureName);
     if (!accessResult.allowed) {
       toast({
         title: t('drugRef.toastAccessDeniedTitle'),
         description: accessResult.message || t('mindMapMakerPage.toastCannotCreateMap'),
         variant: "destructive",
       });
       openUpgradeDialog();
       return;
    }

    setIsLoading(true);
    setError(null);
    setOriginalMindMapData(null);
    setSummary(null);

    try {
      const currentLanguage = i18n.language; // Get current language
      const workerUrl = 'https://mindmap-generator-worker.daivanfebrijuansetiya.workers.dev';
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, language: currentLanguage }), // Add language to request
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText || 'Failed to fetch'}`);
      }
      const data: WorkerResponse = await response.json();
      if (!data || typeof data.summary !== 'string' || typeof data.mindMap !== 'object' || !Array.isArray(data.mindMap.nodes) || !Array.isArray(data.mindMap.edges)) {
        console.error("Invalid response structure:", data);
        throw new Error(t('mindMapMakerPage.toastInvalidDataError'));
      }
      const nodesWithTypes = assignNodeTypes(data.mindMap.nodes, data.mindMap.edges);
      setSummary(data.summary);
      setOriginalMindMapData({ nodes: nodesWithTypes, edges: data.mindMap.edges });
    } catch (err: any) {
      console.error('Error generating mind map:', err);
      setError(err.message || t('mindMapMakerPage.toastGenericGenerationError'));
    } finally {
      setIsLoading(false);
    }

    await incrementUsage(featureName);
    if (accessResult.remaining !== null) {
      const remainingAfterIncrement = accessResult.remaining - 1;
      const displayRemaining = Math.max(0, remainingAfterIncrement);
      toast({
        title: t('mindMapMakerPage.toastUsageRecordedTitle'),
        description: t('mindMapMakerPage.toastUsageRecordedDescription', { count: displayRemaining }),
      });
      if (displayRemaining <= 0) {
        setIsInitiallyLocked(true);
      }
    }
  };

  return (
    <>
      <PageHeader
        title={t('toolsPage.aiMindMapGenerator.title')}
        subtitle={t('toolsPage.aiMindMapGenerator.description')}
      />
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        {isLoadingToggles && (
           <div className="flex flex-col space-y-3 mt-4">
             <Skeleton className="h-[50px] w-full rounded-lg" />
             <Skeleton className="h-[600px] w-full rounded-lg" />
           </div>
         )}

        {!isLoadingToggles && (
          <>
            <Card>
              <CardContent className="mt-6">
                <div className="flex flex-col sm:flex-row gap-2 mb-4 items-center flex-wrap">
                  <Input type="text" placeholder={t('mindMapMakerPage.topicInputPlaceholder')} value={topic} onChange={(e) => setTopic(e.target.value)} disabled={isLoading} className="flex-grow min-w-[200px]" />
                  <Button onClick={handleGenerate} disabled={isLoading} className="whitespace-nowrap">{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('mindMapMakerPage.generatingButton')}</> : t('mindMapMakerPage.generateButton')}</Button>
                  <Button onClick={handleAddNode} variant="outline" className="whitespace-nowrap" disabled={isLoading}>{t('mindMapMakerPage.addNodeButton')}</Button>
                  <div className="flex items-center gap-2 ml-auto">
                    <Label htmlFor="layout-direction" className="whitespace-nowrap">{t('mindMapMakerPage.layoutLabel')}</Label>
                    <Select value={layoutDirection} onValueChange={(value: LayoutDirection) => setLayoutDirection(value)} disabled={!originalMindMapData || isLoading}>
                      <SelectTrigger id="layout-direction" className="w-[150px]"><SelectValue placeholder={t('mindMapMakerPage.layoutSelectPlaceholder')} /></SelectTrigger>
                      <SelectContent><SelectItem value="TB">{t('mindMapMakerPage.layoutTb')}</SelectItem><SelectItem value="LR">{t('mindMapMakerPage.layoutLr')}</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                {isLoading && !summary && <div className="text-center p-4 text-muted-foreground">{t('mindMapMakerPage.loadingSummaryAndMap')}</div>}
                {!isLoading && summary && (
                  <div className="mb-6 p-4 border rounded-md bg-background shadow-sm">
                    <h3 className="text-lg font-semibold mb-2 text-primary">{t('mindMapMakerPage.aiSummaryTitle')}</h3>
                    <div className="prose prose-sm max-w-none text-foreground text-justify"><ReactMarkdown>{summary}</ReactMarkdown></div>
                  </div>
                )}
                {/* Adjusted height for responsiveness */}
                <div className="mt-4 h-[400px] sm:h-[500px] md:h-[600px] border rounded-md">
                  {!isLoading && !layoutedMindMapData && !summary && <div className="flex items-center justify-center h-full text-muted-foreground">{t('mindMapMakerPage.emptyStatePrompt')}</div>}
                  {!isLoading && layoutedMindMapData && (
                    <MindMapCanvas key={layoutDirection} initialNodes={layoutedMindMapData.nodes} initialEdges={layoutedMindMapData.edges} onNodeDoubleClick={handleNodeDoubleClick} nodeTypes={nodeTypes} />
                  )}
                  {!isLoading && summary && !layoutedMindMapData && error && <div className="flex items-center justify-center h-full text-red-500">{error}</div>}
                </div>
              </CardContent>
              <CardFooter><p className="text-xs text-muted-foreground">{t('mindMapMakerPage.footerDisclaimer')}</p></CardFooter>
            </Card>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
               <DialogContent className="sm:max-w-[425px]">
                <DialogHeader><DialogTitle>{t('mindMapMakerPage.editNodeDialogTitle')}</DialogTitle><DialogDescription>{t('mindMapMakerPage.editNodeDialogDescription')}</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="node-label" className="text-right">{t('mindMapMakerPage.editNodeDialogLabel')}</Label><Input id="node-label" value={dialogInputValue} onChange={(e) => setDialogInputValue(e.target.value)} className="col-span-3" onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLabel(); }} /></div></div>
                <DialogFooter><DialogClose asChild><Button type="button" variant="outline">{t('mindMapMakerPage.buttonCancel')}</Button></DialogClose><Button type="button" onClick={handleSaveLabel}>{t('mindMapMakerPage.buttonSaveChanges')}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isAdvancedModalOpen} onOpenChange={setIsAdvancedModalOpen}>
              <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader><DialogTitle>{t('mindMapMakerPage.advancedGeneratorDialogTitle')}</DialogTitle><DialogDescription>{t('mindMapMakerPage.advancedGeneratorDialogDescription')}</DialogDescription></DialogHeader>
                <div className="flex-grow border rounded-md overflow-hidden"><iframe src="https://medimind.daivanlabs.site/" title={t('mindMapMakerPage.advancedGeneratorDialogTitle')} width="100%" height="100%" style={{ border: 'none' }} /></div>
                <DialogFooter className="mt-4"><DialogClose asChild><Button type="button" variant="outline">{t('nutritionDatabase.closeButton')}</Button></DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
            <div className="flex flex-col items-center gap-4 mt-8 mb-4">
              <Button
                disabled={isLoading}
                onClick={async () => {
                const accessResult = await checkAccess(featureName);
                if (!accessResult.allowed) {
                  toast({
                    title: t('drugRef.toastAccessDeniedTitle'),
                    description: accessResult.message || t('mindMapMakerPage.toastAdvancedAccessDenied'),
                    variant: "destructive",
                  });
                  openUpgradeDialog();
                  return;
                }
                await incrementUsage(featureName);
                if (accessResult.remaining !== null) {
                  const remainingAfterIncrement = accessResult.remaining - 1;
                  const displayRemaining = Math.max(0, remainingAfterIncrement);
                  toast({
                    title: t('mindMapMakerPage.toastUsageRecordedTitle'),
                    description: t('mindMapMakerPage.toastUsageRecordedDescription', { count: displayRemaining }),
                  });
                  if (displayRemaining <= 0) {
                    setIsInitiallyLocked(true);
                  }
                }
                setIsAdvancedModalOpen(true);
              }}>{t('mindMapMakerPage.advancedGeneratorDialogTitle')}</Button>
              <Link to="/tools"><Button variant="outline" className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> {t('medicalCalculatorPage.common.backToToolsButton')}</Button></Link>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default MindMapMaker;
