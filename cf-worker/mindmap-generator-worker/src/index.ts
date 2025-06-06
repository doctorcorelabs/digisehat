import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Define the expected environment variables/secrets
export interface Env {
	GEMINI_API_KEY: string; // Store your API key as a secret
}

// Define the expected request body structure
interface RequestBody {
	topic?: string;
	language?: string; // Added language field
}

// Define the structure for MindMap data (matching React Flow)
interface MindMapData {
	nodes: { id: string; data: { label: string }; position: { x: number; y: number } }[];
	edges: { id: string; source: string; target: string; type?: string }[];
}

// Define the structure for the worker's response
interface WorkerResponse {
  summary: string;
  mindMap: MindMapData;
}

// --- Helper Function to call Gemini ---
async function callGemini(apiKey: string, prompt: string): Promise<string> {
	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Or 'gemini-pro'

	const generationConfig = {
		temperature: 0.6,
		topK: 1,
		topP: 1,
		maxOutputTokens: 8192,
	};

	const safetySettings = [
		{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
		{ category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
		{ category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
		{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
	];

	const parts = [{ text: prompt }];

	try {
		const result = await model.generateContent({
			contents: [{ role: 'user', parts }],
			generationConfig,
			safetySettings,
		});
		return result.response.text();
	} catch (error) {
		console.error('Error during Gemini API call:', error);
		// Rethrow a more specific error or handle as needed
		throw new Error(`Gemini API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

// --- Main Fetch Handler ---
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return handleOptions(request);
		}

		// Only allow POST requests
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
		}

		// Check content type
		if (request.headers.get('content-type') !== 'application/json') {
			return new Response('Expected Content-Type: application/json', { status: 415, headers: corsHeaders() });
		}

		let requestBody: RequestBody;
		try {
			requestBody = await request.json();
		} catch (e) {
			return new Response('Invalid JSON body', { status: 400, headers: corsHeaders() });
		}

		const topic = requestBody.topic;
		const language = requestBody.language || 'en'; // Default to 'en' if not provided

		if (!topic || typeof topic !== 'string' || topic.trim() === '') {
			return new Response('Missing or invalid "topic" in request body', { status: 400, headers: corsHeaders() });
		}

		if (!env.GEMINI_API_KEY) {
			console.error('GEMINI_API_KEY is not set in environment secrets.');
			return new Response('Internal Server Error: API Key not configured', { status: 500, headers: corsHeaders() });
		}

		try {
			// --- Stage 1: Generate Summary ---
			const languageInstruction = language === 'id'
				? "Please provide the summary in Indonesian."
				: "Please provide the summary in English.";

			const summaryPrompt = `
Generate a concise and informative summary (around 100-150 words) about the medical topic: "${topic}".
${languageInstruction}
Focus on key aspects like definition, main causes or types, common symptoms, and general treatment principles if applicable.
Ensure the summary is clear and easy to understand. Output only the summary text.`;

			console.log(`Requesting summary for: "${topic}" in language: ${language}`);
			const summaryText = await callGemini(env.GEMINI_API_KEY, summaryPrompt);
			if (!summaryText || summaryText.trim() === '') {
				throw new Error('Received empty summary from AI.');
			}
			console.log("Received summary.");

			// --- Stage 2: Generate Mind Map from Summary ---
			const mindMapPrompt = `
Based on the following summary text:
"${summaryText}"

Create a mind map structure in valid JSON format suitable for React Flow. The JSON object MUST strictly adhere to this structure:
{
  "nodes": [
    { "id": "string (unique)", "data": { "label": "string (node text)" }, "position": { "x": 0, "y": 0 } }
    // ... more nodes based on the summary
  ],
  "edges": [
    { "id": "string (unique)", "source": "string (source node id)", "target": "string (target node id)", "type": "smoothstep" }
    // ... more edges connecting the nodes
  ]
}

Rules:
- The root node MUST have id "root" and its label should be the original topic: "${topic}".
- Extract key concepts, sub-topics, and relationships from the summary text to create the nodes and edges.
- Generate unique string IDs for all nodes and edges (e.g., "node-1", "edge-root-1").
- Ensure all 'source' and 'target' IDs in 'edges' correspond to valid 'id's in 'nodes'.
- Set all node positions to { x: 0, y: 0 }; layouting will happen in the frontend.
- CRITICAL JSON RULES:
  - Ensure every object within the 'nodes' array is separated by a comma (,), except for the last object.
  - Ensure every object within the 'edges' array is separated by a comma (,), except for the last object.
  - All property names (like "id", "data", "label", "position", "x", "y", "source", "target", "type") MUST be enclosed in double quotes ("").
  - All string values MUST be enclosed in double quotes ("").
- Output ONLY the JSON object, without any introductory text, explanations, or markdown formatting like \`\`\`json.
`;

			console.log("Requesting mind map based on summary.");
			const mindMapResponseText = await callGemini(env.GEMINI_API_KEY, mindMapPrompt);

			// Attempt to parse the Mind Map JSON response
			let mindMapData: MindMapData;
			try {
				// Use regex to extract the main JSON block
				const jsonMatch = mindMapResponseText.match(/\{[\s\S]*\}/);
				if (!jsonMatch || !jsonMatch[0]) {
					console.error('Raw Mind Map Response:', mindMapResponseText);
					throw new Error('Could not find valid JSON block in Mind Map AI response.');
				}
				const jsonString = jsonMatch[0];
				mindMapData = JSON.parse(jsonString);

				// Basic validation
				if (!Array.isArray(mindMapData.nodes) || !Array.isArray(mindMapData.edges)) {
					throw new Error('Invalid Mind Map JSON structure after parsing: missing nodes or edges array.');
				}
			} catch (parseError) {
				console.error('Failed to parse Mind Map AI response as JSON:', parseError);
				console.error('Raw Mind Map Response:', mindMapResponseText);
				return new Response('Internal Server Error: Failed to process Mind Map AI response', { status: 500, headers: corsHeaders() });
			}
			console.log("Received and parsed mind map data.");

			// --- Combine and Return Response ---
			const finalResponse: WorkerResponse = {
				summary: summaryText.trim(), // Trim the summary text
				mindMap: mindMapData,
			};

			return new Response(JSON.stringify(finalResponse), {
				headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
				status: 200,
			});

		} catch (error) {
			console.error('Error during two-stage generation process:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown internal error';
			// Provide a more informative error message to the client if possible
			return new Response(`Internal Server Error: ${errorMessage}`, { status: 500, headers: corsHeaders() });
		}
	},
};

// Helper function for CORS headers (remains the same)
function corsHeaders(): HeadersInit {
	return {
		'Access-Control-Allow-Origin': '*', // Be more specific in production!
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};
}

// Handle CORS preflight requests (remains the same)
function handleOptions(request: Request): Response {
	if (
		request.headers.get('Origin') !== null &&
		request.headers.get('Access-Control-Request-Method') !== null &&
		request.headers.get('Access-Control-Request-Headers') !== null
	) {
		return new Response(null, { headers: corsHeaders() });
	} else {
		return new Response(null, { headers: { Allow: 'POST, OPTIONS' } });
	}
}
