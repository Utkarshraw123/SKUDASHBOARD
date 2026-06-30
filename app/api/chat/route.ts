import { NextRequest } from "next/server";
import { fetchSkus, fetchProduction, fetchWNPPlanning, fetchBulkOpenPOs, fetchPackingSchedule } from "@/lib/sheets";

export const runtime = "nodejs";

// Very tight context — Groq free tier TPM is as low as 6000, so hard-cap everything
async function buildContext(): Promise<string> {
  const [skus, production, planning, openPOs, packing] = await Promise.all([
    fetchSkus(),
    fetchProduction(),
    fetchWNPPlanning(),
    fetchBulkOpenPOs(),
    fetchPackingSchedule(),
  ]);

  const d = (s: string, n = 30) => s.slice(0, n);
  const parts: string[] = [];

  // SKUs: only the most critical (cover<8w), capped to 20 rows
  const critical = skus
    .filter((s) => s.cover !== null && s.cover < 8)
    .sort((a, b) => (a.cover ?? 999) - (b.cover ?? 999))
    .slice(0, 20);
  parts.push(`Critical SKUs (<8w cover), ${skus.length} total SKUs tracked:\ncode|name|cover|stock|next_del`);
  for (const s of critical) {
    parts.push(`${s.skuCode}|${d(s.description)}|${s.cover}w|${s.inventory ?? "?"}|${s.nextBulkDelivery || s.nextPackingDelivery || "-"}`);
  }

  // All external production POs — open AND completed — needed for historical spend queries
  // Sorted newest first; cap 40 rows total
  const sortedProd = [...production]
    .sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""))
    .slice(0, 40);
  parts.push(`\nExternal production POs (ALL, open+completed, newest first, ${sortedProd.length} shown of ${production.length}):\npo|part|desc|due|qty|£/unit|status`);
  for (const r of sortedProd) {
    parts.push(`${r.order||"-"}|${r.partNumber||"-"}|${d(r.description,26)}|${r.dueDate||"-"}|${r.quantity??"-"}|£${r.costPerUnit??"-"}|${r.status}`);
  }

  // Internal planning — active only, cap 15
  const activePlan = planning
    .filter((r) => r.status !== "complete")
    .slice(0, 15);
  parts.push(`\nInternal WNP planning — active/not-yet-complete only (showing ${activePlan.length}):\nbulk|desc|week|qty|status`);
  for (const r of activePlan) {
    parts.push(`${r.bulkCode||"-"}|${d(r.description,26)}|${r.plannedWeek||"-"}|${r.quantity??"-"}|${r.statusText||r.status}`);
  }

  // Bulk open POs — cap 15 (this sheet only ever contains open orders)
  parts.push(`\nOpen bulk ingredient POs — these are ALL open (${openPOs.length} total, showing 15):\nvendor|desc|qty|due`);
  for (const r of openPOs.slice(0, 15)) {
    parts.push(`${d(r.vendorName,16)}|${d(r.description,26)}|${r.orderQuantity??"-"}|${r.dueDate||"-"}`);
  }

  // Packing — urgent only, cap 10
  const urgentPack = packing.filter((r) => r.urgency === "overdue" || r.urgency === "this_week");
  parts.push(`\nUrgent packing — overdue or due this week only (${urgentPack.length} total, showing 10):\ndesc|bal|due`);
  for (const r of urgentPack.slice(0, 10)) {
    parts.push(`${d(r.description,26)}|${r.balance??"-"}|${r.dueDate||"-"}`);
  }

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as { messages: { role: string; content: string }[] };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not set in .env.local" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let context: string;
  try {
    context = await buildContext();
  } catch (e) {
    context = "(Could not load live data: " + String(e) + ")";
  }

  const systemPrompt = `You are a knowledgeable assistant for Wild Nutrition, a UK supplement company. Answer questions accurately using ONLY the live data below. Today: ${new Date().toLocaleDateString("en-GB")}. Cover=weeks of stock remaining. WNP=internal factory.

## Part-number coding — CRITICAL, always apply:
- 1-code (starts with 10000): Bulk / Capsules — the encapsulated product. Use ONLY for questions about bulk/capsule production, ETA, or cost.
- 2-code (starts with 2): Raw Materials — blended to create a 1-code bulk. Use for raw material questions.
- 3-code (starts with 3): Finished Goods — packing of bulk into consumer product. ALWAYS use 3-code rows for ANY question about packing. Never use 1-code rows for packing questions.
- 4-code (starts with 4): Ancillary items — labels, pouches, boxes, jars, lids/caps.

## Cost formula:
- Price in External Production is per 1,000 capsules/units. Order qty is in thousands.
- Total cost = quantity × cost_per_unit (e.g. qty=325, cost=£11.39 → total=£3,701.75)

## Query rules:
- "When is X arriving / delivery ETA" → use OPEN orders only; find the row whose description/part matches, return the due date.
- "Packing" questions → filter to 3-code part numbers only.
- "Bulk / capsule" questions → filter to 1-code part numbers only.
- "Raw material" questions → filter to 2-code part numbers only.
- Ambiguous product names (multiple rows match) → list ALL matching rows with PO, vendor, qty, due date, cost — don't pick one at random.
- Historical spend questions (e.g. "how much did we spend Jan–Mar") → use ALL orders in the date range (open AND completed), filter by code type, return PO-by-PO breakdown then grand total.
- If something genuinely isn't in the data, say so — don't invent it.

LIVE DATA:
${context}`;

  // Only keep the last few turns to stay well under Groq's free-tier TPM limit
  const recentMessages = messages.slice(-6);

  const body = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.2,
    max_tokens: 600,
    stream: true,
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    return new Response(JSON.stringify({ error: err }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream OpenAI-compatible SSE → plain text to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const text = parsed?.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // ignore malformed chunks
          }
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
