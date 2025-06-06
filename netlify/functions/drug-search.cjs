// Use node-fetch v2.x with CommonJS syntax
const fetch = require('node-fetch');
// Import Google Generative AI
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// --- Configuration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Use a standard, valid Gemini model name
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest"; 
// Fields to potentially supplement with AI
const FIELDS_TO_SUPPLEMENT = [
  'indications_and_usage',
  'boxed_warning', // Note: AI generation for warnings needs extra caution
  'mechanism_of_action',
  'contraindications',
  'dosage_forms_and_strengths',
  'adverse_reactions'
];
// Safety settings for Gemini (adjust as needed, blocking harmful content)
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
// --- End Configuration ---

// Initialize Gemini Client (only if API key is present)
let genAI;
let geminiModel;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME, safetySettings });
    console.log(`[drug-search] Gemini client initialized with model: ${GEMINI_MODEL_NAME}`);
  } catch (initError) {
     console.error(`[drug-search] Failed to initialize Gemini client with model ${GEMINI_MODEL_NAME}:`, initError);
     // Consider falling back to a default model if initialization fails? For now, just log.
     geminiModel = null; 
  }
} else {
  console.warn("[drug-search] GEMINI_API_KEY environment variable not set. AI supplementation disabled.");
}

// Generic helper function to call Gemini
async function callGemini(prompt, purpose = "AI operation") {
  if (!geminiModel) {
    console.log(`[drug-search] Gemini model not available, skipping ${purpose}.`);
    return null;
  }
  console.log(`[drug-search] Calling Gemini for ${purpose}. Prompt: "${prompt.substring(0,100)}..."`);
  try {
    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    console.log(`[drug-search] Gemini response received for ${purpose}.`);
    return text.trim();
  } catch (error) {
    console.error(`[drug-search] Gemini API error during ${purpose}:`, error);
    if (error.message && error.message.includes('response was blocked')) {
      return `AI response blocked due to safety settings during ${purpose}.`;
    }
    return `Error during ${purpose}: ${error.message}`;
  }
}

// Helper function to call Gemini for supplementation
async function getAiSupplement(drugIdentifier, fieldName) {
  if (!geminiModel) {
    // This check is now redundant due to callGemini, but kept for clarity in this specific function's log
    console.log(`[drug-search] Gemini model not available, skipping AI supplement for ${fieldName}.`);
    return null;
  }

  // Simple mapping for prompts - can be refined
  const fieldDescriptionMap = {
    'indications_and_usage': 'indications and usage',
    'boxed_warning': 'boxed warning (if any)',
    'mechanism_of_action': 'mechanism of action',
    'contraindications': 'contraindications',
    'dosage_forms_and_strengths': 'dosage forms and strengths',
    'adverse_reactions': 'common adverse reactions'
  };

  const description = fieldDescriptionMap[fieldName] || fieldName.replace(/_/g, ' ');
  const prompt = `What is the ${description} for the drug "${drugIdentifier}"? Provide a concise summary suitable for a drug reference. If no specific information is typically available for this field (e.g., boxed warning for a drug without one), state that clearly. Focus on factual medical information.`;
  return callGemini(prompt, `supplementation for ${fieldName} of ${drugIdentifier}`);
}


// Main handler function
module.exports.handler = async function(event, context) {
  const drugName = event.queryStringParameters.term;
  const targetLang = event.queryStringParameters.lang || 'en'; // Default to English if lang is not provided

  console.log(`[drug-search] Received request for drug: "${drugName}", target language: "${targetLang}"`);

  if (!drugName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing search term' }) };
  }

  const encodedDrugName = encodeURIComponent(drugName.trim());
  const apiUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodedDrugName}"+openfda.generic_name:"${encodedDrugName}"&limit=1`;
  console.log(`[drug-search] Fetching URL: ${apiUrl}`);

  try {
    // 1. Fetch from OpenFDA
    const response = await fetch(apiUrl);
    console.log(`[drug-search] OpenFDA Response Status: ${response.status}`);
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[drug-search] Failed to parse OpenFDA JSON response:", responseText.substring(0, 500));
      return { statusCode: 500, body: JSON.stringify({ error: `Failed to parse OpenFDA response. Status: ${response.status}` }) };
    }

    if (!response.ok) {
      const errorBody = data.error ? data.error.message : `HTTP error ${response.status}`;
      console.error("[drug-search] OpenFDA API Error:", errorBody, "| Raw Response:", responseText.substring(0, 500));
      return { statusCode: response.status, body: JSON.stringify({ error: `OpenFDA API Error: ${errorBody}` }) };
    }

    if (!data.results || data.results.length === 0) {
      console.log(`[drug-search] No results found via OpenFDA for term: ${drugName}.`);
      return { statusCode: 404, body: JSON.stringify({ message: 'No results found' }) };
    }

    // 2. Process the result and supplement with AI if needed
    let resultData = data.results[0];
    console.log(`[drug-search] Found OpenFDA result for: ${drugName}`);

    // Determine a good identifier for the AI prompt (prefer brand name, fallback to generic)
    const drugIdentifier = resultData.openfda?.brand_name?.[0] || resultData.openfda?.generic_name?.[0] || drugName;

    // Process fields: structure as { text: '...', source: 'fda'/'ai' }
    const processedResult = { ...resultData }; // Clone the result
    const supplementPromises = [];

    for (const field of FIELDS_TO_SUPPLEMENT) {
      const fdaValue = resultData[field]?.[0]; // Get the first item if array exists

      if (fdaValue && fdaValue.trim() !== '') {
        // Field exists in FDA data
        processedResult[field] = [{ text: fdaValue, source: 'fda' }];
      } else if (geminiModel) {
        // Field missing or empty in FDA data, schedule AI supplement
        console.log(`[drug-search] Field '${field}' missing in FDA data for ${drugIdentifier}. Scheduling AI supplement.`);
        supplementPromises.push(
          getAiSupplement(drugIdentifier, field).then(aiText => {
            // This assignment happens once the promise resolves
            if (aiText && !aiText.toLowerCase().startsWith('error') && !aiText.toLowerCase().includes('blocked')) {
              processedResult[field] = [{ text: aiText, source: 'ai' }];
            } else {
              processedResult[field] = [{ text: aiText || 'Information not available from FDA or AI.', source: 'unavailable' }]; // Use aiText if it's an error message
            }
          }).catch(err => {
            console.error(`[drug-search] Error during AI supplement for ${field}:`, err);
            processedResult[field] = [{ text: 'Error during AI supplementation.', source: 'unavailable' }];
          })
        );
      } else {
         // Field missing and AI disabled/unavailable
         processedResult[field] = [{ text: 'Information not available from FDA.', source: 'unavailable' }];
      }
    }

    // Wait for all supplementations to complete
    if (supplementPromises.length > 0) {
      console.log(`[drug-search] Waiting for ${supplementPromises.length} AI supplementation(s) to complete...`);
      await Promise.all(supplementPromises);
      console.log("[drug-search] All AI supplementations completed.");
    }
    
    // Also ensure openfda fields are structured if they exist, default source 'fda'
    if (processedResult.openfda) {
        for (const key in processedResult.openfda) {
            if (Array.isArray(processedResult.openfda[key])) {
                 processedResult.openfda[key] = processedResult.openfda[key].map(item => {
                    // If it's already an object with text/source, keep it, otherwise structure it
                    return (typeof item === 'object' && item.text !== undefined) ? item : { text: item, source: 'fda' };
                 });
            }
        }
    }

    // 3. Translate fields if targetLang is 'id'
    if (targetLang === 'id' && geminiModel) {
      console.log(`[drug-search] Translating content to Indonesian for: ${drugIdentifier}`);
      const translationPromises = [];

      for (const field of FIELDS_TO_SUPPLEMENT) {
        if (processedResult[field] && processedResult[field][0] && processedResult[field][0].text) {
          const originalText = processedResult[field][0].text;
          const originalSource = processedResult[field][0].source;

          // Skip translation if source is 'unavailable' or text is a known "not available" message
          if (originalSource === 'unavailable' || originalText.toLowerCase().includes('not available') || originalText.toLowerCase().includes('information not available')) {
            console.log(`[drug-search] Skipping translation for '${field}' as it's marked unavailable or has no content.`);
            continue;
          }
          
          // Also skip translation for AI error messages
          if (originalText.toLowerCase().startsWith('error') || originalText.toLowerCase().includes('blocked')) {
            console.log(`[drug-search] Skipping translation for '${field}' as it contains an AI error/blocked message.`);
            continue;
          }

          const translationPrompt = `Provide a single, formal Indonesian translation for the following English medical text. Do not offer multiple options or explanations. Text to translate: "${originalText}"`;
          translationPromises.push(
            callGemini(translationPrompt, `translation for ${field} of ${drugIdentifier}`).then(translatedText => {
              if (translatedText && !translatedText.toLowerCase().startsWith('error') && !translatedText.toLowerCase().includes('blocked')) {
                processedResult[field] = [{ text: translatedText, source: originalSource }];
                console.log(`[drug-search] Successfully translated '${field}' to Indonesian.`);
              } else {
                console.warn(`[drug-search] Failed to translate '${field}' for ${drugIdentifier}. Original text will be used. Reason: ${translatedText}`);
                // Keep original text if translation fails or is an error message
              }
            }).catch(err => {
              console.error(`[drug-search] Error during translation for ${field}:`, err);
              // Keep original text if an unexpected error occurs in the promise itself
            })
          );
        }
      }
      // Wait for all translations to complete
      if (translationPromises.length > 0) {
        console.log(`[drug-search] Waiting for ${translationPromises.length} translation(s) to complete...`);
        await Promise.all(translationPromises);
        console.log("[drug-search] All translations completed.");
      }

    } else if (targetLang === 'id' && !geminiModel) {
      console.warn(`[drug-search] Translation to Indonesian requested for ${drugIdentifier}, but Gemini model is not available. Returning English content.`);
    }

    console.log(`[drug-search] Returning processed (and potentially translated) result for: ${drugName}`);
    return {
      statusCode: 200,
      body: JSON.stringify(processedResult),
    };

  } catch (error) {
    console.error('[drug-search] Netlify function execution error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch or process drug data via serverless function.' }),
    };
  }
};
