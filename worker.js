const encoder = new TextEncoder();

async function verifyLineSignature(request, rawBody, channelSecret) {
  const signature = request.headers.get("x-line-signature");
  if (!signature) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(channelSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = Uint8Array.from(
      atob(signature),
      (character) => character.charCodeAt(0)
    );

    return await crypto.subtle.verify("HMAC", key, signatureBytes, rawBody);
  } catch {
    return false;
  }
}

function cleanLineText(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "・")
    .replace(/`/g, "")
    .trim()
    .slice(0, 1200);
}

async function askGemini(question, apiKey) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: [
                "你是「自然探索・蟲森物語」的 LINE 小幫手。",
                "請用親切、簡潔的繁體中文回答自然、生態與昆蟲相關問題。",
                "以正確資訊為優先；不確定時要坦白說明，不要編造。",
                "分類提醒：鍬形蟲屬鍬形蟲科；獨角仙屬金龜子科；兩者都屬鞘翅目，不要說兩者都是金龜子科。",
                "每次回答以約 100 至 250 個繁體中文字為宜，可用短段落或數字列點。",
                "LINE 訊息請使用純文字，不要使用 Markdown、星號粗體、井號標題或程式碼格式。",
                "如果問題與自然主題無關，可以簡短回答，再友善地引導回自然探索。"
              ].join("\n")
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: question }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 650
          }
        }),
        signal: AbortSignal.timeout(18000)
      }
    );

    if (response.status === 429) {
      return "目前提問比較多，請稍後再試一次喔！";
    }

    if (!response.ok) {
      console.error("Gemini status:", response.status);
      return "抱歉，我暫時無法回答，請稍後再試。";
    }

    const data = await response.json();
    const answer = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n");

    const cleaned = cleanLineText(answer);
    return cleaned || "抱歉，我暫時想不到合適的回答，請換個方式問問我。";
  } catch (error) {
    console.error("Gemini request error:", error?.name ?? "unknown");
    return "抱歉，我暫時無法回答，請稍後再試。";
  }
}

async function handleEvent(event, env) {
  if (
    event.type !== "message" ||
    event.message?.type !== "text" ||
    event.source?.type !== "user" ||
    !event.replyToken
  ) {
    return;
  }

  const question = event.message.text?.trim().slice(0, 500);
  if (!question) return;

  const answer = await askGemini(question, env.GEMINI_API_KEY);

  try {
    const response = await fetch(
      "https://api.line.me/v2/bot/message/reply",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: answer }]
        }),
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!response.ok) {
      console.error("LINE reply status:", response.status);
    }
  } catch (error) {
    console.error("LINE reply error:", error?.name ?? "unknown");
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Forest Tales LINE bot is running");
    }

    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("Not Found", { status: 404 });
    }

    if (
      !env.LINE_CHANNEL_SECRET ||
      !env.LINE_CHANNEL_ACCESS_TOKEN ||
      !env.GEMINI_API_KEY
    ) {
      console.error("Missing required secret");
      return new Response("Server configuration error", { status: 500 });
    }

    const rawBody = await request.arrayBuffer();
    const valid = await verifyLineSignature(
      request,
      rawBody,
      env.LINE_CHANNEL_SECRET
    );

    if (!valid) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const events = Array.isArray(payload.events) ? payload.events : [];
    ctx.waitUntil(
      Promise.allSettled(events.map((event) => handleEvent(event, env)))
    );

    return new Response("OK");
  }
};
