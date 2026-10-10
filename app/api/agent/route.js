
import { spawn } from "node:child_process";



const ALLOWED_ACTIONS = {
  calculator: {
    label: "Calculadora",
    command: "calc.exe",
    args: [],
  },
  notepad: {
    label: "Bloco de Notas",
    command: "notepad.exe",
    args: [],
  },
  browser: {
    label: "Navegador",
    command: "cmd.exe",
    args: ["/c", "start", "", "https://www.google.com"],
  },
};

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (typeof action !== "string" || !ALLOWED_ACTIONS[action]) {
      return Response.json(
        {
          error: "Ação não permitida.",
          allowedActions: Object.keys(ALLOWED_ACTIONS),
        },
        { status: 400 }
      );
    }

    const selected = ALLOWED_ACTIONS[action];

    const child = spawn(selected.command, selected.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      shell: false,
    });

    child.on("error", (error) => {
      console.error("Falha ao iniciar ferramenta:", error.message);
    });

    child.unref();

    return Response.json({
      ok: true,
      message: `${selected.label}: solicitação enviada ao Windows.`,
      action,
    });
  } catch (error) {
    console.error("Erro no agente local:", error.message);

    return Response.json(
      { error: "Não foi possível executar a ação." },
      { status: 500 }
    );
  }
}
