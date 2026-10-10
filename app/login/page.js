
"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMessage(
            "Cadastro criado! Confira seu e-mail para confirmar a conta antes de entrar."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(error.message || "Não foi possível concluir a operação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.logo}>J</div>
        <h1 style={styles.title}>JARVIS</h1>
        <p style={styles.subtitle}>
          {mode === "login"
            ? "Entre na sua conta"
            : "Crie sua conta"}
        </p>

        <label style={styles.label}>E-mail</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          required
        />

        <label style={styles.label}>Senha</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo de 6 caracteres"
          minLength={6}
          required
        />

        {message && <p style={styles.message}>{message}</p>}

        <button style={styles.button} disabled={loading}>
          {loading
            ? "Aguarde..."
            : mode === "login"
            ? "Entrar"
            : "Criar conta"}
        </button>

        <button
          type="button"
          style={styles.switch}
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
        >
          {mode === "login"
            ? "Ainda não tem conta? Criar conta"
            : "Já tem conta? Entrar"}
        </button>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#070b12",
    color: "#edf7ff",
    padding: 20,
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    display: "flex",
    flexDirection: "column",
    padding: 30,
    border: "1px solid #203344",
    borderRadius: 18,
    background: "#0c1420",
    boxSizing: "border-box",
  },
  logo: {
    alignSelf: "center",
    display: "grid",
    placeItems: "center",
    width: 54,
    height: 54,
    border: "1px solid #38c8e8",
    borderRadius: 16,
    color: "#38c8e8",
    fontSize: 28,
    fontWeight: "bold",
  },
  title: {
    textAlign: "center",
    letterSpacing: 5,
    marginBottom: 0,
  },
  subtitle: {
    textAlign: "center",
    color: "#91a8bc",
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    marginBottom: 7,
    color: "#b7c9d9",
  },
  input: {
    padding: 13,
    marginBottom: 18,
    border: "1px solid #293d50",
    borderRadius: 9,
    background: "#080f18",
    color: "#fff",
    outline: "none",
  },
  button: {
    padding: 13,
    border: 0,
    borderRadius: 9,
    background: "#38c8e8",
    color: "#061019",
    fontWeight: "bold",
    cursor: "pointer",
  },
  switch: {
    marginTop: 18,
    border: 0,
    background: "transparent",
    color: "#38c8e8",
    cursor: "pointer",
  },
  message: {
    color: "#f4bd70",
    fontSize: 13,
    lineHeight: 1.5,
  },
};
