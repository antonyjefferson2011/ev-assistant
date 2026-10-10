
import OpenAI from "openai";

const MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `
Você é JARVIS, um assistente pessoal de IA inteligente, direto e amigável.
Responda em português brasileiro.
Explique com clareza e admita quando não souber algo.
Nunca afirme que pesquisou na internet se uma pesquisa real não foi realizada.
Quando receber resultados de pesquisa, use-os como evidência, diferencie fatos de incertezas e não invente informações ou fontes.
Quando o usuário pedir informações atuais, confira a data das fontes.
Nunca apresente dados antigos como atuais.
Em cotações financeiras, informe a data e a hora da cotação.
Se não houver cotação recente, diga claramente que não conseguiu confirmá-la.
Se os resultados não forem suficientes, informe isso claramente.
`;

const apiKeys = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter(Boolean);

const clients = apiKeys.map(
  (apiKey) =>
    new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
      maxRetries: 0,
    })
);

function shouldSearch(text) {
  const query = text.toLowerCase();

  return /\b(pesquise|pesquisar|pesquisa na internet|busque na internet|procure na internet|fontes sobre|notícias|noticias|hoje|agora|atualmente|últimas notícias|ultimas noticias|mais recente|recentes|cotação|cotacao|preço atual|preco atual|quem ganhou|resultado de hoje|o que aconteceu)\b/i.test(
    query
  );
}

async function searchWeb(query) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("A chave da Tavily não está configurada.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: query.slice(0, 400),
search_depth: "advanced",
topic: "general",
time_range: "week",
max_results: 8,
include_answer: true,
  }),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Erro Tavily:", response.status, data);
    throw new Error("Não foi possível pesquisar na internet.");
  }

  return {
    answer: data.answer || "",
    results: (data.results || []).map((item) => ({
      title: item.title || "Fonte",
      url: item.url,
      content: item.content || "",
    })).filter((item) => item.url),
  };
}

export async function POST(request) {
  try {
    if (clients.length === 0) {
      return Response.json(
        { error: "Configure as chaves GROQ_API_KEY no .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const messages = body.messages;

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "Formato de mensagens inválido." },
        { status: 400 }
      );
    }

    const validMessages = messages
      .filter(
        (message) =>
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string"
      )
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 6000),
      }));

    const lastUserMessage = [...validMessages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUserMessage) {
      return Response.json(
        { error: "Envie uma mensagem para o JARVIS." },
        { status: 400 }
      );
    }

    let sources = [];
    let searchContext = "";
    let searchPerformed = false;

    if (shouldSearch(lastUserMessage.content)) {
      try {
        const searchData = await searchWeb(lastUserMessage.content);

        sources = searchData.results;
        searchPerformed = true;

        searchContext = `
PESQUISA REAL NA INTERNET

Resumo fornecido pela ferramenta:
${searchData.answer || "A ferramenta não forneceu um resumo."}

Resultados encontrados:
${sources.map((source, index) => `
${index + 1}. ${source.title}
URL: ${source.url}
Conteúdo: ${source.content}
`).join("\n")}

INSTRUÇÕES:
- Responda usando os resultados acima quando forem relevantes.
- Não invente detalhes que não aparecem nas fontes.
- Ao mencionar informações da pesquisa, use os números das fontes como [1], [2], etc.
- Não invente links.
- Informe se os resultados forem insuficientes ou contraditórios.
`;
      } catch (error) {
        console.error("Falha na pesquisa:", error.message);

        return Response.json(
          {
            error: "Não consegui pesquisar na internet agora. Tente novamente em instantes.",
          },
          { status: 502 }
        );
      }
    }

    let lastError;

    for (let i = 0; i < clients.length; i++) {
      try {
        const response = await clients[i].chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT +
                (searchContext
                  ? "\n\n" + searchContext
                  : ""),
            },
            ...validMessages,
          ],
          max_completion_tokens: 8192,
          reasoning_effort: "low",
	  tool_choice: "none",
        });

        const reply = response.choices?.[0]?.message?.content;

        if (!reply) {
          return Response.json(
            { error: "A IA retornou uma resposta vazia. Tente novamente." },
            { status: 502 }
          );
        }

        return Response.json({
          reply,
          provider: "groq",
          searched: searchPerformed,
          sources,
          usage: response.usage ?? null,
          finishReason: response.choices?.[0]?.finish_reason ?? null,
        });
      } catch (error) {
        lastError = error;

        const status = error?.status;
console.error(`Falha na chave Groq ${i + 1}:`, status);
console.error("Detalhes do erro:", error?.message, error?.error);

        if (
          status !== 429 &&
          status !== 401 &&
          status !== 403 &&
          !(status >= 500)
        ) {
          break;
        }
      }
    }

    const status = lastError?.status === 429 ? 429 : 502;

    return Response.json(
      {
        error:
          status === 429
            ? "A Groq atingiu um limite de uso. Tente novamente mais tarde."
            : "Não consegui conectar à Groq. Confira a configuração e tente novamente.",
      },
      { status }
    );
  } catch (error) {
    console.error("Erro na API JARVIS:", error);

    return Response.json(
      { error: "Ocorreu um erro ao processar sua mensagem." },
      { status: 500 }
    );
  }
}
