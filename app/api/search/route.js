
export async function POST(request) {
  try {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Configure TAVILY_API_KEY no .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const query = body.query?.trim();

    if (typeof query !== "string" || !query) {
      return Response.json(
        { error: "Digite o que deseja pesquisar." },
        { status: 400 }
      );
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
        max_results: 8,
        include_answer: true,
        include_images: true,
      }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Tavily:", response.status, data);

      return Response.json(
        { error: "A pesquisa falhou. Verifique a chave e os limites da Tavily." },
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    return Response.json({
      answer: data.answer || "",
      results: (data.results || []).map((item) => ({
        title: item.title || "Fonte",
        url: item.url,
        content: item.content || "",
        score: item.score,
      })),
      images: (data.images || [])
        .map((item) =>
          typeof item === "string" ? item : item.url
        )
        .filter((url) => typeof url === "string" && /^https?:\/\//i.test(url))
        .slice(0, 8),
    });
  } catch (error) {
    console.error("Erro na pesquisa:", error);

    return Response.json(
      { error: "Não consegui realizar a pesquisa." },
      { status: 500 }
    );
  }
}
