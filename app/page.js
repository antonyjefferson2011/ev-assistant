
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function renderInline(text, prefix = "in") {
  const pattern = /(\*\*.+?\*\*|(?<!\*)\*[^*]+\*(?!\*)|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const parts = [];
  let last = 0;
  let match;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${prefix}-${index++}`;

    if (token.startsWith("**")) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code className="md-inline-code" key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      parts.push(link ? (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>
      ) : token);
    } else {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    last = pattern.lastIndex;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function CodeBlockView({ code, language }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const area = document.createElement("textarea");
      area.value = code;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="code-card">
      <div className="code-card-header">
        <span className="code-language">{language || "código"}</span>
        <button type="button" className="code-copy-button" onClick={copyCode}>
          {copied ? "✓ Copiado!" : "▢ Copiar código"}
        </button>
      </div>
      <pre className="code-card-pre"><code>{code}</code></pre>
    </div>
  );
}

function renderMarkdown(source) {
  const lines = String(source || "")
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .split("\n");

  const blocks = [];
  let paragraph = [];
  let list = [];
  let listType = null;
  let inCode = false;
  let codeLines = [];
  let codeLanguage = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {renderInline(paragraph.join(" "), `p-${blocks.length}`)}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    const Tag = listType === "number" ? "ol" : "ul";
    const key = `list-${blocks.length}`;

    blocks.push(
      <Tag key={key}>
        {list.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </Tag>
    );

    list = [];
    listType = null;
  };

  const flushCode = () => {
    blocks.push(
      <CodeBlockView
        key={`code-${blocks.length}`}
        code={codeLines.join("\n")}
        language={codeLanguage}
      />
    );
    codeLines = [];
    codeLanguage = "";
  };

  const getCells = (line) =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "")
      .split("|").map((cell) => cell.trim());

  const isSeparator = (line) =>
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();

      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
        codeLanguage = line.trim().slice(3).trim().split(/\s+/)[0] || "";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (i + 1 < lines.length && line.includes("|") && isSeparator(lines[i + 1])) {
      flushParagraph();
      flushList();

      const headers = getCells(line);
      const rows = [];
      i += 2;

      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(getCells(lines[i]));
        i++;
      }
      i--;

      const key = `table-${blocks.length}`;
      blocks.push(
        <div className="markdown-table-wrap" key={key}>
          <table className="markdown-table">
            <thead>
              <tr>
                {headers.map((cell, n) => (
                  <th key={n}>{renderInline(cell, `${key}-h-${n}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {headers.map((_, c) => (
                    <td key={c}>{renderInline(row[c] || "", `${key}-${r}-${c}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const Tag = `h${heading[1].length}`;
      blocks.push(
        <Tag key={`h-${i}`}>{renderInline(heading[2], `h-${i}`)}</Tag>
      );
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(
        <blockquote key={`q-${i}`}>{renderInline(quote[1], `q-${i}`)}</blockquote>
      );
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (bullet || numbered) {
      flushParagraph();
      const type = numbered ? "number" : "bullet";
      if (listType && listType !== type) flushList();
      listType = type;
      list.push((bullet || numbered)[1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  if (inCode) flushCode();

  return blocks;
}

function getStreamText(payload) {
  if (payload === "[DONE]") return "";

  try {
    const data = JSON.parse(payload);
    return data.choices?.[0]?.delta?.content ??
      data.choices?.[0]?.message?.content ??
      data.delta ?? data.text ?? "";
  } catch {
    return payload;
  }
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState("Conectando à nuvem...");
  const [thinkingStage, setThinkingStage] = useState(0);
  const [notice, setNotice] = useState("");
  const [memory, setMemory] = useState({ memories: [], conversations: [] });
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Pronto para ouvir");
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const messagesRef = useRef([]);
  const loadingRef = useRef(false);
  const voiceOpenRef = useRef(false);
  const sendingRef = useRef(false);
  const memoryRef = useRef(memory);
  const noticeTimeoutRef = useRef(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { memoryRef.current = memory; }, [memory]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { voiceOpenRef.current = voiceOpen; }, [voiceOpen]);

  useEffect(() => () => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!loading) {
      setThinkingStage(0);
      return;
    }

    const timer = setInterval(
      () => setThinkingStage((n) => (n + 1) % 3),
      2200
    );
    return () => clearInterval(timer);
  }, [loading]);

  function showNotice(text) {
    setNotice(text);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setNotice(""), 2200);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMemory() {
      let timeout;

      try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 7000);

        const response = await fetch("/api/memory", {
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) throw new Error("Falha ao carregar memória");

        const data = await response.json();
        const content = data.content || {};
        const saved = Array.isArray(content.conversations)
          ? content.conversations
          : [];

        if (cancelled) return;

        const loaded = {
          ...content,
          memories: Array.isArray(content.memories) ? content.memories : [],
          conversations: saved
        };

        memoryRef.current = loaded;
        messagesRef.current = saved;
        setMemory(loaded);
        setMessages(saved);
        setStatus("Memória na nuvem conectada");
      } catch {
        if (cancelled) return;

        let saved = [];
        try {
          const parsed = JSON.parse(localStorage.getItem("jarvis-messages") || "[]");
          if (Array.isArray(parsed)) saved = parsed;
        } catch {}

        messagesRef.current = saved;
        setMessages(saved);
        setStatus("Nuvem indisponível");
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setHistoryReady(true);
      }
    }

    loadMemory();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!historyReady) return;

    try {
      localStorage.setItem("jarvis-messages", JSON.stringify(messages));
    } catch (error) {
      console.error("Erro ao salvar histórico local:", error);
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch("/api/memory", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: {
              ...memoryRef.current,
              conversations: messages
            }
          })
        });

        if (!response.ok) throw new Error("Falha ao salvar");
        setStatus("Memória sincronizada");
      } catch {
        setStatus("Falha na sincronização");
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [messages, historyReady]);

  const handleScroll = useCallback(() => {
    const area = scrollAreaRef.current;
    if (!area) return;

    shouldAutoScrollRef.current =
      area.scrollHeight - area.scrollTop - area.clientHeight < 150;
  }, []);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area || !shouldAutoScrollRef.current) return;

    const frame = requestAnimationFrame(() =>
      area.scrollTo({ top: area.scrollHeight, behavior: "auto" })
    );

    return () => cancelAnimationFrame(frame);
  }, [messages, loading]);

  function updateAssistantMessage(id, content, extra = {}) {
    const updated = messagesRef.current.map((message) =>
      message.id === id ? { ...message, content, ...extra } : message
    );

    messagesRef.current = updated;
    setMessages(updated);
  }

  async function readChatResponse(response, assistantId, searchData = null) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json") || !response.body) {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao conversar com a IA");

      const reply = data.reply || data.content || data.message ||
        "A IA retornou uma resposta vazia.";

      updateAssistantMessage(assistantId, reply, {
  sources: Array.isArray(data.sources) && data.sources.length
    ? data.sources
    : searchData?.results || [],
  images: searchData?.images || [],
  searched: Boolean(data.searched || searchData)
});
      return reply;
    }

    if (!response.ok) {
      throw new Error(await response.text() || "Erro ao conversar com a IA");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";
    const isSse = contentType.includes("text/event-stream");

    function addChunk(chunk) {
      if (!chunk) return;
      fullText += chunk;
      updateAssistantMessage(assistantId, fullText);
    }

    function processLine(line) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;

      const payload = trimmed.slice(5).trim();
      if (payload && payload !== "[DONE]") {
        addChunk(getStreamText(payload));
      }
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (!isSse) {
        addChunk(buffer);
        buffer = "";
      } else {
        const chunks = buffer.split("\n");
        buffer = chunks.pop() || "";
        chunks.forEach(processLine);
      }
    }

    buffer += decoder.decode();

    if (isSse && buffer.trim()) processLine(buffer);
    else if (buffer) addChunk(buffer);

    if (!fullText.trim()) throw new Error("A IA retornou uma resposta vazia.");
    return fullText;
  }

  async function sendMessage(event, directText) {
    event?.preventDefault();

    const text = (typeof directText === "string" ? directText : input).trim();
    if (!text || sendingRef.current || !historyReady) return;

    sendingRef.current = true;
    loadingRef.current = true;
    shouldAutoScrollRef.current = true;

    const userMessage = { role: "user", content: text };
    const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const updated = [
      ...messagesRef.current,
      userMessage,
      { id: assistantId, role: "assistant", content: "" }
    ];

    messagesRef.current = updated;
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
let searchData = null;

if (/\b(pesquise|pesquisar|pesquisa na internet|busque na internet|procure na internet|quem é|quem foi|imagens de|fotos de|notícias|noticias|atualmente|hoje)\b/i.test(text)) {
  try {
    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text })
    });

    if (searchResponse.ok) {
      searchData = await searchResponse.json();
    }
  } catch (error) {
    console.error("Falha ao buscar imagens:", error);
  }
}
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated.slice(0, -1),
          stream: true
        })
      });

      const reply = await readChatResponse(response, assistantId, searchData);

      if (
        voiceOpenRef.current &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(
          reply.replace(/```[\s\S]*?```/g, " bloco de código ")
            .replace(/[*#`]/g, "")
        );

        utterance.lang = "pt-BR";
        utterance.rate = 1;
        utterance.onstart = () => setVoiceStatus("Respondendo em voz alta...");
        utterance.onend = () => setVoiceStatus("Pronto para ouvir");
        utterance.onerror = () => setVoiceStatus("Não consegui reproduzir o áudio.");

        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      updateAssistantMessage(
        assistantId,
        `**Erro:** ${error.message || "Não foi possível obter resposta."}`
      );
    } finally {
      sendingRef.current = false;
      loadingRef.current = false;
      setLoading(false);
    }
  }

  function openVoiceMode() {
    if (loadingRef.current || recognitionRef.current) return;

    setVoiceOpen(true);
    voiceOpenRef.current = true;
    setVoiceStatus("Preparando microfone...");

    const Recognition = typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!Recognition) {
      setVoiceStatus(
        "Reconhecimento de voz indisponível neste navegador. Você ainda pode ouvir respostas."
      );
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = "pt-BR";
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceStatus("Estou ouvindo...");
      };

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();

        setIsListening(false);
        recognitionRef.current = null;

        if (transcript) {
          setInput(transcript);
          setVoiceStatus("Entendi. Preparando resposta...");
          sendMessage(null, transcript);
        } else {
          setVoiceStatus("Não consegui entender. Tente novamente.");
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        recognitionRef.current = null;

        setVoiceStatus(
          event.error === "not-allowed"
            ? "Permita o acesso ao microfone no navegador."
            : "Não consegui ouvir. Tente novamente."
        );
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceStatus("Não foi possível iniciar o microfone.");
    }
  }

  function closeVoiceMode() {
    try {
      recognitionRef.current?.stop?.();
    } catch {}

    recognitionRef.current = null;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsListening(false);
    setVoiceOpen(false);
    voiceOpenRef.current = false;
    setVoiceStatus("Pronto para ouvir");
  }

  function newChat() {
    if (!confirm("Deseja apagar o histórico compartilhado?")) return;

    messagesRef.current = [];
    setMessages([]);
    setInput("");
    shouldAutoScrollRef.current = true;
  }

  const suggestions = [
    {
      icon: "✦",
      title: "Tirar uma dúvida",
      description: "Explique algo de forma simples.",
      prompt: "Quero tirar uma dúvida. Pode me ajudar?"
    },
    {
      icon: "⌘",
      title: "Programação",
      description: "Ajude-me com código e projetos.",
      prompt: "Quero ajuda com programação."
    },
    {
      icon: "◈",
      title: "Criar alguma coisa",
      description: "Transforme uma ideia em projeto.",
      prompt: "Ajude-me a transformar uma ideia em um projeto."
    },
    {
      icon: "◎",
      title: "Organizar ideias",
      description: "Planeje os próximos passos comigo.",
      prompt: "Ajude-me a organizar minhas ideias."
    }
  ];

  const thinkingLabels = [
    "Analisando sua solicitação...",
    "Preparando a resposta...",
    "Organizando as informações..."
  ];

  return (
    <main className="jarvis-app">
      <aside className={`jarvis-sidebar ${sidebarOpen ? "" : "sidebar-hidden"}`}>
        <div className="sidebar-brand">
          <div className="brand-symbol">J</div>
          <div>
            <div className="brand-name">J.A.R.V.I.S.</div>
            <div className="brand-caption">PERSONAL AI SYSTEM</div>
          </div>
        </div>

        <button
          className="new-chat-button"
          onClick={newChat}
          disabled={!historyReady}
        >
          <span>＋</span> Nova conversa
        </button>

        <div className="sidebar-section-label">ASSISTENTE</div>
        <div className="sidebar-item active">
          <span>◈</span> Conversa <span className="sidebar-indicator" />
        </div>
        <div className="sidebar-item"><span>▤</span> Memória compartilhada</div>
        <div className="sidebar-spacer" />

        <div className="system-status">
          <span className="status-dot" />
          <div>
            <div className="status-title">Sistema JARVIS</div>
            <div className="status-subtitle">{status}</div>
          </div>
        </div>

        <div className="sidebar-footer">JARVIS SYSTEM · V1.3</div>
      </aside>

      <section className="jarvis-main">
        <header className="topbar">
          <button
            className="icon-button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Mostrar ou esconder menu"
          >
            ☰
          </button>

          <div className="topbar-context">
            <span className="topbar-label">ASSISTENTE</span>
            <span className="topbar-divider">/</span>
            <span className="topbar-current">JARVIS AI</span>
          </div>

          <div className="topbar-right">
            <button
              className="voice-launch-button"
              onClick={openVoiceMode}
              title="Conversar por voz"
            >
              ◉ <span>Modo de voz</span>
            </button>

            <div className="online-indicator">
              <span className="status-dot" />
              {historyReady ? "ONLINE" : "CONECTANDO"}
            </div>

            <div className="topbar-avatar">J</div>
          </div>
        </header>

        <div
          className="conversation-area"
          ref={scrollAreaRef}
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="reactor">
                <div className="reactor-ring ring-one" />
                <div className="reactor-ring ring-two" />
                <div className="reactor-ring ring-three" />
                <div className="reactor-core">J</div>
              </div>

              <div className="welcome-eyebrow">
                <span className="status-dot" /> SISTEMA PRONTO
              </div>

              <h1>Como posso ajudar?</h1>
              <p className="welcome-description">
                Seu assistente pessoal está pronto para conversar, ajudar com
                projetos e explorar ideias com você.
              </p>

              <div className="suggestion-grid">
                {suggestions.map((item) => (
                  <button key={item.title} onClick={() => setInput(item.prompt)}>
                    <span className="suggestion-icon">{item.icon}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              <div className="conversation-heading">
                <div>
                  <span className="topbar-label">SESSÃO ATUAL</span>
                  <h2>Conversa com JARVIS</h2>
                </div>
                <span className="message-count">{messages.length} MENSAGENS</span>
              </div>

              {messages.map((message, index) => (
                <div
                  className={`message-row ${
                    message.role === "user" ? "user-row" : "assistant-row"
                  }`}
                  key={message.id || `${index}-${message.role}`}
                >
                  <div
                    className={`message-avatar ${
                      message.role === "user" ? "user-avatar" : ""
                    }`}
                  >
                    {message.role === "user" ? "EU" : "J"}
                  </div>

                  <div className="message-content">
                    <div className="message-meta">
                      <strong>{message.role === "user" ? "Você" : "JARVIS"}</strong>
                      <span>{message.role === "user" ? "USUÁRIO" : "ASSISTENTE"}</span>
                    </div>

                    <div className="message-text markdown-content">
                      {message.content
                        ? renderMarkdown(message.content)
                        : loading && index === messages.length - 1
                          ? (
                            <div className="thinking-indicator">
                              <span /><span /><span />
                              <small>{thinkingLabels[thinkingStage]}</small>
                            </div>
                          )
                          : null}
                    </div>
{message.images?.length > 0 && (
  <div className="jarvis-image-gallery">
    <strong>Imagens encontradas na pesquisa</strong>
    <div className="jarvis-image-grid">
      {message.images.map((url, i) => (
        <a
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="jarvis-image-card"
        >
          <img
            src={url}
            alt={`Imagem relacionada à pesquisa ${i + 1}`}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </a>
      ))}
    </div>
  </div>
)}
                    {message.sources?.length > 0 && (
                      <div className="message-sources">
                        <strong>Fontes pesquisadas</strong>
                        {message.sources.map((source, i) => (
                          /^https?:\/\//i.test(source.url || "") && (
                            <a
                              key={source.url || i}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span>{i + 1}.</span> {source.title || source.url}
                              <span aria-hidden="true">↗</span>
                            </a>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="composer-area">
          <form className="composer" onSubmit={sendMessage}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(event);
                }
              }}
              placeholder={
                historyReady
                  ? "Envie uma mensagem para o JARVIS..."
                  : "Carregando memória..."
              }
              disabled={!historyReady || loading}
              rows={2}
            />

            <div className="composer-bottom">
              <div className="composer-hint">
                <kbd>Enter</kbd> enviar <span>·</span> <kbd>Shift + Enter</kbd> nova linha
              </div>

              <button
                className="send-button"
                type="submit"
                disabled={!input.trim() || loading || !historyReady}
                aria-label="Enviar mensagem"
              >
                {loading ? <span className="send-spinner" /> : "↑"}
              </button>
            </div>
          </form>

          <p className="disclaimer">
            O JARVIS pode cometer erros. Confira informações importantes.
          </p>
        </div>
      </section>

      {notice && <div className="jarvis-toast">{notice}</div>}

      {voiceOpen && (
        <div
          className="voice-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Modo de voz do JARVIS"
        >
          <div className="voice-panel">
            <button
              className="voice-close"
              onClick={closeVoiceMode}
              aria-label="Fechar modo de voz"
            >
              ×
            </button>

            <div className={`voice-reactor ${loading || isListening ? "voice-active" : ""}`}>
              <div className="voice-orbit orbit-a" />
              <div className="voice-orbit orbit-b" />
              <div className="voice-orbit orbit-c" />
              <div className="voice-core"><span>J</span></div>
              <div className="voice-scanline" />
            </div>

            <div className="voice-kicker">J.A.R.V.I.S. / INTERFACE DE ÁUDIO</div>
            <h2>
              {loading ? "Estou processando" : isListening ? "Estou ouvindo" : "Estou aqui"}
            </h2>

            <p className="voice-status-text">
              {loading ? thinkingLabels[thinkingStage] : voiceStatus}
            </p>

            <div className="voice-wave" aria-hidden="true">
              {Array.from({ length: 31 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    "--bar": `${10 + ((i * 17) % 28)}px`,
                    "--delay": `${(i % 9) * 0.08}s`
                  }}
                />
              ))}
            </div>

            <p className="voice-note">
              Fale naturalmente. O JARVIS vai processar sua pergunta e responder em voz alta.
            </p>

            <div className="voice-actions">
              <button
                className="voice-mic-button"
                onClick={openVoiceMode}
                disabled={loading || isListening || Boolean(recognitionRef.current)}
              >
                {isListening ? "◌ Ouvindo..." : "🎙 Falar com JARVIS"}
              </button>
              <button className="voice-stop-button" onClick={closeVoiceMode}>
                Encerrar
              </button>
            </div>

            <div className="voice-footer">
              <span className="status-dot" /> SISTEMA DE VOZ LOCAL · RESPOSTAS PELA IA
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
