import { UserLevel } from '@/contexts/AuthContext'; // Assuming UserLevel is defined here

export type FeatureName =
  | 'ai_chatbot'
  | 'ai_peer_review'
  | 'disease_library'
  | 'drug_reference'
  | 'clinical_guidelines'
  | 'interaction_checker'
  | 'explore_gemini'
  | 'medical_calculator' // Unlimited
  | 'nutrition_database'
  | 'learning_resources' // Access based, not count based
  | 'mind_map_maker'
  | 'clinical_scoring' // Unlimited
  | 'explore_deepseek'
  | 'explore_chatgpt';

// Define quota limits (null means unlimited or access-based)
const quotas: Record<UserLevel, Record<FeatureName, number | null>> = {
  Free: {
    ai_chatbot: 3,
    ai_peer_review: 3,
    disease_library: 3,
    drug_reference: 3,
    clinical_guidelines: 3,
    interaction_checker: 3,
    explore_gemini: 3,
    medical_calculator: null, // Unlimited
    nutrition_database: 3,
    learning_resources: 0, // No access (represented by 0 for simplicity, logic handled elsewhere)
    mind_map_maker: 2,
    clinical_scoring: null, // Unlimited
    explore_deepseek: 3,
    explore_chatgpt: 3,
  },
  Researcher: {
    ai_chatbot: 30,
    ai_peer_review: 15,
    disease_library: 20,
    drug_reference: 20,
    clinical_guidelines: 20,
    interaction_checker: 15,
    explore_gemini: 30,
    medical_calculator: null, // Unlimited
    nutrition_database: 20,
    learning_resources: null, // Full access (represented by null)
    mind_map_maker: 10,
    clinical_scoring: null, // Unlimited
    explore_deepseek: 30,
    explore_chatgpt: 30,
  },
  Master: {
    ai_chatbot: null,
    ai_peer_review: null,
    disease_library: null,
    drug_reference: null,
    clinical_guidelines: null,
    interaction_checker: null,
    explore_gemini: null,
    medical_calculator: null,
    nutrition_database: null,
    learning_resources: null,
    mind_map_maker: null,
    clinical_scoring: null,
    explore_deepseek: null,
    explore_chatgpt: null,
  },
  Administrator: { // Administrators likely have unlimited access
    ai_chatbot: null,
    ai_peer_review: null,
    disease_library: null,
    drug_reference: null,
    clinical_guidelines: null,
    interaction_checker: null,
    explore_gemini: null,
    medical_calculator: null,
    nutrition_database: null,
    learning_resources: null,
    mind_map_maker: null,
    clinical_scoring: null,
    explore_deepseek: null,
    explore_chatgpt: null,
  },
};

export const getQuotaLimit = (level: UserLevel | null, feature: FeatureName): number | null => {
  if (!level) {
    // Default to Free level quotas if level is null or undefined
    level = 'Free';
  }

  // Administrator and Master have unlimited access
  if (level === 'Administrator' || level === 'Master') {
    return null;
  }

  // For other levels, get from the quotas object, defaulting to Free if not found
  return quotas[level]?.[feature] ?? quotas['Free'][feature];
};

// Special check for Learning Resources access
export const hasLearningResourcesAccess = (level: UserLevel | null): boolean => {
    if (!level) return false; // No access if no level
    return level === 'Researcher' || level === 'Administrator' || level === 'Master';
};
