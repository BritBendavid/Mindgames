import { ALLOWED_WORDS } from "./allowed_words.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RejectedDraft = {
  text: string;
  badWords: string[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function checkAllowedWords(text: string) {
  const words = normalizeWords(text);
  const badWords = [...new Set(words.filter(word => !ALLOWED_WORDS.has(word)))];

  return {
    ok: badWords.length === 0,
    badWords
  };
}

function cleanMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message): message is ChatMessage => {
      return (
        message &&
        typeof message === "object" &&
        (message as ChatMessage).role &&
        ((message as ChatMessage).role === "user" ||
          (message as ChatMessage).role === "assistant") &&
        typeof (message as ChatMessage).content === "string"
      );
    })
    .slice(-16)
    .map(message => ({
      role: message.role,
      content: message.content.slice(0, 1500)
    }));
}

async function askOpenAI(
  apiKey: string,
  messages: ChatMessage[],
  rejectedDraft: RejectedDraft | null
): Promise<string> {
  const allowedWordsText = [...ALLOWED_WORDS].join(", ");

  const retryInstruction = rejectedDraft
    ? `
Your last answer was rejected.

Rejected answer:
${rejectedDraft.text}

Words you used that are not allowed:
${rejectedDraft.badWords.join(", ")}

Try again with only allowed words.
`
    : "";

  const input = [
    {
      role: "system",
      content: `
You are a friendly chat bot.

You must answer using only words from the allowed word list below.

Allowed words:
${allowedWordsText}

Rules:
- Use only allowed words.
- Use short plain sentences.
- Do not use contractions.
- Do not use names.
- Do not use digits.
- Do not use symbols except simple punctuation.
- Do not mention the allowed word rule unless the user asks.
- If the user asks something hard, answer simply with allowed words.

${retryInstruction}
`
    },
    ...messages
  ];

  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      input,
      store: false
    })
  });

  const data = await openAIResponse.json();

  if (!openAIResponse.ok) {
    console.error("OpenAI error:", data);
    throw new Error(data?.error?.message || "OpenAI request failed");
  }

  if (typeof data.output_text === "string") {
    return data.output_text.trim();
  }

  // Fallback parser in case output_text is unavailable.
  const textParts: string[] = [];

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        { error: "OPENAI_API_KEY is missing from Supabase secrets." },
        500
      );
    }

    const body = await req.json();
    const messages = cleanMessages(body.messages);

    if (messages.length === 0) {
      return jsonResponse({ error: "No valid messages were sent." }, 400);
    }

    const maxTries = 5;
    let rejectedDraft: RejectedDraft | null = null;

    for (let attempt = 1; attempt <= maxTries; attempt++) {
      const draft = await askOpenAI(apiKey, messages, rejectedDraft);
      const check = checkAllowedWords(draft);

      if (check.ok) {
        return jsonResponse({
          reply: draft,
          tries: attempt,
          rejected: rejectedDraft
        });
      }

      rejectedDraft = {
        text: draft,
        badWords: check.badWords
      };
    }

    return jsonResponse({
      reply: "i am sorry i will try again",
      tries: maxTries,
      rejected: rejectedDraft
    });

  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Server error"
      },
      500
    );
  }
});
