import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";

// Define the expected environment variables (bindings)
export interface Env {
	GEMINI_API_KEY: string;
}

// Define the expected request body structure (mirroring frontend)
interface RequestBody {
	prompt?: string; // For general queries/image analysis
	textToSummarize?: string; // For summarization requests
	modelName?: string;
	imageData?: { mimeType: string; data: string; };
	systemInstructionId?: string;
	customSystemInstruction?: string;
	messages?: Content[]; // Add messages array for chat history (Content type from @google/generative-ai)
}

// Define system instructions (keep in sync with frontend/other backend if needed)
const systemInstructionTexts: { [key: string]: string } = {
  "none": "",
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

// Helper function to create JSON response with CORS headers
function createJsonResponse(data: any, status: number = 200, corsOrigin: string = '*') {
	return new Response(JSON.stringify(data), {
		status: status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': corsOrigin, // Allow requests from specified origin
			'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS (for preflight)
			'Access-Control-Allow-Headers': 'Content-Type', // Allow Content-Type header
		},
	});
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// --- CORS Preflight Handling ---
		// Browsers send an OPTIONS request first to check CORS policy
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204, // No Content
				headers: {
					'Access-Control-Allow-Origin': '*', // Be permissive for preflight, adjust if needed
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day
				},
			});
		}

		// --- Main Request Handling ---
		if (request.method !== 'POST') {
			return createJsonResponse({ error: 'Method Not Allowed' }, 405);
		}

		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) {
			console.error("GEMINI_API_KEY environment variable not set in Cloudflare Worker.");
			return createJsonResponse({ error: 'Internal Server Error: API key not configured.' }, 500);
		}

		let requestBody: RequestBody;
		try {
			requestBody = await request.json();
			// Check if we have messages OR prompt/image OR text to summarize
			if (!requestBody.messages?.length && !requestBody.prompt && !requestBody.imageData && !requestBody.textToSummarize) {
				throw new Error("Request must include 'messages' OR 'prompt'/'imageData' OR 'textToSummarize'");
			}
		} catch (error: any) {
			console.error('Error parsing request body:', error);
			return createJsonResponse({ error: `Bad Request: ${error.message}` }, 400);
		}

		try {
			const genAI = new GoogleGenerativeAI(apiKey);

			const validModels = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-pro-exp-03-25"];
			const defaultModel = "gemini-2.5-flash-lite"; // Use 2.5 Flash Lite as default
			const selectedModelIdentifier = (requestBody.modelName && validModels.includes(requestBody.modelName)) ? requestBody.modelName : defaultModel;
			console.log(`CF Worker using model: ${selectedModelIdentifier}`); // No forcing needed here

			let systemInstructionText: string | undefined = undefined;
			if (requestBody.customSystemInstruction && requestBody.customSystemInstruction.trim()) {
				systemInstructionText = requestBody.customSystemInstruction;
			} else if (requestBody.systemInstructionId && requestBody.systemInstructionId !== "none" && systemInstructionTexts[requestBody.systemInstructionId]) {
				systemInstructionText = systemInstructionTexts[requestBody.systemInstructionId];
			}

			const model = genAI.getGenerativeModel({
				model: selectedModelIdentifier,
				systemInstruction: systemInstructionText,
			});

			const generationConfig = { temperature: 0.9, topK: 1, topP: 1 }; // Removed maxOutputTokens
			const safetySettings = [
				{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
				{ category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
				{ category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
				{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
			];
			// --- Determine API call based on input ---
			let result;
			if (requestBody.messages && requestBody.messages.length > 0) {
				// --- Chat History Call ---
				console.log("Handling chat history request.");

				// Ensure messages have valid roles and parts (basic validation)
				const validMessages = requestBody.messages.filter(msg =>
					(msg.role === 'user' || msg.role === 'model') && Array.isArray(msg.parts) && msg.parts.length > 0
				);
				if (validMessages.length !== requestBody.messages.length) {
					console.warn("Some messages in the history were invalid and filtered out.");
				}
				if (validMessages.length === 0) {
					throw new Error("No valid messages provided in the 'messages' array.");
				}

				result = await model.generateContent({
					contents: validMessages, // Pass the validated history
					generationConfig,
					safetySettings,
				});

			} else {
				// --- Single Turn Call (Fallback if no messages) ---
				console.log("Handling single turn request (no messages array found).");

				// Determine the actual prompt based on request type
				let effectivePrompt: string;
				if (requestBody.textToSummarize) {
					effectivePrompt = `Please summarize the following drug interaction information concisely for a healthcare professional, focusing on the key risks and recommendations:\n\n"${requestBody.textToSummarize}"`;
					console.log("Handling summarization request.");
				} else if (requestBody.prompt) {
					effectivePrompt = requestBody.prompt;
					console.log("Handling general prompt/image request.");
				} else {
					// This case should ideally not be reached due to the initial check,
					// but throw a specific error if it does.
					throw new Error("No valid single-turn input (prompt, imageData, or textToSummarize) found after checking for messages.");
				}

				const parts: any[] = [];
				parts.push({ text: effectivePrompt });

				// Add image data only if it's NOT a summarization request
				if (!requestBody.textToSummarize && requestBody.imageData) {
					if (!requestBody.imageData.mimeType || !requestBody.imageData.data) {
						throw new Error("Invalid 'imageData' provided for single turn.");
					}
					parts.push({
						inlineData: {
							mimeType: requestBody.imageData.mimeType,
							data: requestBody.imageData.data,
						},
					});
				}

				// Check if parts array is actually populated (should be due to logic above)
				if (parts.length === 0) {
					throw new Error("Internal error: No content parts generated for single turn.");
				}

				const userContent: Content = { role: "user", parts: parts };

				result = await model.generateContent({
					contents: [userContent], // Pass single user content
					generationConfig,
					safetySettings,
				});
			}
			// --- End API Call Logic ---

			const response = result.response;
			const responsePayload: { responseText?: string; responseImage?: { mimeType: string; data: string } } = {};

			if (response.candidates && response.candidates.length > 0) {
				const candidate = response.candidates[0];
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
					});
				}
			}
			if (!responsePayload.responseText && !responsePayload.responseImage && response.text) {
				responsePayload.responseText = response.text();
			}

			// Allow requests from any origin for simplicity, restrict in production if needed
			const allowedOrigin = '*';
			// For local testing, you might use:
			// const allowedOrigin = request.headers.get('Origin') || '*';
			// For production, replace '*' with your Netlify site URL:
			// const allowedOrigin = 'https://your-netlify-site.netlify.app';

			return createJsonResponse(responsePayload, 200, allowedOrigin);

		} catch (error: any) {
			console.error("Error calling Gemini API via CF Worker:", error);
			return createJsonResponse({ error: `Internal Server Error: Failed to generate content. ${error.message}` }, 500);
		}
	},
};
