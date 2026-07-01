import { NextRequest } from "next/server";
import { fetchSkus, fetchProduction, fetchWNPPlanning, fetchBulkOpenPOs, fetchPackingSchedule } from "@/lib/sheets";

export const runtime = "nodejs";

async function buildContext(): Promise<string> {
  const [skus, production, planning, openPOs, packing] = await Promise.all([
    fetchSkus(),
    fetchProduction(),
    fetchWNPPlanning(),
    fetchBulkOpenPOs(),
    fetchPackingSchedule(),
  ]);

  const d = (s: string, n = 32) => (s ?? "").slice(0, n);
  const parts: string[] = [];

  // 1. Critical SKUs — cover < 8 weeks, capped 20
  const critical = skus
    .filter((s) => s.cover !== null && s.cover < 8)
    .sort((a, b) => (a.cover ?? 999) - (b.cover ?? 999))
    .slice(0, 20);
  parts.push(`## Critical SKUs (<8w cover) — ${skus.length} total SKUs in system\ncode|name|cover|stock|next_bulk_del|next_pack_del`);
  for (const s of critical) {
    parts.push(`${s.skuCode}|${d(s.description)}|${s.cover}w|${s.inventory??"-"}|${s.nextBulkDelivery||"-"}|${s.nextPackingDelivery||"-"}`);
  }

  // 2. Internal WNP planning — ALL rows (active + complete) so batch/history questions work
  // Take last 80 rows from the sheet (sheet order = chronological, newest at bottom)
  const allPlan = planning.slice(-80);
  parts.push(`\n## Internal WNP Production Planning — ALL rows incl. completed (${allPlan.length} of ${planning.length} shown, most recent last)\nwo|bulk_code|prod_code|description|fill|week|qty_planned|qty_produced|batch|bbd|completed|status`);
  for (const r of allPlan) {
    parts.push(`${r.workOrderNo||"-"}|${r.bulkCode||"-"}|${r.productCode||"-"}|${d(r.description)}|${r.fill??"-"}|${r.plannedWeek||"-"}|${r.quantity??"-"}|${r.quantityProduced??"-"}|${r.batch||"-"}|${r.bbd||"-"}|${r.dateCompleted||"-"}|${r.statusText||r.status}`);
  }

  // 3. External production POs — ALL (open + complete), newest first, cap 35
  const sortedProd = [...production]
    .sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""))
    .slice(0, 35);
  parts.push(`\n## External Production POs (ALL open+completed, ${sortedProd.length} of ${production.length} shown)\npo|wo|part|description|due|qty|received|£/unit|status`);
  for (const r of sortedProd) {
    parts.push(`${r.order||"-"}|${r.workOrder||"-"}|${r.partNumber||"-"}|${d(r.description)}|${r.dueDate||"-"}|${r.quantity??"-"}|${r.received??"-"}|£${r.costPerUnit??"-"}|${r.status}`);
  }

  // 4. Open bulk ingredient POs (this sheet = open only), cap 20
  parts.push(`\n## Open Bulk Ingredient POs (${openPOs.length} total, showing 20)\npo|vendor|part|description|qty|due`);
  for (const r of openPOs.slice(0, 20)) {
    parts.push(`${r.order||"-"}|${d(r.vendorName,18)}|${r.partNumber||"-"}|${d(r.description)}|${r.orderQuantity??"-"}|${r.dueDate||"-"}`);
  }

  // 5. Packing schedule — all upcoming + overdue, cap 20
  const upcomingPack = packing
    .filter((r) => r.urgency !== undefined)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 20);
  parts.push(`\n## Packing Schedule (${upcomingPack.length} of ${packing.length} shown, sorted by due date)\npart|description|due|balance|vendor|urgency`);
  for (const r of upcomingPack) {
    parts.push(`${r.partNumber||"-"}|${d(r.description)}|${r.dueDate||"-"}|${r.balance??"-"}|${d(r.vendorName||"Internal",18)}|${r.urgency}`);
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

## Planning data fields:
- wo = work order number, bulk_code = 1-code bulk ingredient, prod_code = 3-code finished product
- fill = capsule count per batch (e.g. 90, 60) — NOT a percentage
- qty_planned = batches planned, qty_produced = batches actually made
- batch = batch number, bbd = best before date, completed = date production finished
- status: planned / in_progress / complete

## Query rules:
- Batch/production history questions → search the WNP Planning table by description, bulk_code, prod_code, or batch number. Include completed rows.
- "When is X arriving / delivery ETA" → OPEN orders only; match by description or part number, return due date.
- "Packing" questions → filter to 3-code part numbers only (prod_code or part column).
- "Bulk / capsule production" questions → filter to 1-code (bulk_code column in planning, or part starting with 10000 in external POs).
- "Raw material" questions → filter to 2-code part numbers.
- Ambiguous product names → list ALL matching rows with key identifiers, don't guess.
- Historical spend (date range) → include ALL orders (open+completed) in that range, PO-by-PO breakdown then total.
- Never say "no data available" unless the relevant section is genuinely empty — search all sections before responding.
- Do NOT narrate your search process. Just return the answer directly with the matching rows. Skip lines like "I will look at..." or "I found that...". Start with the result.

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
    max_tokens: 800,
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
