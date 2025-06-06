import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

// Explicitly load .env file variables into process.env
dotenv.config();

// Access your API key as an environment variable (ensure this is set in Netlify)
console.log("Attempting to read GEMINI_API_KEY from process.env"); // ADD LOGGING
const API_KEY = process.env.GEMINI_API_KEY;
console.log("Value of GEMINI_API_KEY:", API_KEY ? "Exists (hidden)" : "NOT FOUND or empty"); // ADD LOGGING (don't log the key itself)

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
// Use the 'latest' model version for consistency
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let query: string | undefined;
  let language: string = 'en'; // Default to English
  try {
    const body = JSON.parse(event.body || '{}');
    query = body.query;
    if (body.language && (body.language === 'id' || body.language === 'en')) {
      language = body.language;
    }
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing or invalid 'query' parameter in request body." }) };
    }
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  let prompt: string;
  if (language === 'id') {
    prompt = `Berikan ringkasan singkat dan netral (sekitar 2-4 kalimat) tentang kondisi medis: "${query}". Fokus pada apa itu, gejala umum, dan penyebab umum. Jangan berikan saran medis atau rekomendasi pengobatan. Nyatakan bahwa informasi ini hanya untuk pengetahuan umum dan pengguna harus berkonsultasi dengan profesional kesehatan. Hasilkan ringkasan dalam Bahasa Indonesia.`;
  } else {
    prompt = `Provide a brief, neutral summary (around 2-4 sentences) about the medical condition: "${query}". Focus on what it is, common symptoms, and general causes. Do not provide medical advice or treatment recommendations. State that this information is for general knowledge only and users should consult healthcare professionals.`;
  }

  try {
    console.log(`Generating summary for query: ${query} in language: ${language}`);
    const result = await model.generateContent(prompt);
    const response = result.response;
    // Add check for response existence before accessing text()
    if (!response) {
        console.error("Error: Gemini API response object is missing.");
        throw new Error("Failed to get response from AI model.");
    }
    const text = response.text();
    console.log(`Generated text length: ${text.length}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: text }),
    };

  } catch (error: any) {
    console.error("Error calling Gemini API in summarize-disease:", error.message); // Log specific error
    let errorMessage = `Failed to generate summary for "${query}".`;
     if (error instanceof Error) {
        errorMessage += ` Error: ${error.message}`;
    }
    // Add more specific error handling if needed based on Gemini API errors

    return {
      statusCode: 500,
      // Return the actual error message from the API call if available
      body: JSON.stringify({ error: errorMessage, details: error.message || 'Unknown error during summary generation' }),
    };
  }
};

export { handler };
