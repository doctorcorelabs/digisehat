// File: cf-worker/chatgpt-worker/src/index.ts

export interface Env {
	OPENROUTER_API_KEY: string;
	ALLOWED_ORIGIN: string;
}

// Perbarui RequestBody untuk menerima riwayat pesan
interface RequestBody {
	prompt?: string; // Tetap ada untuk kompatibilitas
	modelName?: string;
	messages?: { // Array untuk riwayat percakapan
		role: 'user' | 'model' | 'assistant' | 'system';
		content: any;
	}[];
}

// Helper function to create JSON response with CORS headers
function createJsonResponse(data: any, status: number = 200, corsOrigin: string = '*') {
	return new Response(JSON.stringify(data), {
		status: status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': corsOrigin,
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		},
	});
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const allowedOrigin = env.ALLOWED_ORIGIN || '*';

		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': allowedOrigin,
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Max-Age': '86400',
				},
			});
		}

		if (request.method !== 'POST') {
			return createJsonResponse({ error: 'Method Not Allowed' }, 405, allowedOrigin);
		}

		const apiKey = env.OPENROUTER_API_KEY;
		if (!apiKey) {
			return createJsonResponse({ error: 'No auth credentials found' }, 500, allowedOrigin);
		}

		let requestBody: RequestBody;
		try {
			requestBody = await request.json();
			// Permintaan harus berisi 'prompt' atau 'messages'
			if (!requestBody.prompt && (!requestBody.messages || requestBody.messages.length === 0)) {
				throw new Error("Request must include 'prompt' or a non-empty 'messages' array");
			}
		} catch (error: any) {
			return createJsonResponse({ error: `Bad Request: ${error.message}` }, 400, allowedOrigin);
		}

		try {
			const modelName = requestBody.modelName || 'openai/gpt-4o-mini';
			let apiMessages;

			// Prioritaskan 'messages' jika ada untuk percakapan berlanjut
			if (requestBody.messages && requestBody.messages.length > 0) {
				apiMessages = requestBody.messages.map(msg => ({
					...msg,
					// API OpenRouter menggunakan 'assistant' untuk respons model
					role: msg.role === 'model' ? 'assistant' : msg.role,
				}));
			} else {
				// Gunakan 'prompt' untuk permintaan tunggal
				apiMessages = [{ role: 'user', content: requestBody.prompt }];
			}

			const payload = {
				model: modelName,
				messages: apiMessages,
			};

			// Panggilan ke OpenRouter tetap aman di sisi server
			const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`,
					'HTTP-Referer': 'https://digisehat.daivanlabs.com/',
					'X-Title': 'DigiSehat'
				},
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const errorData = await res.json() as { error?: { message?: string } };
				const errorMessage = errorData.error?.message || `HTTP error! status: ${res.status}`;
				throw new Error(errorMessage);
			}

			const data = await res.json() as { choices?: { message?: { content?: string } }[] };
			const responseText = data.choices?.[0]?.message?.content?.trim();
			return createJsonResponse({ responseText }, 200, allowedOrigin);

		} catch (error: any) {
			console.error("Error calling OpenRouter API:", error);
			return createJsonResponse({ error: `Internal Server Error: ${error.message}` }, 500, allowedOrigin);
		}
	},
};
