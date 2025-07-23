import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { UserLevel } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Save, Trash2, XCircle, BarChartHorizontal, LineChartIcon, UsersIcon, RefreshCw, Terminal, RotateCcw, Edit, PlusCircle, Loader2, Inbox } from "lucide-react"; // Added Loader2, Inbox
import { cn } from "@/lib/utils";
import { formatISO, subDays, eachDayOfInterval, parseISO } from 'date-fns'; // Added parseISO
import { getQuotaLimit, FeatureName } from '@/lib/quotas';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart"; // Import chart components
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useInView } from 'react-intersection-observer'; // Import useInView for post management
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"; // Import Collapsible components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"; // Import Dialog components
import NucleusPostForm, { NucleusPostData } from '@/components/admin/NucleusPostForm'; // Import the form component and its data type
import NucleusSubmissionsAdmin from '@/components/admin/NucleusSubmissionsAdmin'; // Import the new submissions admin component

// Define the type for a feature toggle item
interface FeatureToggle {
  feature_name: string;
  is_enabled: boolean;
  description?: string;
}

// Define the type for a user profile item (keeping it separate for clarity)
interface UserProfile {
    id: string;
    level: UserLevel | null;
    level_expires_at: string | null; // ISO string or null
    created_at: string; // Keep for User Management table
    updated_at: string; // Keep for User Management table
}

// Define type for raw usage data from DB (as returned by a potential function)
// Re-adding types needed for quota display
interface UserDailyUsage {
    user_id: string;
    feature_name: FeatureName;
    usage_count: number;
    usage_date: string; // YYYY-MM-DD
}

// Define type for a single feature's quota status
interface FeatureQuotaStatus {
    limit: number | null;
    used: number;
    remaining: number | null;
}

// Define type for a user's complete quota details (grouped by feature)
interface UserQuotaDetails {
    userId: string;
    level: UserLevel | null;
    quotas: Record<FeatureName, FeatureQuotaStatus>;
}

// Define type for raw usage data from DB (for the existing stats)
interface DailyUsageRecord {
    id: number;
    user_id: string;
    feature_name: string;
    usage_date: string; // YYYY-MM-DD
    count: number; // Corrected column name
    created_at: string;
}

// Define type for aggregated usage stats for the table (today's usage)
interface UsageStatToday {
    feature_name: string;
    total_usage: number;
    userIds: string[]; // Changed from userEmails to userIds
}

// Define type for time series data for the line chart
interface TimeSeriesDataPoint {
    date: string; // YYYY-MM-DD
    [featureName: string]: number | string; // feature_name: usage_count
}

// Define the mapping from internal feature names to user-friendly titles
const featureNameMap: Record<string, string> = {
    'medical_calculator': 'Medical Calculator',
    'drug_reference': 'Drug Reference',
    'disease_library': 'Disease Library',
    'clinical_guidelines': 'Clinical Guidelines',
    'ai_chatbot': 'AI Chatbot',
    'ai_peer_review': 'AI Peer-Review',
    'explore_gemini': 'Explore GEMINI',
    'interaction_checker': 'Drug Interaction Checker',
    'mind_map_maker': 'AI Mind Map Generator',
    'clinical_scoring': 'Clinical Scoring Hub',
    'learning_resources': 'Learning Resources',
    'explore_deepseek': 'Explore DeepSeek', // Added DeepSeek mapping
    'explore_chatgpt': 'Explore ChatGPT'
    // 'health_statistics': 'Health Statistics' // Removed as page doesn't exist
};

// Helper function to get display name, falling back to formatted internal name
const getDisplayFeatureName = (internalName: string): string => {
    return featureNameMap[internalName] || internalName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};


const AdminDashboard: React.FC = () => {
  const [featureToggles, setFeatureToggles] = useState<FeatureToggle[]>([]);
  const [isLoadingToggles, setIsLoadingToggles] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [editingUsers, setEditingUsers] = useState<Record<string, Partial<UserProfile>>>({});
  const [usageStatsToday, setUsageStatsToday] = useState<UsageStatToday[]>([]); // State for today's usage stats table
  const [timeSeriesUsageData, setTimeSeriesUsageData] = useState<TimeSeriesDataPoint[]>([]); // State for line chart data
  const [allFeatureNames, setAllFeatureNames] = useState<string[]>([]); // State to hold all unique feature names for chart lines/legend
  const [isLoadingUsage, setIsLoadingUsage] = useState(true); // Loading for existing stats
  const [usageError, setUsageError] = useState<string | null>(null); // Error for existing stats
  // Re-adding state for the quota table
  const [userQuotaDetails, setUserQuotaDetails] = useState<Record<string, UserQuotaDetails>>({});
  const [userRefreshTimes, setUserRefreshTimes] = useState<Record<string, number>>({}); // Time until refresh in seconds
  const [isLoadingQuotas, setIsLoadingQuotas] = useState(true); // Loading state for new quota table
  const [quotaError, setQuotaError] = useState<string | null>(null); // Error state for new quota table
  const [isResettingQuota, setIsResettingQuota] = useState<string | null>(null); // Track which user's quota is being reset
  const { toast } = useToast();

  // --- State for NUCLEUS Post Management ---
  const [nucleusPosts, setNucleusPosts] = useState<NucleusPostData[]>([]);
  const [isLoadingNucleusPosts, setIsLoadingNucleusPosts] = useState(true); // Initial load
  const [isLoadingMoreNucleusPosts, setIsLoadingMoreNucleusPosts] = useState(false); // Subsequent loads
  const [nucleusError, setNucleusError] = useState<string | null>(null);
  const [isNucleusFormOpen, setIsNucleusFormOpen] = useState(false);
  const [currentNucleusPost, setCurrentNucleusPost] = useState<NucleusPostData | null>(null);
  const [keyInsightsText, setKeyInsightsText] = useState('');
  const [nucleusPostsPage, setNucleusPostsPage] = useState(0); // State for post pagination
  const [hasMoreNucleusPosts, setHasMoreNucleusPosts] = useState(true); // State for post pagination
  const { ref: loadMorePostsRef, inView: loadMorePostsInView } = useInView({ threshold: 0.5 }); // Observer for posts
  const NUCLEUS_POSTS_PER_PAGE = 5; // Items per page for posts
  // --- End State for NUCLEUS Post Management ---

  // Helper function to calculate time until next midnight UTC
  const getTimeUntilNextMidnightUTC = useCallback(() => {
    const now = new Date();
    const midnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    const diff = midnightUTC.getTime() - now.getTime();
    return Math.max(0, Math.floor(diff / 1000)); // Time in seconds
  }, []);

  // Effect to calculate and update refresh times
  useEffect(() => {
    const calculateInitialRefreshTimes = () => {
      const initialTimes: Record<string, number> = {};
      users.forEach(user => {
        if (user.level === 'Free' || user.level === 'Researcher') {
          initialTimes[user.id] = getTimeUntilNextMidnightUTC();
        }
      });
      setUserRefreshTimes(initialTimes);
    };

    calculateInitialRefreshTimes(); // Calculate initial values

    const intervalId = setInterval(() => {
      setUserRefreshTimes(prevTimes => {
        const updatedTimes: Record<string, number> = {};
        Object.keys(prevTimes).forEach(userId => {
          updatedTimes[userId] = Math.max(0, prevTimes[userId] - 60); // Decrement by 60 seconds
        });
        return updatedTimes;
      });
    }, 60000); // Update every 60 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [users, getTimeUntilNextMidnightUTC]);

  // Helper function to format time in hh:mm:ss format
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  // Fetch feature toggles (existing)
  useEffect(() => {
    const loadFeatureToggles = async () => {
      setIsLoadingToggles(true);
      try {
        const { data, error } = await supabase.from('feature_toggles').select('feature_name, is_enabled, description').order('feature_name');
        if (error) throw error;
        setFeatureToggles(data || []);
      } catch (error: any) {
        console.error("Error fetching feature toggles:", error);
        toast({ title: "Error Fetching Toggles", description: error.message || "Could not load feature toggles.", variant: "destructive" });
      } finally {
        setIsLoadingToggles(false);
      }
    };
    loadFeatureToggles();
  }, [toast]);

  // Fetch user profiles
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        // Fetch profile data, excluding email
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, level, level_expires_at, created_at, updated_at') // Removed email select
          .order('created_at', { ascending: false });
        if (profilesError) throw profilesError;

        if (profilesData) {
          // Set users directly without email
          setUsers(profilesData);
        } else {
          setUsers([]);
        }
      } catch (error: any) {
        console.error("Error fetching users:", error);
        toast({ title: "Error Fetching Users", description: error.message || "Could not load user data.", variant: "destructive" });
        setUsers([]);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [toast]); // Keep toast dependency

  // Fetch and process usage statistics for the last 7 days (existing stats card)
  useEffect(() => {
    const fetchUsageDataForStatsCard = async () => {
      setIsLoadingUsage(true);
      setUsageError(null);
      try {
        const endDate = new Date();
        const startDate = subDays(endDate, 6); // Get data for the last 7 days (including today)
        const startDateString = formatISO(startDate, { representation: 'date' });

        // Fetch all usage data within the date range, including user_id
        const { data: usageRecords, error } = await supabase
          .from('daily_usage')
          .select('usage_date, feature_name, count, user_id') // Select the correct 'count' column
          .gte('usage_date', startDateString)
          .order('usage_date', { ascending: true });

        if (error) throw error;

        // --- Process data for Today's Table ---
        const todayString = formatISO(endDate, { representation: 'date' });
        // Use usageRecords directly, assuming it has the 'count' property
        const todayRecords = usageRecords?.filter(r => r.usage_date === todayString) || [];

        // Get unique user IDs from today's records
        const todayUserIdsSet = new Set(todayRecords.map(r => r.user_id).filter(id => id)); // Filter out potential nulls/undefined and use Set for uniqueness

        // No need to fetch emails anymore as the 'profiles' table doesn't have an email column.
        // We already have the user IDs from the 'daily_usage' table.

        // Aggregate stats and collect user IDs
        const aggregatedStatsToday: Record<string, { total_usage: number; userIds: Set<string> }> = {};
        todayRecords.forEach(record => {
          if (!aggregatedStatsToday[record.feature_name]) {
            aggregatedStatsToday[record.feature_name] = { total_usage: 0, userIds: new Set() };
          }
          aggregatedStatsToday[record.feature_name].total_usage += record.count; // Use correct 'count' property
          if (record.user_id) { // Ensure user_id exists
            aggregatedStatsToday[record.feature_name].userIds.add(record.user_id);
          }
        });

        const statsArrayToday: UsageStatToday[] = Object.entries(aggregatedStatsToday)
          .map(([feature_name, data]) => ({
            feature_name,
            total_usage: data.total_usage,
            userIds: Array.from(data.userIds).sort() // Use the collected user IDs directly
          }))
          .sort((a, b) => a.feature_name.localeCompare(b.feature_name));
        setUsageStatsToday(statsArrayToday);
        // --- End Processing for Today's Table ---


        // --- Process data for Time Series Chart ---
        const uniqueFeatureNames = Array.from(new Set(usageRecords?.map(r => r.feature_name) || []));
        setAllFeatureNames(uniqueFeatureNames.sort()); // Store sorted feature names for consistent line colors/legend

        const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
        const dateMap: Record<string, TimeSeriesDataPoint> = {};

        // Initialize map with all dates and all features set to 0
        dateInterval.forEach(date => {
          const dateStr = formatISO(date, { representation: 'date' });
          dateMap[dateStr] = { date: dateStr };
          uniqueFeatureNames.forEach(name => {
            dateMap[dateStr][name] = 0;
          });
        });

        // Populate map with actual usage counts
        usageRecords?.forEach(record => {
          if (dateMap[record.usage_date]) {
            // Use correct 'count' property. Add type assertion if needed, though Supabase types might handle it.
            dateMap[record.usage_date][record.feature_name] = (dateMap[record.usage_date][record.feature_name] as number || 0) + record.count;
          }
        });

        // Convert map to array, sorted by date
        const timeSeriesData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
        setTimeSeriesUsageData(timeSeriesData);
        // --- End Processing for Time Series Chart ---

      } catch (error: any) {
        console.error("Error fetching usage statistics:", error);
        setUsageError(error.message || "Could not load usage statistics.");
        setUsageStatsToday([]);
        setTimeSeriesUsageData([]);
        setAllFeatureNames([]);
      } finally {
        setIsLoadingUsage(false);
      }
    };

    fetchUsageDataForStatsCard();
  }, [supabase]); // Depend on supabase client instance

  // --- Fetch and process ALL user quotas for the new table ---
  // Re-adding fetch logic for quota display
  const fetchAllUserQuotas = useCallback(async (cacheBuster?: number) => {
    setIsLoadingQuotas(true);
    setQuotaError(null);
    try {
      // 1. Fetch all profiles to get user levels
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, level, level_expires_at'); // Fetch necessary fields
      if (profilesError) throw profilesError;

      // Create a map for quick level lookup and expiry check
      const userLevelMap = new Map<string, { level: UserLevel | null; expiresAt: string | null }>();
      profilesData?.forEach(p => userLevelMap.set(p.id, { level: p.level, expiresAt: p.level_expires_at }));

      // 2. Fetch today's usage for ALL users using the existing RPC function with cache buster
      const { data: usageData, error: usageError } = await supabase.rpc('get_today_all_usage', {
        _cache_buster: cacheBuster || Date.now() // Use provided timestamp or current timestamp
      });

      console.log("Usage Data for Quota Table:", usageData); // Debugging

      if (usageError) {
        console.error("Error fetching all user usage:", usageError);
        if (usageError.code === '42883') {
             throw new Error("Supabase function 'get_today_all_usage' not found. Please ensure it exists.");
        }
        throw usageError;
      }

      // 3. Process data: Group quotas by user ID
      const processedUserQuotas: Record<string, UserQuotaDetails> = {};
      const allFeatureNamesList: FeatureName[] = [ // Ensure this list is comprehensive
        'ai_chatbot', 'ai_peer_review', 'disease_library', 'drug_reference',
        'clinical_guidelines', 'interaction_checker', 'explore_gemini',
        'medical_calculator', 'nutrition_database', 'learning_resources',
        'mind_map_maker', 'clinical_scoring', 'explore_deepseek', 'explore_chatgpt'
      ];

      for (const [userId, profileInfo] of userLevelMap.entries()) {
        let effectiveLevel = profileInfo.level ?? 'Free';
        if (effectiveLevel === 'Researcher' && profileInfo.expiresAt) {
          if (new Date(profileInfo.expiresAt) < new Date()) {
            effectiveLevel = 'Free';
          }
        }

        processedUserQuotas[userId] = {
          userId,
          level: effectiveLevel,
          quotas: {} as Record<FeatureName, FeatureQuotaStatus>
        };

        for (const featureName of allFeatureNamesList) {
          const quotaLimit = getQuotaLimit(effectiveLevel, featureName);
          const usageRecord = (usageData as UserDailyUsage[] | null)?.find(
            (u: UserDailyUsage) => u.user_id === userId && u.feature_name === featureName
          );
          const usageToday = usageRecord?.usage_count ?? 0;
          const remainingQuota = quotaLimit === null ? null : Math.max(0, quotaLimit - usageToday);

          processedUserQuotas[userId].quotas[featureName] = {
            limit: quotaLimit,
            used: usageToday,
            remaining: remainingQuota,
          };
        }
      }

      setUserQuotaDetails(processedUserQuotas);

    } catch (error: any) {
      console.error("Error processing user quotas:", error);
      setQuotaError(error.message || "Could not load user quota data.");
      setUserQuotaDetails({});
    } finally {
      setIsLoadingQuotas(false);
    }
  }, [supabase]);

  // Fetch quotas on initial load
  useEffect(() => {
    fetchAllUserQuotas();
  }, [fetchAllUserQuotas]);

  // --- NUCLEUS Post Management Fetch (with Pagination) ---
  const fetchNucleusPosts = useCallback(async (pageNum: number) => {
    console.log(`Fetching NUCLEUS posts page: ${pageNum}`); // Debug log
    if (pageNum === 0) {
      setIsLoadingNucleusPosts(true);
      setNucleusPosts([]); // Clear on initial load/refresh
    } else {
      setIsLoadingMoreNucleusPosts(true);
    }
    setNucleusError(null);

    const from = pageNum * NUCLEUS_POSTS_PER_PAGE;
    const to = from + NUCLEUS_POSTS_PER_PAGE - 1;

    try {
      const { data, error, count } = await supabase
        .from('nucleus_posts')
        .select('*', { count: 'exact' }) // Select all columns for editing
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const newPosts = data || [];
      console.log(`Fetched ${newPosts.length} NUCLEUS posts for page ${pageNum}`); // Debug log

      setNucleusPosts(prev => pageNum === 0 ? newPosts : [...prev, ...newPosts]);
      setHasMoreNucleusPosts(newPosts.length === NUCLEUS_POSTS_PER_PAGE);
      console.log(`Has more NUCLEUS posts: ${newPosts.length === NUCLEUS_POSTS_PER_PAGE}`); // Debug log

    } catch (error: any) {
      console.error("Error fetching NUCLEUS posts:", error);
      setNucleusError(error.message || "Could not load NUCLEUS posts.");
      if (pageNum === 0) setNucleusPosts([]);
    } finally {
      if (pageNum === 0) {
        setIsLoadingNucleusPosts(false);
      } else {
        setIsLoadingMoreNucleusPosts(false);
      }
    }
  }, [supabase]);

  // Fetch Nucleus posts on initial load or page change
  useEffect(() => {
    fetchNucleusPosts(nucleusPostsPage);
  }, [fetchNucleusPosts, nucleusPostsPage]);

  // Effect to load more posts when the sentinel element is in view
  useEffect(() => {
    if (loadMorePostsInView && hasMoreNucleusPosts && !isLoadingMoreNucleusPosts && !isLoadingNucleusPosts) {
      console.log("Load more NUCLEUS posts triggered!"); // Debug log
      setNucleusPostsPage(prevPage => prevPage + 1);
    }
  }, [loadMorePostsInView, hasMoreNucleusPosts, isLoadingMoreNucleusPosts, isLoadingNucleusPosts]);

  // Function to refresh posts list
  const handleRefreshNucleusPosts = () => {
    setNucleusPostsPage(0); // Reset page to 0
    fetchNucleusPosts(0); // Explicitly fetch the first page
  };
  // --- End NUCLEUS Post Management Fetch ---


  // --- NUCLEUS Form Handlers ---
  const handleOpenNucleusForm = (post: NucleusPostData | null = null) => {
    // Manual scroll lock
    document.body.style.overflow = 'hidden';
    if (post) {
      // Editing existing post
      setCurrentNucleusPost(post);
      setKeyInsightsText(post.key_insights?.join('\n') ?? ''); // Populate textarea
    } else {
      // Creating new post
      setCurrentNucleusPost({ // Default empty state
        title: '',
        slug: '',
        summary: '',
        featured_image_url: '',
        content: '',
        category: '',
        subtitle: '',
        author: '',
        location: '',
        key_insights: [],
      });
      setKeyInsightsText('');
    }
    setIsNucleusFormOpen(true);
  };

  const handleCloseNucleusForm = () => {
    // Manual scroll unlock
    document.body.style.overflow = 'auto';
    setIsNucleusFormOpen(false);
    setCurrentNucleusPost(null); // Clear current post on close
    setKeyInsightsText('');
  };

  const handleNucleusFormChange = (field: keyof NucleusPostData, value: string) => {
    setCurrentNucleusPost(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleKeyInsightsChange = (text: string) => {
    setKeyInsightsText(text);
    // Update the actual key_insights array in the current post state
    setCurrentNucleusPost(prev => prev ? { ...prev, key_insights: text.split('\n').map(s => s.trim()).filter(s => s) } : null);
  };

  const handleNucleusSaveSuccess = () => { // Removed async as fetch is handled by refresh
    handleCloseNucleusForm(); // Close form first
    handleRefreshNucleusPosts(); // Refresh the list (resets to page 0)
  };
  // --- End NUCLEUS Form Handlers ---

  // --- User Management Handlers (existing) ---
  const handleLevelChange = (userId: string, newLevel: UserLevel) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        level: newLevel,
        level_expires_at: (newLevel === 'Researcher' || newLevel === 'Master') ? (prev[userId]?.level_expires_at ?? users.find(u => u.id === userId)?.level_expires_at) : null,
      }
    }));
  };

  const handleExpiryDateChange = (userId: string, date: Date | undefined) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: { ...prev[userId], level_expires_at: date ? date.toISOString() : null }
    }));
  };

  const handleSaveUserChanges = async (userId: string) => {
    const changes = editingUsers[userId];
    if (!changes || !changes.level) {
      toast({ title: "Error", description: "User level cannot be empty.", variant: "destructive" }); return;
    }
    const updateData = {
      level: changes.level,
      level_expires_at: (changes.level === 'Researcher' || changes.level === 'Master') ? (changes.level_expires_at ?? null) : null
    };
    try {
      const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
      if (error) throw error;
      setUsers(prevUsers => prevUsers.map(user => user.id === userId ? { ...user, ...updateData, updated_at: new Date().toISOString() } : user));
      setEditingUsers(prev => { const newState = { ...prev }; delete newState[userId]; return newState; });
      toast({ title: "Success", description: "User profile updated." });
    } catch (error: any) {
      console.error(`Error updating profile for user ${userId}:`, error);
      toast({ title: "Error Updating Profile", description: error.message || "Could not save changes.", variant: "destructive" });
    }
  };

  // Corrected handleDiscardChanges
  const handleDiscardChanges = (userId: string) => {
     setEditingUsers(prev => {
       const newState = { ...prev };
       delete newState[userId];
       return newState;
     });
  };
  // --- End User Management Handlers ---

  // --- Quota Reset Handler ---
  const handleResetQuota = async (userIdToReset: string) => {
    setIsResettingQuota(userIdToReset); // Indicate loading for this specific user
    try {
      console.log(`[AdminDashboard] Calling RPC 'reset_user_quota_manual' for user ${userIdToReset}`);
      const { error } = await supabase.rpc('reset_user_quota_manual', {
        user_id_param: userIdToReset,
      });

      if (error) {
        console.error(`[AdminDashboard] Error resetting quota for ${userIdToReset}:`, error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Quota for user ${userIdToReset.substring(0, 8)}... has been reset for today.`,
      });

      // Refresh the quota table data after successful reset
      await fetchAllUserQuotas(Date.now());

    } catch (error: any) {
      toast({
        title: "Error Resetting Quota",
        description: error.message || `Could not reset quota for user ${userIdToReset.substring(0, 8)}...`,
        variant: "destructive",
      });
    } finally {
      setIsResettingQuota(null); // Clear loading state
    }
  };
  // --- End Quota Reset Handler ---

  // Handle feature toggle change (existing)
  const handleToggleChange = async (featureName: string, checked: boolean) => {
    const originalToggles = [...featureToggles];
    setFeatureToggles(prevToggles => prevToggles.map(toggle => toggle.feature_name === featureName ? { ...toggle, is_enabled: checked } : toggle));
    try {
      const { error } = await supabase.from('feature_toggles').update({ is_enabled: checked }).eq('feature_name', featureName);
      if (error) throw error;
      toast({ title: "Success", description: `Feature '${featureName.replace(/_/g, ' ')}' ${checked ? 'enabled' : 'disabled'}.` });
    } catch (error: any) {
      console.error(`Error updating toggle for ${featureName}:`, error);
      setFeatureToggles(originalToggles); // Revert optimistic update
      toast({ title: "Error Updating Toggle", description: error.message || `Could not update feature.`, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Feature Toggles Card */}
      <Card className="mb-8">
        <CardHeader><CardTitle>Feature Toggles</CardTitle></CardHeader>
        <CardContent>
          {isLoadingToggles ? (<p>Loading feature toggles...</p>) : featureToggles.length === 0 ? (<p>No feature toggles found.</p>) : (
            <>
              {/* Table View for Medium Screens and Up */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Feature</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {featureToggles.map((toggle) => (
                      <TableRow key={toggle.feature_name}>
                        {/* Use helper function for display name */}
                        <TableCell className="font-medium">{getDisplayFeatureName(toggle.feature_name)}</TableCell>
                        <TableCell>{toggle.description || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Use helper function for display name in label */}
                            <Label htmlFor={`toggle-table-${toggle.feature_name}`} className="sr-only">{toggle.is_enabled ? 'Disable' : 'Enable'} {getDisplayFeatureName(toggle.feature_name)}</Label>
                            <Switch id={`toggle-table-${toggle.feature_name}`} checked={toggle.is_enabled} onCheckedChange={(checked) => handleToggleChange(toggle.feature_name, checked)} aria-label={`Toggle ${getDisplayFeatureName(toggle.feature_name)}`} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Card View for Small Screens */}
              <div className="block md:hidden space-y-4">
                {featureToggles.map((toggle) => (
                  <Card key={`card-${toggle.feature_name}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {getDisplayFeatureName(toggle.feature_name)}
                      </CardTitle>
                      <Switch
                        id={`toggle-card-${toggle.feature_name}`}
                        checked={toggle.is_enabled}
                        onCheckedChange={(checked) => handleToggleChange(toggle.feature_name, checked)}
                        aria-label={`Toggle ${getDisplayFeatureName(toggle.feature_name)}`}
                      />
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {toggle.description || 'No description available.'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* 7-Day Usage Trend Chart */}
          <h3 className="text-lg font-semibold mt-6 mb-2">Usage Trend (Last 7 Days)</h3>
          {isLoadingUsage ? (
            <p>Loading usage trend...</p>
          ) : usageError ? (
            <p className="text-red-600">Error loading trend: {usageError}</p>
          ) : timeSeriesUsageData.length === 0 ? (
            <p>No usage data available for the last 7 days.</p>
          ) : (
            <div className="h-[300px] w-full"> {/* Set explicit height */}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={timeSeriesUsageData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => format(parseISO(value), 'MMM d')} />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-1 gap-1.5"> {/* Changed to 1 column for better readability */}
                              <span className="text-sm font-semibold">{format(parseISO(label), 'PP')}</span>
                              {payload.map((entry, index) => (
                                <div key={`tooltip-${index}`} className="flex items-center gap-1.5">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <div className="flex flex-1 justify-between leading-none">
                                    {/* Explicitly convert entry.name to string */}
                                    <span className="text-muted-foreground">{getDisplayFeatureName(String(entry.name || ''))}:</span>
                                    <span className="font-medium">{entry.value}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {allFeatureNames.map((featureName, index) => (
                    <Line
                      key={featureName}
                      type="monotone"
                      dataKey={featureName}
                      stroke={`hsl(${index * (360 / (allFeatureNames.length || 1))}, 70%, 50%)`} // Generate distinct colors
                      strokeWidth={2}
                      dot={false}
                      name={getDisplayFeatureName(featureName)} // Use display name in legend/tooltip
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* End 7-Day Usage Trend Chart */}

        </CardContent>
      </Card>

      {/* User Management Card */}
      <Card className="mb-8">
        <CardHeader><CardTitle>User Management</CardTitle><CardDescription>View and manage user levels and access.</CardDescription></CardHeader>
        <CardContent>
          {isLoadingUsers ? (<p>Loading users...</p>) : users.length === 0 ? (<p>No user profiles found.</p>) : (
            <>
              {/* Table View for Medium Screens and Up */}
              {/* Added horizontal scroll on medium screens */}
              <div className="hidden md:block max-h-[350px] overflow-y-auto md:overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Email / User ID</TableHead><TableHead>Level</TableHead><TableHead>Level Expires</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        {/* Updated TableCell to show only User ID */}
                        <TableCell className="font-medium">
                          {/* <div>{user.email}</div> */} {/* Removed email display */}
                          <div className="text-sm break-all">{user.id}</div> {/* Display ID directly */}
                        </TableCell>
                        <TableCell>
                          <Select value={editingUsers[user.id]?.level ?? user.level ?? 'Free'} onValueChange={(value) => handleLevelChange(user.id, value as UserLevel)}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Select level" /></SelectTrigger>
                            <SelectContent>
                              {/* Show Free, Researcher, and Master for non-specific admin user */}
                              {user.id !== 'bd66e44f-4bcb-494d-803b-9fead7399ddb' && (
                                <>
                                  <SelectItem value="Free">Free</SelectItem>
                                  <SelectItem value="Researcher">Researcher</SelectItem>
                                  <SelectItem value="Master">Master</SelectItem>
                                </>
                              )}
                              {/* Only show Administrator option for the specific user ID */}
                              {user.id === 'bd66e44f-4bcb-494d-803b-9fead7399ddb' && (
                                <SelectItem value="Administrator">Administrator</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {((editingUsers[user.id]?.level ?? user.level) === 'Researcher' || (editingUsers[user.id]?.level ?? user.level) === 'Master') ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-[200px] justify-start text-left font-normal", !(editingUsers[user.id]?.level_expires_at ?? user.level_expires_at) && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {(editingUsers[user.id]?.level_expires_at ?? user.level_expires_at) ? format(new Date(editingUsers[user.id]?.level_expires_at ?? user.level_expires_at!), 'PP') : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={editingUsers[user.id]?.level_expires_at ? new Date(editingUsers[user.id]!.level_expires_at!) : user.level_expires_at ? new Date(user.level_expires_at) : undefined} onSelect={(date) => handleExpiryDateChange(user.id, date)} initialFocus />
                                <div className="p-2 border-t"><Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => handleExpiryDateChange(user.id, undefined)}>Clear Date (No Expiry)</Button></div>
                              </PopoverContent>
                            </Popover>
                          ) : ('-')}
                        </TableCell>
                        <TableCell>{format(new Date(user.created_at), 'PP')}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {editingUsers[user.id] ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleSaveUserChanges(user.id)} title="Save Changes"><Save className="h-4 w-4 text-green-600" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDiscardChanges(user.id)} title="Discard Changes"><XCircle className="h-4 w-4 text-red-600" /></Button>
                            </>
                          ) : (<span className="text-xs text-muted-foreground"></span>)}
                          {/* <Button variant="ghost" size="icon" title="Delete User (Not Implemented)"><Trash2 className="h-4 w-4 text-destructive" /></Button> */}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Card View for Small Screens (User Management) */}
              <div className="block md:hidden space-y-4 max-h-[600px] overflow-y-auto">
                {users.map((user) => (
                  <Card key={`card-${user.id}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium break-all">User ID: {user.id}</CardTitle>
                      <CardDescription>Joined: {format(new Date(user.created_at), 'PP')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-col space-y-1.5">
                        <Label htmlFor={`select-level-card-${user.id}`}>Level</Label>
                        <Select
                          value={editingUsers[user.id]?.level ?? user.level ?? 'Free'}
                          onValueChange={(value) => handleLevelChange(user.id, value as UserLevel)}
                        >
                          <SelectTrigger id={`select-level-card-${user.id}`}><SelectValue placeholder="Select level" /></SelectTrigger>
                          <SelectContent>
                            {/* Show Free, Researcher, and Master for non-specific admin user */}
                            {user.id !== 'bd66e44f-4bcb-494d-803b-9fead7399ddb' && (
                              <>
                                <SelectItem value="Free">Free</SelectItem>
                                <SelectItem value="Researcher">Researcher</SelectItem>
                                <SelectItem value="Master">Master</SelectItem>
                              </>
                            )}
                            {/* Only show Administrator option for the specific user ID */}
                            {user.id === 'bd66e44f-4bcb-494d-803b-9fead7399ddb' && (
                              <SelectItem value="Administrator">Administrator</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {((editingUsers[user.id]?.level ?? user.level) === 'Researcher' || (editingUsers[user.id]?.level ?? user.level) === 'Master') && (
                        <div className="flex flex-col space-y-1.5">
                          <Label>Level Expires</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !(editingUsers[user.id]?.level_expires_at ?? user.level_expires_at) && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {(editingUsers[user.id]?.level_expires_at ?? user.level_expires_at) ? format(new Date(editingUsers[user.id]?.level_expires_at ?? user.level_expires_at!), 'PP') : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={editingUsers[user.id]?.level_expires_at ? new Date(editingUsers[user.id]!.level_expires_at!) : user.level_expires_at ? new Date(user.level_expires_at) : undefined} onSelect={(date) => handleExpiryDateChange(user.id, date)} initialFocus />
                              <div className="p-2 border-t"><Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => handleExpiryDateChange(user.id, undefined)}>Clear Date (No Expiry)</Button></div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}

                      <div className="flex justify-end space-x-2 pt-2">
                        {editingUsers[user.id] ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleSaveUserChanges(user.id)} title="Save Changes"><Save className="mr-1 h-4 w-4 text-green-600" /> Save</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDiscardChanges(user.id)} title="Discard Changes"><XCircle className="mr-1 h-4 w-4 text-red-600" /> Discard</Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground h-9 flex items-center"></span> // Placeholder to maintain height
                        )}
                        {/* <Button variant="ghost" size="icon" title="Delete User (Not Implemented)"><Trash2 className="h-4 w-4 text-destructive" /></Button> */}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5" /> Usage Statistics {/* Changed Icon */}
          </CardTitle>
          <CardDescription>Total usage counts for today and trends over the last 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2">Today's Usage</h3>
          {isLoadingUsage ? (
            <p>Loading today's usage...</p>
          ) : usageError ? (
            <p className="text-red-600">Error loading usage: {usageError}</p>
          ) : usageStatsToday.length === 0 ? (
            <p>No usage recorded today.</p>
          ) : (
            <>
              {/* Table View for Medium Screens and Up */}
              <div className="hidden md:block mb-6">
                <Table>
                  <TableHeader><TableRow><TableHead>Feature</TableHead><TableHead className="text-center">Users</TableHead><TableHead className="text-right">Total Usage Today</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {usageStatsToday.map((stat) => (
                      <TableRow key={stat.feature_name}>
                        {/* Use helper function for display name */}
                        <TableCell className="font-medium">{getDisplayFeatureName(stat.feature_name)}</TableCell>
                        {/* Users Popover Cell - Now displays User IDs */}
                        <TableCell className="text-center">
                          {stat.userIds.length > 0 ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs">
                                  <UsersIcon className="mr-1 h-3 w-3" /> {stat.userIds.length}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto max-w-xs p-2">
                                <div className="text-sm font-semibold mb-1">User IDs ({stat.userIds.length})</div>
                                <ul className="list-disc list-inside text-xs max-h-40 overflow-y-auto">
                                  {stat.userIds.map((userId, index) => (
                                    <li key={index} className="truncate">{userId}</li>
                                  ))}
                                </ul>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{stat.total_usage}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Card View for Small Screens */}
              <div className="block md:hidden space-y-4 mb-6">
                {usageStatsToday.map((stat) => (
                  <Card key={`card-stat-${stat.feature_name}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {getDisplayFeatureName(stat.feature_name)}
                      </CardTitle>
                      <div className="text-sm font-bold">{stat.total_usage}</div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground flex items-center">
                        {stat.userIds.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="link" size="sm" className="text-xs h-auto p-0 text-muted-foreground hover:text-primary">
                                <UsersIcon className="mr-1 h-3 w-3" /> {stat.userIds.length} User(s) Today
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto max-w-xs p-2">
                              <div className="text-sm font-semibold mb-1">User IDs ({stat.userIds.length})</div>
                              <ul className="list-disc list-inside text-xs max-h-40 overflow-y-auto">
                                {stat.userIds.map((userId, index) => (
                                  <li key={index} className="truncate">{userId}</li>
                                ))}
                              </ul>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span>0 Users Today</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* User Quota Display Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <CardTitle>User Daily Quotas</CardTitle>
              <CardDescription>View current daily usage against limits for each user.</CardDescription>
            </div>
            <Button 
              onClick={() => fetchAllUserQuotas(Date.now())} 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1 w-full md:w-auto"
              disabled={isLoadingQuotas}
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingQuotas ? 'animate-spin' : ''}`} />
              <span>{isLoadingQuotas ? 'Refreshing...' : 'Refresh Data'}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingQuotas ? (
            <p>Loading user quotas...</p>
          ) : quotaError ? (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Loading Quotas</AlertTitle>
              <AlertDescription>{quotaError}</AlertDescription>
            </Alert>
          ) : Object.keys(userQuotaDetails).length === 0 ? (
            <p>No user quota data available for today.</p>
          ) : (
            <>
              {/* Table View for Large Screens and Up */}
              {/* Added horizontal scroll */}
              <div className="hidden lg:block max-h-[350px] overflow-y-auto overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead className="min-w-[150px]">User ID</TableHead><TableHead>Level</TableHead>{allFeatureNames.map(featureName => (<TableHead key={featureName} className="text-center text-xs whitespace-nowrap">{getDisplayFeatureName(featureName)} <br/> (Remaining)</TableHead>))}<TableHead className="text-center">Quota Reset</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {Object.values(userQuotaDetails).map((userDetails) => (
                      <TableRow key={userDetails.userId}>
                        <TableCell className="font-medium text-xs break-all min-w-[150px]">{userDetails.userId}</TableCell>
                        <TableCell>{userDetails.level}</TableCell>
                        {/* Dynamically create cells for each feature quota */}
                        {allFeatureNames.map(featureName => {
                          const quota = userDetails.quotas[featureName as FeatureName]; // Cast needed if allFeatureNames isn't strictly FeatureName[]
                          if (!quota) { // Handle case where a feature might not be in the details (e.g., new feature)
                            return <TableCell key={featureName} className="text-center text-xs text-muted-foreground">-</TableCell>;
                          }
                          let limitText = quota.limit === null ? 'Unlimited' : quota.limit;
                          let displayText = "";

                          if (featureName === 'learning_resources') {
                            displayText = (quota.limit === null ? 'Access' : 'No Access');
                          } else {
                            // Display remaining quota instead of used/limit
                            displayText = quota.remaining === null ? 'Unlimited' : quota.remaining.toString();
                          }

                          return (
                            <TableCell key={featureName} className="text-center text-xs">
                              {/* Display remaining quota */}
                              {displayText}
                            </TableCell>
                          );
                        })}
                        {/* Added Quota Reset Cell */}
                        <TableCell className="text-center text-xs"> {/* Centered */}
                          {userRefreshTimes[userDetails.userId] !== undefined ? (
                            formatTime(userRefreshTimes[userDetails.userId])
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        {/* Added Actions Cell with Reset Button */}
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="text-xs"
                                disabled={isLoadingQuotas || isResettingQuota === userDetails.userId} // Disable while loading or resetting this user
                                title={`Reset Today's Quota for ${userDetails.userId.substring(0,8)}...`}
                              >
                                <RotateCcw className={`mr-1 h-3 w-3 ${isResettingQuota === userDetails.userId ? 'animate-spin' : ''}`} />
                                {isResettingQuota === userDetails.userId ? 'Resetting...' : 'Reset'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will reset today's usage count for all features for user ID <span className="font-mono break-all">{userDetails.userId}</span> back to zero. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleResetQuota(userDetails.userId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Yes, Reset Quota
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Card View for Screens Smaller than Large */}
              <div className="block lg:hidden space-y-4 max-h-[600px] overflow-y-auto">
                {Object.values(userQuotaDetails).map((userDetails) => (
                  <Card key={`card-quota-${userDetails.userId}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium break-all">User ID: {userDetails.userId}</CardTitle>
                      <CardDescription>Level: {userDetails.level}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-center text-xs">
                            View/Hide Quotas
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-1 text-xs border rounded-md p-2">
                          {allFeatureNames.map(featureName => {
                            const quota = userDetails.quotas[featureName as FeatureName];
                            if (!quota) return null;
                            let displayText = "";
                            if (featureName === 'learning_resources') {
                              displayText = (quota.limit === null ? 'Access' : 'No Access');
                            } else {
                              displayText = quota.remaining === null ? 'Unlimited' : quota.remaining.toString();
                            }
                            return (
                              <div key={`quota-detail-${userDetails.userId}-${featureName}`} className="flex justify-between items-center">
                                <span className="text-muted-foreground">{getDisplayFeatureName(featureName)}:</span>
                                <span className="font-medium">{displayText}</span>
                              </div>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>

                      <div className="flex items-center justify-between pt-2 border-t mt-3">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Resets in: </span>
                          {userRefreshTimes[userDetails.userId] !== undefined ? (
                            <span className="font-mono">{formatTime(userRefreshTimes[userDetails.userId])}</span>
                          ) : (
                            '-'
                          )}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="text-xs"
                              disabled={isLoadingQuotas || isResettingQuota === userDetails.userId}
                              title={`Reset Today's Quota for ${userDetails.userId.substring(0,8)}...`}
                            >
                              <RotateCcw className={`mr-1 h-3 w-3 ${isResettingQuota === userDetails.userId ? 'animate-spin' : ''}`} />
                              {isResettingQuota === userDetails.userId ? 'Resetting...' : 'Reset'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will reset today's usage count for all features for user ID <span className="font-mono break-all">{userDetails.userId}</span> back to zero. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleResetQuota(userDetails.userId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Yes, Reset Quota
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {/* End User Quota Display Card */}

       {/* NUCLEUS Post Management Card */}
       <Card className="mb-8">
         <CardHeader>
           {/* Responsive Header: Stack on mobile, row on medium+ */}
           <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
             <div className="flex-1"> {/* Allow title to take space */}
               <CardTitle>NUCLEUS Post Management</CardTitle>
               <CardDescription>Create, edit, or delete published posts.</CardDescription> {/* Added description */}
             </div>
             <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2"> {/* Container for buttons */}
               <Button onClick={handleRefreshNucleusPosts} variant="outline" size="sm" disabled={isLoadingNucleusPosts && nucleusPostsPage === 0}>
                 <RefreshCw className={`mr-1 h-4 w-4 ${(isLoadingNucleusPosts && nucleusPostsPage === 0) ? 'animate-spin' : ''}`} />
                 Refresh Posts
               </Button>
               <Dialog
                modal={false}
                open={isNucleusFormOpen}
                onOpenChange={(isOpen) => {
                  // Handle manual close (X button or clicking outside)
                  if (!isOpen) {
                    handleCloseNucleusForm();
                  } else {
                    // This case shouldn't happen if triggered only by close,
                    // but keep setIsOpen for consistency if needed elsewhere.
                    setIsNucleusFormOpen(true);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => handleOpenNucleusForm()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Post
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-[60vw] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{currentNucleusPost?.id ? 'Edit' : 'Create'} NUCLEUS Post</DialogTitle>
                    <DialogDescription>
                      {currentNucleusPost?.id ? 'Modify the details of the existing post.' : 'Fill in the details for the new post.'}
                    </DialogDescription>
                  </DialogHeader>
                  {/* Render the form only when currentNucleusPost is not null */}
                  {currentNucleusPost && (
                    <NucleusPostForm
                      formData={currentNucleusPost}
                      keyInsightsText={keyInsightsText}
                      onFormChange={handleNucleusFormChange}
                      onKeyInsightsChange={handleKeyInsightsChange}
                      onSaveSuccess={handleNucleusSaveSuccess}
                      onCancel={handleCloseNucleusForm}
                      isEditing={!!currentNucleusPost?.id}
                    />
                  )}
                  {/* Footer is handled by the form itself */}
                </DialogContent>
              </Dialog>
             </div>
           </div>
         </CardHeader>
         <CardContent>
          {/* Show initial loading only */}
          {isLoadingNucleusPosts && nucleusPostsPage === 0 && !nucleusError && (
            <p>Loading posts...</p>
          )}
          {nucleusError && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Loading Posts</AlertTitle>
              <AlertDescription>{nucleusError}</AlertDescription>
            </Alert>
          )}
          {/* Show no posts message only if not initial loading and array is empty */}
          {!isLoadingNucleusPosts && nucleusPosts.length === 0 && !nucleusError && (
            <p>No NUCLEUS posts found.</p>
          )}
          {/* Render posts if available */}
          {nucleusPosts.length > 0 && (
            <>
              {/* Table View for Medium Screens and Up - Remove max-height */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Author</TableHead><TableHead>Published</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {nucleusPosts.map((post, index) => ( // Add index for ref
                    <TableRow key={post.id} ref={index === nucleusPosts.length - 1 ? loadMorePostsRef : null}> {/* Add ref to last row */}
                      <TableCell className="font-medium">{post.title}</TableCell>
                      <TableCell>{post.category || '-'}</TableCell>
                      <TableCell>{post.author || '-'}</TableCell>
                      <TableCell>{post.published_at ? format(new Date(post.published_at), 'PP') : '-'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenNucleusForm(post)} title="Edit Post">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* Delete Confirmation Dialog */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete Post">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the post titled "{post.title}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  try {
                                    const { error } = await supabase.from('nucleus_posts').delete().eq('id', post.id);
                                     if (error) throw error;
                                     toast({ title: "Success", description: "Post deleted successfully." });
                                     handleRefreshNucleusPosts(); // Refresh list using new handler
                                   } catch (err: any) {
                                     console.error("Error deleting post:", err);
                                    toast({ title: "Error Deleting Post", description: err.message || "Could not delete the post.", variant: "destructive" });
                                  }
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Yes, Delete Post
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Card View for Small Screens - Remove max-height */}
              <div className="block md:hidden space-y-4">
                {nucleusPosts.map((post, index) => ( // Add index for ref
                  <Card key={`card-post-${post.id}`} ref={index === nucleusPosts.length - 1 ? loadMorePostsRef : null}> {/* Add ref to last card */}
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">{post.title}</CardTitle>
                      <CardDescription>
                        {post.category ? `${post.category} | ` : ''}
                        {post.author ? `By ${post.author} | ` : ''}
                        {post.published_at ? format(new Date(post.published_at), 'PP') : 'Not Published'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenNucleusForm(post)} title="Edit Post">
                        <Edit className="mr-1 h-4 w-4" /> Edit
                      </Button>
                      {/* Delete Confirmation Dialog (copied from table view) */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" title="Delete Post">
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the post titled "{post.title}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  const { error } = await supabase.from('nucleus_posts').delete().eq('id', post.id);
                                   if (error) throw error;
                                   toast({ title: "Success", description: "Post deleted successfully." });
                                   handleRefreshNucleusPosts(); // Refresh list using new handler
                                 } catch (err: any) {
                                   console.error("Error deleting post:", err);
                                  toast({ title: "Error Deleting Post", description: err.message || "Could not delete the post.", variant: "destructive" });
                                }
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Yes, Delete Post
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Sentinel element for Intersection Observer */}
              <div ref={loadMorePostsRef} className="h-10" />

              {/* Loading indicator for subsequent pages */}
              {isLoadingMoreNucleusPosts && (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading more posts...</span>
                </div>
              )}

              {/* Message when all items are loaded */}
              {!hasMoreNucleusPosts && !isLoadingMoreNucleusPosts && nucleusPosts.length > 0 && (
                <p className="text-center text-muted-foreground py-4">No more posts to load.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {/* End NUCLEUS Post Management Card */}

      {/* NUCLEUS Submissions Review Card */}
      <div className="mb-8"> {/* Added div wrapper for consistent margin */}
        <NucleusSubmissionsAdmin />
      </div>
      {/* End NUCLEUS Submissions Review Card */}
    </div>
  );
};

export default AdminDashboard;
