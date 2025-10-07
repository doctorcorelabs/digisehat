import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); // Updated to 2.5 Flash Lite

const generationConfig = {
  temperature: 0.7, // Adjust temperature for creativity vs. factuality
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192, // Adjust as needed
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const buildPrompt = (diseaseName: string, language: string = 'en'): string => {
  const mainInstruction = language === 'id'
    ? `**Tugas:** Hasilkan tinjauan komprehensif tentang kondisi medis yang ditentukan: **${diseaseName}** dalam Bahasa Indonesia.`
    : `**Task:** Generate a comprehensive overview of the specified medical condition: **${diseaseName}**.`;

  const contentRequirementInstruction = language === 'id'
    ? `Susun respons Anda menggunakan judul-judul (headings) dalam Bahasa Inggris berikut ini. Di bawah setiap judul, berikan informasi yang detail dan spesifik dalam Bahasa Indonesia seperti yang dijelaskan:` // Added "dalam Bahasa Indonesia"
    : `Structure your response using the following exact headings in English. Under each heading, provide detailed and specific information as described:`;

  return `
**SYSTEM INSTRUCTION**

**Role:** You are an AI medical information assistant designed to provide comprehensive, accurate, and well-structured summaries of medical conditions for an audience with a medical background (e.g., medical students, healthcare professionals).

${mainInstruction}

**Output Structure and Content Requirements:**
${contentRequirementInstruction}
${language === 'id' ? `\nPENTING: Semua penjelasan dan konten di bawah setiap judul Bahasa Inggris HARUS dalam Bahasa Indonesia.\n` : ''}
1.  **Etiology:**
    *   Clearly identify the primary cause(s) (e.g., infectious agents, genetic mutations, autoimmune processes, environmental factors, idiopathic).
    *   Be specific about pathogens, genes, or mechanisms where known.

2.  **Risk Factors:**
    *   List known risk factors associated with the condition.
    *   Categorize them where appropriate (e.g., modifiable vs. non-modifiable, demographic, genetic, environmental, lifestyle).
    *   Briefly explain the link between major risk factors and the condition, if well-established.

3.  **Pathogenesis:**
    *   Provide a step-by-step explanation of the mechanism by which the disease develops and progresses.
    *   Describe the key physiological, cellular, molecular, or immunological changes involved.
    *   Explain how the etiology and risk factors contribute to these pathological processes.

4.  **Clinical Manifestations:**
    *   Describe the common signs and symptoms associated with the condition.
    *   Include less common but significant manifestations if applicable.
    *   Describe the typical patient presentation and potential variations.
    *   Mention the usual course or progression of symptoms if untreated.

5.  **Physical Examination:**
    *   Detail the key findings expected during a physical examination relevant to this condition.
    *   Mention specific examination techniques or maneuvers that are important.
    *   Correlate findings with the underlying pathophysiology where relevant.

6.  **Supporting Investigations:**
    *   List relevant diagnostic tests (e.g., laboratory tests [blood, urine, CSF], imaging studies [X-ray, CT, MRI, Ultrasound], pathology/biopsy, specific functional tests, scoring systems).
    *   Specify the expected or characteristic findings for each key test.
    *   Briefly explain the diagnostic, staging, or prognostic value of these investigations.

7.  **Management:**
    *   Outline the primary goals of management (e.g., cure, symptom control, prevention of complications, quality of life improvement).
    *   Describe the main therapeutic approaches:
        *   Non-pharmacological interventions (lifestyle changes, diet, physiotherapy, etc.).
        *   Pharmacological treatments (specific drug classes, mechanisms, common examples, considerations for use).
        *   Procedural or surgical interventions, if applicable.
        *   Supportive care.
    *   Mention key monitoring strategies during and after treatment.
    *   Briefly touch upon prognosis if widely established.

**Tone and Style:**
*   Use precise and standard medical terminology.
*   Maintain an objective and informative tone.
*   Ensure information is based on current medical understanding and evidence where possible (though specific citations are not required unless explicitly asked).
*   Organize information logically within each section using bullet points or concise paragraphs.

**Constraint:** Focus solely on providing the requested information structured under the specified headings. Do not include introductory/concluding remarks beyond the structured content unless essential for clarity within a section. Do not provide medical advice.
`;
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let diseaseName: string;
  let language: string = 'en'; // Default to English
  try {
    const body = JSON.parse(event.body || '{}');
    diseaseName = body.diseaseName;
    if (body.language && (body.language === 'id' || body.language === 'en')) {
      language = body.language;
    }
    if (!diseaseName || typeof diseaseName !== 'string' || diseaseName.trim() === '') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid diseaseName in request body' }) };
    }
    console.log(`[Netlify Function] Received request for disease: ${diseaseName} in language: ${language}`); // Log received disease name and language
  } catch (error) {
    console.error("[Netlify Function] Error parsing request body:", error);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON in request body' }) };
  }

  const prompt = buildPrompt(diseaseName.trim(), language);
  console.log(`[Netlify Function] Generated prompt for Gemini in ${language}.`); // Log prompt generation

  try {
    console.log("[Netlify Function] Calling Gemini API..."); // Log before API call
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });
    console.log("[Netlify Function] Received response from Gemini API."); // Log after API call

    if (result.response) {
      const text = result.response.text();
      console.log("[Netlify Function] Raw text from Gemini API:", text); // Log the text
      // Check if the text is empty or just whitespace
      if (!text || text.trim() === "") {
        console.warn("[Netlify Function] Gemini API returned empty text.");
        return {
          statusCode: 200, // Still OK status, but indicate empty content
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ details: "" }), // Send empty details
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details: text }),
      };
    } else {
      // Handle cases where the response might be blocked or empty
      console.error("[Netlify Function] Gemini API response was empty or blocked:", result);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get valid response from AI model. It might have been blocked due to safety settings or other issues.' }),
      };
    }
  } catch (error: any) {
    console.error("[Netlify Function] Error calling Gemini API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error fetching details from AI model: ${error.message || 'Unknown error'}` }),
    };
  }
};

export { handler };
