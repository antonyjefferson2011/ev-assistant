
import { createClient } from "@supabase/supabase-js";



export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from("jarvis_memory")
    .select("content, updated_at")
    .eq("id", 1)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function PUT(request) {
  const body = await request.json();

  if (!body.content || typeof body.content !== "object") {
    return Response.json({ error: "Conteúdo inválido" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from("jarvis_memory")
    .update({
      content: body.content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select("content, updated_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
