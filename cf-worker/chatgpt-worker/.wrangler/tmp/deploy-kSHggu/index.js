var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
function createJsonResponse(data, status = 200, corsOrigin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
__name(createJsonResponse, "createJsonResponse");
var index_default = {
  async fetch(request, env, ctx) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (request.method !== "POST") {
      return createJsonResponse({ error: "Method Not Allowed" }, 405, allowedOrigin);
    }
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return createJsonResponse({ error: "No auth credentials found" }, 500, allowedOrigin);
    }
    let requestBody;
    try {
      requestBody = await request.json();
      if (!requestBody.prompt && (!requestBody.messages || requestBody.messages.length === 0)) {
        throw new Error("Request must include 'prompt' or a non-empty 'messages' array");
      }
    } catch (error) {
      return createJsonResponse({ error: `Bad Request: ${error.message}` }, 400, allowedOrigin);
    }
    try {
      const modelName = requestBody.modelName || "openai/gpt-4o-mini";
      let apiMessages;
      if (requestBody.messages && requestBody.messages.length > 0) {
        apiMessages = requestBody.messages.map((msg) => ({
          ...msg,
          // API OpenRouter menggunakan 'assistant' untuk respons model
          role: msg.role === "model" ? "assistant" : msg.role
        }));
      } else {
        apiMessages = [{ role: "user", content: requestBody.prompt }];
      }
      const payload = {
        model: modelName,
        messages: apiMessages
      };
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://digisehat.daivanlabs.com/",
          "X-Title": "DigiSehat"
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.error?.message || `HTTP error! status: ${res.status}`;
        throw new Error(errorMessage);
      }
      const data = await res.json();
      const responseText = data.choices?.[0]?.message?.content?.trim();
      return createJsonResponse({ responseText }, 200, allowedOrigin);
    } catch (error) {
      console.error("Error calling OpenRouter API:", error);
      return createJsonResponse({ error: `Internal Server Error: ${error.message}` }, 500, allowedOrigin);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
