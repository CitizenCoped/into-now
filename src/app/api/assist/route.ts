import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const assistSchema = z.object({
  category: z.string().optional(),
  titleDraft: z.string().optional(),
  descriptionDraft: z.string().optional(),
  intent: z.string().optional(),
});

const SYSTEM_PROMPT = `You are Grok, the posting coach for into.now — a map-based discovery app with the tagline "what are you into? NOW?"

Help users write compelling, honest, local listings. Be warm, direct, and energetic. Keep titles punchy (under 60 chars). Descriptions should be clear and inviting (2-4 sentences). Match the category tone. Never be spammy, misleading, or overly salesy.

Respond ONLY with valid JSON in this shape:
{
  "suggestedTitle": "string",
  "suggestedDescription": "string",
  "tips": ["string"],
  "category": "string or null"
}`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Grok isn't connected. Add XAI_API_KEY to enable post coaching." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const parsed = assistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { category, titleDraft, descriptionDraft, intent } = parsed.data;

  const userMessage = [
    category && `Category: ${category}`,
    titleDraft && `Title draft: ${titleDraft}`,
    descriptionDraft && `Description draft: ${descriptionDraft}`,
    intent && `User intent: ${intent}`,
    "Please suggest an improved title and description for this into.now post.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    let message = "Grok is unavailable right now. Try again shortly.";

    try {
      const parsed = JSON.parse(err);
      const errorText: string = parsed.error ?? "";
      if (errorText.includes("credits") || errorText.includes("spending limit")) {
        message =
          "Grok credits are exhausted. Add credits or raise your spending limit at console.x.ai.";
      } else if (errorText.includes("doesn't have any credits or licenses")) {
        message = "Grok isn't licensed yet. Add credits at console.x.ai.";
      }
    } catch {
      // keep default message
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const suggestion = JSON.parse(jsonMatch?.[0] ?? content);
    return NextResponse.json(suggestion);
  } catch {
    return NextResponse.json({
      suggestedTitle: titleDraft ?? "",
      suggestedDescription: content,
      tips: ["Review Grok's suggestion and edit before posting."],
      category: category ?? null,
    });
  }
}
