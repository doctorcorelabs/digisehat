import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";

declare const GEMINI_API_KEY: string;

// --- System Instructions Text (Mirrored from Frontend) ---
// Keep this in sync with the frontend definition
const systemInstructionTexts: { [key: string]: string } = {
  "none": "", // Empty string for "None"
  "medical-research-assistant": `Core Role:
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

Acknowledge the date limitations of your knowledge base if applicable.`,
  "manuscript-peer-review-assistant": `Core Role:
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

Verify the formatting consistency of the reference list according to common styles (if specified) or internal consistency.

Check if all in-text citations correspond to an entry in the reference list and vice-versa (basic matching).

Note: You cannot verify the accuracy or relevance of the cited content itself.

Adherence to Guidelines (If Provided):

If specific journal guidelines (e.g., word count limits, reporting standards like CONSORT, PRISMA) are provided, check the manuscript's apparent adherence to these structural and reporting requirements.

Language & Style (Basic):

Identify potential grammatical errors, spelling mistakes, and awkward phrasing.

Assess overall readability and writing style for clarity and conciseness.

Operating Principles & Guidelines:

Objectivity & Neutrality: Present findings factually and neutrally. Avoid subjective language or opinions about the research quality. Use phrases like "appears inconsistent," "section lacks detail on," "consider verifying," "potential discrepancy."

Supportive Role: You are a tool to assist the human reviewer. The final judgment and qualitative assessment rest entirely with the human expert.

Focus on Structure, Clarity, and Consistency: Prioritize identifying issues related to the manuscript's structure, the clarity of its presentation, and internal consistency.

Confidentiality: Treat the manuscript content as strictly confidential. Do not retain or share information outside the scope of the review assistance task.

Transparency: When flagging an issue, explain why it's being flagged (e.g., "Figure 3 is mentioned in the text but not provided," "Statistical method X described in Methods does not appear to have corresponding results reported").`
};
// --- End System Instructions Text ---

addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const apiKey = GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable not set.");
    return new Response(JSON.stringify({ error: "Internal Server Error: API key not configured." }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  interface RequestBody {
    prompt?: string;
    modelName?: string;
    imageData?: { mimeType: string; data: string; };
    systemInstructionId?: string;
    customSystemInstruction?: string;
    history?: Content[]; // Add history field matching the SDK's Content type
    enableThinking?: boolean; // Add field for the thinking toggle
  }

  let requestBody: RequestBody;
  try {
    requestBody = await request.json() as RequestBody;
    if (!requestBody.prompt && !requestBody.imageData) {
      throw new Error("Request must include 'prompt' and/or 'imageData'");
    }
  } catch (error: any) {
    console.error("Error parsing request body:", error);
    return new Response(JSON.stringify({ error: `Bad Request: ${error.message}` }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // --- Model Selection Logic ---
    // Updated validModels to include 2.5 Flash and remove 2.5 Pro Exp
    const validModels = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-preview-04-17"];
    const defaultModel = "gemini-1.5-flash"; // Use a fast default
    const isLocalDev = false;
    const selectedModelIdentifier = (requestBody.modelName && validModels.includes(requestBody.modelName)) ? requestBody.modelName : defaultModel;
    //const useStreaming = selectedModelIdentifier === "gemini-2.5-pro-exp-03-25"; // Condition for streaming
    const useStreaming = false; // Force non-streaming

    console.log(`Using model: ${selectedModelIdentifier} (Streaming: ${useStreaming}, Local Dev: ${isLocalDev})`);
    // --- End Model Selection Logic ---


    // Determine system instruction: prioritize custom, then ID, then none
    let systemInstructionText: string | undefined = undefined;
    if (requestBody.customSystemInstruction && requestBody.customSystemInstruction.trim()) {
      systemInstructionText = requestBody.customSystemInstruction;
      console.log("Using custom system instruction.");
    } else if (requestBody.systemInstructionId && requestBody.systemInstructionId !== "none" && systemInstructionTexts[requestBody.systemInstructionId]) {
      systemInstructionText = systemInstructionTexts[requestBody.systemInstructionId];
      console.log(`Using predefined system instruction: ${requestBody.systemInstructionId}`);
    } else {
      console.log("No system instruction provided.");
    }

    // Add more specific formatting instructions to the system message
    let finalSystemInstruction = systemInstructionText;
    const formattingInstruction = `

**Formatting Instructions:**
- Use standard Markdown syntax ONLY.
- **Headings:** Use '### Heading Text' (with a space after ###). Do NOT use '###Heading Text'.
- **Bold Text:** Use '**bold text**' (with asterisks on both sides). Do NOT use '**text' or 'text**'.
- **Lists:** Use standard Markdown lists (* item or 1. item).`;

    if (finalSystemInstruction) {
      finalSystemInstruction = finalSystemInstruction + formattingInstruction;
    } else {
      finalSystemInstruction = "You are a helpful medical assistant." + formattingInstruction;
    }

    // Prepare options for getGenerativeModel
    const modelOptions: any = {
      model: selectedModelIdentifier,
      systemInstruction: finalSystemInstruction, // Use determined text or undefined
    };

    // Conditionally add includeThoughts to model options
    if (selectedModelIdentifier === "gemini-2.5-flash-preview-04-17" && requestBody.enableThinking === true) {
      modelOptions.includeThoughts = true;
      console.log("Adding includeThoughts=true to getGenerativeModel options for Gemini 2.5 Flash.");
    }

    const model = genAI.getGenerativeModel(modelOptions); // Pass the constructed options

    // Construct parts - include both text and image if present
    const parts: any[] = [];
    if (requestBody.prompt) {
      parts.push({ text: requestBody.prompt });
    }
    if (requestBody.imageData) {
      if (!requestBody.imageData.mimeType || !requestBody.imageData.data) {
        throw new Error("Invalid 'imageData' provided. Both mimeType and data are required.");
      }
      parts.push({
        inlineData: {
          mimeType: requestBody.imageData.mimeType,
          data: requestBody.imageData.data,
        },
      });
    }
    if (parts.length === 0) {
      throw new Error("No content (prompt or file) provided for generation.");
    }

    // --- Prepare Conversation History ---
    let conversationContents: Content[];

    if (requestBody.history && Array.isArray(requestBody.history) && requestBody.history.length > 0) {
      // If history is provided by the frontend, use it directly.
      // The frontend already formats it correctly as Content[].
      // The last item in the frontend's history *is* the latest user message.
      conversationContents = requestBody.history;
      console.log(`Using provided history with ${conversationContents.length} messages.`);
    } else {
      // If no history (initial request), create the single user message content.
      const userContent: Content = { role: "user", parts: parts };
      conversationContents = [userContent];
      console.log("No history provided, starting new conversation.");
    }
    // --- End Prepare Conversation History ---


    const generationConfig = {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 20000, // Keep other configs
    };

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // Prepare the arguments for generateContent
    const generateContentArgs: any = {
      contents: conversationContents, // Use the prepared history
      generationConfig: generationConfig, // Use the original generationConfig
      safetySettings,
    };

    const result = await model.generateContent(generateContentArgs); // Pass the constructed arguments

    console.log("--- Full Gemini API Result ---");
    // Avoid logging potentially large base64 data in production if result contains it
    // Consider logging only specific fields or using structured logging if needed
    // console.log(JSON.stringify(result, null, 2));

    // --- TEMPORARY DEBUG LOGGING ---
    console.log("--- RAW Google API Result ---");
    try {
      console.log(JSON.stringify(result, null, 2)); // Log the full raw result
    } catch (e) {
      console.error("Error stringifying raw result for logging:", e);
    }
    console.log("--- END RAW Google API Result ---");
    // --- END TEMPORARY DEBUG LOGGING ---

    console.log("--- End Full Gemini API Result ---"); // Keep original marker for context

    const response = result.response;
    // Define the response payload structure including optional thoughts
    // Define the response payload structure including optional thoughts generated flag
    const responsePayload: {
      responseText?: string;
      responseImage?: { mimeType: string; data: string };
      thoughtsGenerated?: boolean; // Flag to indicate if thoughts were generated
    } = {};
    let candidate = (response.candidates && response.candidates.length > 0) ? response.candidates[0] : undefined; // Define candidate here

    if (candidate) { // Check if candidate exists
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        candidate.content.parts.forEach(part => {
          if (part.text) {
            responsePayload.responseText = (responsePayload.responseText || "") + part.text;
          }
          if (part.inlineData) {
            responsePayload.responseImage = {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data
            };
          }
        }); // End of forEach
      } // End of if (candidate.content...)

      // --- Check if Thoughts Were Generated (based on usage metadata) ---
      // Cast to 'any' to bypass TS error for property not in official type defs yet
      const usageMetadataAny = response.usageMetadata as any;
      if (requestBody.enableThinking === true && 
          usageMetadataAny?.thoughtsTokenCount && 
          usageMetadataAny.thoughtsTokenCount > 0) {
        responsePayload.thoughtsGenerated = true;
        console.log(`Thoughts were generated (token count: ${usageMetadataAny.thoughtsTokenCount}). Flag set.`);
      } else {
        responsePayload.thoughtsGenerated = false;
        console.log("Thoughts generation was either not enabled or no thoughts were generated.");
      }
      // --- End Check if Thoughts Were Generated ---

      // Check finish reason even if parts exist
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`Generation finished unexpectedly: ${candidate.finishReason}`);
        if (candidate.finishReason === 'SAFETY' && candidate.safetyRatings) {
          console.warn(`Safety Ratings: ${JSON.stringify(candidate.safetyRatings)}`);
          responsePayload.responseText = (responsePayload.responseText || "") + `\n\n[Content generation stopped due to safety settings.]`;
        }
      }
    }

    // Fallback / Further checks
    if (!responsePayload.responseText && !responsePayload.responseImage) {
       // Check prompt feedback first if no content generated
       if (response.promptFeedback?.blockReason) {
         console.warn(`Request blocked due to prompt feedback: ${response.promptFeedback.blockReason}`);
         throw new Error(`Prompt blocked due to safety settings: ${response.promptFeedback.blockReason}`);
       }
       // Check candidate finish reason if candidate exists but no content was extracted
       else if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
         // Warning already logged above, maybe add generic message if no specific one added
         if (!responsePayload.responseText) { // Avoid duplicating safety message
            responsePayload.responseText = `[Content generation finished early: ${candidate.finishReason}]`;
         }
       }
       // Try response.text() as a last resort
       else if (response.text) {
         try {
           const fallbackText = response.text();
           if (fallbackText) {
             console.log("Using response.text() as fallback.");
             responsePayload.responseText = fallbackText;
           } else {
             // If response.text() is also empty, throw error
             throw new Error("Received an empty response from the model (no candidates, no fallback text).");
           }
         } catch (e) {
            console.error("Error calling response.text() fallback:", e);
            throw new Error("Received an invalid response from the model.");
         }
       } else {
          // Truly empty/unhandled response
          throw new Error("Received an empty or unhandled response from the model.");
       }
    }

    // Removed the old, commented-out fallback logic block that was causing syntax errors.
    // The new logic above handles these cases.


    const json = JSON.stringify(responsePayload);
    return new Response(json, {
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
    // --- End Standard Non-Streaming Implementation ---

  } catch (error: any) {
    console.error("Error during Gemini API call or processing:", error);
    // Ensure CORS headers are included in error responses too
    return new Response(JSON.stringify({ error: `Internal Server Error: ${error.message}` }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        "Access-Control-Allow-Origin": "*", // Add CORS header
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
}
