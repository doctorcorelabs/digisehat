/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;

	// Add secrets for API keys if needed, e.g.:
	// OPENFDA_API_KEY: string;
}

// Interface for the relevant part of the RxNorm approximateTerm response
interface RxNormApproxResponse {
  approximateGroup?: {
    candidate?: Array<{
      rxcui?: string;
      score?: string; // Score might also be useful
    }>;
  };
}

// Interface for relevant parts of OpenFDA label response
interface OpenFDAResponse {
	results?: Array<{
		id: string; // Label ID
		spl_id?: string; // SPL ID
		set_id?: string; // Set ID
		effective_time?: string;
		openfda?: {
			brand_name?: string[];
			generic_name?: string[];
			manufacturer_name?: string[];
			product_ndc?: string[];
			rxcui?: string[];
			spl_set_id?: string[];
			unii?: string[];
		};
		// Sections we might care about for interactions
		drug_interactions?: string[]; // Often narrative text
		warnings?: string[];
		// ... other sections like adverse_reactions, contraindications etc.
	}>;
	error?: {
		code: string;
		message: string;
	};
	meta?: {
		// Metadata like total results, skip, limit
	};
}


interface InteractionResult {
  pair: string[];
  severity: string;
  description: string;
}

// Helper function for CORS headers
function handleOptions(request: Request) {
  const headers = request.headers;
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS preflight requests.
    const origin = request.headers.get('Origin');
    const allowedOrigins = ['https://daivanlabs.com', 'http://localhost:8888', 'http://localhost:8787', 'https://nucleai.daivanlabs.com', 'https://digisehat.daivanlabs.com'];
    let allowOrigin = 'http://localhost:8888';
    if (origin && allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    }

    const respHeaders = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': headers.get('Access-Control-Request-Headers') || 'Content-Type',
      'Access-Control-Max-Age': '86400', // Cache preflight for 1 day
      'Access-Control-Allow-Credentials': 'true'
    };
    return new Response(null, { headers: respHeaders });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: 'POST, OPTIONS',
      },
    });
  }
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
		  return handleOptions(request);
		}

		// Allow only POST requests for interaction checking
		if (request.method !== 'POST') {
		  return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST, OPTIONS' } });
		}

		// Define CORS headers for the actual response
    const origin = request.headers.get('Origin');
    const allowedOrigins = ['https://daivanlabs.com', 'http://localhost:8888', 'http://localhost:8787', 'https://nucleai.daivanlabs.com', 'https://digisehat.daivanlabs.com'];
    let allowOrigin = 'http://localhost:8888';
    if (origin && allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    }
		const corsHeaders = {
		  'Access-Control-Allow-Origin': allowOrigin,
		  'Access-Control-Allow-Methods': 'POST, OPTIONS',
		  'Access-Control-Allow-Headers': 'Content-Type',
		  'Access-Control-Allow-Credentials': 'true'
		};

		try {
			const body = await request.json<{ drugs?: string[] }>();
			const drugs = body?.drugs;

			if (!drugs || !Array.isArray(drugs) || drugs.length < 2) {
				return new Response(JSON.stringify({ error: 'Please provide an array of at least two drug names in the "drugs" field.' }), {
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			const validDrugs = drugs.map(d => String(d).trim()).filter(d => d.length > 0);
			if (validDrugs.length < 2) {
				return new Response(JSON.stringify({ error: 'Please provide at least two non-empty drug names.' }), {
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			console.log('Received drugs for interaction check:', validDrugs);

			// --- API Logic ---
			// 1. Convert drug names to RxCUIs using NIH RxNorm API.
			const rxcuiMap = await getRxCUIs(validDrugs, env);
			const rxcuis = Object.values(rxcuiMap).filter(Boolean) as string[]; // Get valid RxCUIs

			if (rxcuis.length < 2 && validDrugs.length >= 2) { // Check original names length too
				// Handle case where not enough drugs could be identified via RxCUI
				console.warn('Could not identify at least two drugs via RxCUI:', rxcuiMap);
                // Proceed using names only for the OpenFDA query
			}

			// 2. Call OpenFDA API with RxCUIs and original names to get interaction data.
			const interactionData = await fetchOpenFDAInteractions(rxcuis, validDrugs, env);

			// Handle potential errors from OpenFDA fetch
			if (interactionData.error) {
				if (interactionData.error.code === 'NOT_FOUND') {
					return new Response(JSON.stringify({ interactions: [] }), {
						status: 200,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
				}
				return new Response(JSON.stringify({ error: `OpenFDA API Error: ${interactionData.error.message}` }), {
					status: 502, // Bad Gateway might be appropriate
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			// 3. Parse interactionData and format into InteractionResult[]
			const results: InteractionResult[] = parseInteractions(interactionData, rxcuiMap, validDrugs);


			return new Response(JSON.stringify({ interactions: results }), {
				status: 200,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});

		} catch (error: any) { // Explicitly type error as any (or unknown)
			console.error('Error processing interaction check:', error);
			let errorMessage = 'An unexpected error occurred.';
			if (error instanceof SyntaxError) {
				errorMessage = 'Invalid JSON payload received.';
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}
			return new Response(JSON.stringify({ error: errorMessage }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
	},
};

// --- Implemented & Placeholder Functions ---

/**
 * Converts drug names to RxCUIs using the NIH RxNorm API.
 * Returns a map of original drug name to its RxCUI (or null if not found).
 */
async function getRxCUIs(drugNames: string[], env: Env): Promise<Record<string, string | null>> {
	console.log('Fetching RxCUIs for:', drugNames);
	const rxcuiMap: Record<string, string | null> = {};
	const rxnormApiUrl = 'https://rxnav.nlm.nih.gov/REST';

	for (const name of drugNames) {
		try {
			// Use approximateTerm to find potential matches
			const approxUrl = `${rxnormApiUrl}/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=1`;
			const approxResponse = await fetch(approxUrl);
			if (!approxResponse.ok) {
				console.error(`RxNorm approxTerm API error for "${name}": ${approxResponse.status}`);
				rxcuiMap[name] = null;
				continue;
			}
			// Use type assertion for the response data
			const approxData = await approxResponse.json() as RxNormApproxResponse;

			// Extract the best candidate RxCUI if found
			const candidate = approxData.approximateGroup?.candidate?.[0];
			if (candidate?.rxcui) {
				rxcuiMap[name] = candidate.rxcui;
				console.log(`Found RxCUI ${candidate.rxcui} for "${name}"`);
			} else {
				console.warn(`No RxCUI found for "${name}" via approximateTerm.`);
				rxcuiMap[name] = null;
			}
		} catch (error) {
			console.error(`Error fetching RxCUI for "${name}":`, error);
			rxcuiMap[name] = null;
		}
		// Add a small delay to avoid hitting API rate limits if necessary
		// await new Promise(resolve => setTimeout(resolve, 100));
	}
	console.log('RxCUI Map:', rxcuiMap);
	return rxcuiMap;
}


/**
 * Fetches drug labeling information from OpenFDA for a list of RxCUIs and drug names.
 */
async function fetchOpenFDAInteractions(rxcuis: string[], originalDrugNames: string[], env: Env): Promise<OpenFDAResponse> {
	console.log('Fetching OpenFDA interactions for RxCUIs:', rxcuis, 'and Names:', originalDrugNames);

	if (rxcuis.length === 0 && originalDrugNames.length === 0) {
		return { results: [] }; // No identifiers, nothing to fetch
	}

	// Construct the OpenFDA query - Prioritize RxCUI, fallback to names
	const rxcuiQueryParts = rxcuis.map(rxcui => `openfda.rxcui:"${rxcui}"`);
	// Also search by generic and brand names for broader matching
	// Escape special characters in names for the query
	const nameQueryParts = originalDrugNames.map(name => {
		const escapedName = name.replace(/[\+\-\&\|\!\(\)\{\}\[\]\^"~\*\?:\\\/\s]/g, '\\$&'); // Escape Lucene special chars
		return `(openfda.generic_name:"${escapedName}" OR openfda.brand_name:"${escapedName}")`;
	});


	// Combine all query parts with OR
	const allQueryParts = [...rxcuiQueryParts, ...nameQueryParts];
	if (allQueryParts.length === 0) {
		console.warn("No valid query parts generated for OpenFDA.");
		return { results: [] };
	}
	const query = allQueryParts.join('+OR+');


	// Limit results to reduce payload size, increase if necessary
	// Fetch a decent number of labels to increase chances of finding relevant ones
	// Increase limit significantly to capture more results
	const limit = 200; // Increased limit
	const openFDAUrl = `https://api.fda.gov/drug/label.json?search=(${query})&limit=${limit}`;

	// Add API key if provided in environment variables
	// const apiKey = env.OPENFDA_API_KEY;
	// const finalUrl = apiKey ? `${openFDAUrl}&api_key=${apiKey}` : openFDAUrl;
	const finalUrl = openFDAUrl; // Using without API key for now

	console.log('OpenFDA Query URL:', finalUrl);

	try {
		const response = await fetch(finalUrl);
		if (!response.ok) {
			console.error(`OpenFDA API error: ${response.status} ${response.statusText}`);
			let errorMessage = response.statusText;
			try {
				// Attempt to parse error body, but be defensive
				const errorBody = await response.json() as any; // Use 'any' carefully here
				console.error('OpenFDA Error Body:', errorBody);
				// Try to find a message, default to status text
				errorMessage = errorBody?.error?.message || errorMessage;
			} catch (e) {
				console.error('Could not parse OpenFDA error body:', e);
			}
			// Return specific error for 404 Not Found
			if (response.status === 404) {
				return { error: { code: 'NOT_FOUND', message: 'No labels found matching the query.' } };
			}
			return { error: { code: String(response.status), message: errorMessage } };
		}
		const data = await response.json() as OpenFDAResponse;
		console.log(`OpenFDA returned ${data.results?.length || 0} labels.`);
		return data;
	} catch (error) {
		console.error('Error fetching from OpenFDA:', error);
		let message = 'Failed to fetch data from OpenFDA.';
		if (error instanceof Error) {
			message = error.message;
		}
		return { error: { code: 'FETCH_FAILED', message } };
	}
}


/**
 * Parses the OpenFDA response to find potential interactions between the input drugs.
 * This is a simplified example and needs significant refinement for real-world use.
 */
function parseInteractions(
	apiResponse: OpenFDAResponse,
	rxcuiMap: Record<string, string | null>,
	originalDrugNames: string[]
): InteractionResult[] {
	console.log('--- Starting Interaction Parsing ---'); // Added log
	const interactions: InteractionResult[] = [];
	const inputRxCUIs = new Set(Object.values(rxcuiMap).filter(Boolean)); // Set of valid input RxCUIs
	const inputNamesLower = new Set(originalDrugNames.map(name => name.toLowerCase())); // Set of input names, lowercase

	if (!apiResponse.results || apiResponse.results.length === 0) {
		console.log('No relevant labels found in OpenFDA response to parse.');
		return interactions;
	}

	// Map RxCUI back to original name for easier lookup
	const drugNameMap: Record<string, string> = {};
	for (const name in rxcuiMap) {
		if (rxcuiMap[name]) {
			drugNameMap[rxcuiMap[name]!] = name;
		}
	}
	console.log('Input RxCUIs Set:', inputRxCUIs);
	console.log('RxCUI to Name Map:', drugNameMap);
	console.log('Input Names Set (lower):', inputNamesLower);


	for (const label of apiResponse.results) {
		const labelId = label.id || 'unknown';
		const labelRxCUIs = label.openfda?.rxcui || [];
		const interactionText = (label.drug_interactions || []).join(' ').toLowerCase();
		const labelBrandNamesLower = (label.openfda?.brand_name || []).map(n => n.toLowerCase());
		const labelGenericNamesLower = (label.openfda?.generic_name || []).map(n => n.toLowerCase());

		console.log(`\n--- Processing Label ID: ${labelId} (RxCUIs: ${labelRxCUIs.join(', ')}) ---`);
		// console.log(`   Label Brands: ${labelBrandNamesLower.join(', ')}`); // Optional verbose log
		// console.log(`   Label Generics: ${labelGenericNamesLower.join(', ')}`); // Optional verbose log
		// console.log(`   Interaction Text Length: ${interactionText.length}`); // Optional verbose log

		// --- Refined Logic to Identify Label's Input Drug(s) ---
		const associatedInputDrugs = new Set<string>();
		// Match by RxCUI
		for (const rxcui of labelRxCUIs) {
			if (inputRxCUIs.has(rxcui) && drugNameMap[rxcui]) {
				associatedInputDrugs.add(drugNameMap[rxcui]);
			}
		}
		// Match by Name (if not already matched by RxCUI)
		for (const inputName of originalDrugNames) {
			if (!associatedInputDrugs.has(inputName)) { // Avoid adding if already matched by RxCUI
				const inputNameLower = inputName.toLowerCase();
				if (labelBrandNamesLower.includes(inputNameLower) || labelGenericNamesLower.includes(inputNameLower)) {
					associatedInputDrugs.add(inputName);
				}
			}
		}
		const primaryDrugNamesForLabel = Array.from(associatedInputDrugs);
		// --- End Refined Logic ---


		if (primaryDrugNamesForLabel.length === 0 || interactionText.length === 0) {
			// console.log(`   Skipping label ${labelId}: No matching input drug identified or no interaction text.`);
			continue; // Skip labels not matching input or without interaction text
		}
		console.log(`   Label identified as relating to input drug(s): ${primaryDrugNamesForLabel.join(', ')}`);


		// Check if the interaction text mentions any OTHER input drug names (case-insensitive)
		for (const otherInputName of originalDrugNames) {
			// Don't check interaction of a drug with itself
			if (primaryDrugNamesForLabel.includes(otherInputName)) {
				// console.log(`   Skipping check for ${otherInputName} (same as label drug).`);
				continue;
			}

			const otherInputNameLower = otherInputName.toLowerCase();
			console.log(`   Checking if interaction text mentions OTHER drug: "${otherInputNameLower}"`); // Added log

			if (interactionText.includes(otherInputNameLower)) {
				console.log(`   !!! Match Found: Text mentions "${otherInputNameLower}"`); // Added log
				// Found a potential interaction mention
				for (const primaryName of primaryDrugNamesForLabel) {
					// Avoid duplicate pairs (e.g., [A, B] and [B, A]) - simple sort
					const pair = [primaryName, otherInputName].sort();

					// Avoid adding the exact same pair multiple times
					if (!interactions.some(existing => existing.pair[0] === pair[0] && existing.pair[1] === pair[1])) {
						console.log(`   +++ Adding Interaction: ${pair[0]} + ${pair[1]}`); // Added log
						// Get the original (non-lowercase) interaction text for display if available
						const originalInteractionText = (label.drug_interactions || []).join(' ');

						interactions.push({
							pair: pair,
							severity: 'Unknown', // OpenFDA label text rarely gives structured severity
							description: `Interaction mentioned in the labeling for ${primaryName}. Full text: "${originalInteractionText}"`, // Use full original text
						});
					} else {
						// console.log(`   --- Duplicate pair skipped: ${pair[0]} + ${pair[1]}`);
					}
				}
			} else {
				// console.log(`   No mention of "${otherInputNameLower}" found in interaction text.`);
			}
		}
	}

	console.log(`--- Interaction Parsing Complete. Found ${interactions.length} potential interaction mentions. ---`); // Added log
	return interactions;
}
