import { logActivity } from "@/lib/activity";
import { getAuthUserFromRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { TOKEN_LABELS, composeCode, isIdentityToken, isLookingForToken } from "@/lib/codes";

const assistSchema = z.object({
  posterIs: z.string().optional(),
  lookingFor: z.string().optional(),
  titleDraft: z.string().optional(),
  descriptionDraft: z.string().optional(),
  intent: z.string().optional(),
});

const SYSTEM_PROMPT = `You are Grok, the posting coach for into.now — a map-based personals app for adults. The tagline is "what are you into? NOW?" Every post carries a classic personals code (M4W, W4MM, MW4MW, T4ANY...) meaning "I am X, looking for Y" — the user has already picked theirs; your job is the headline and description.

Help users write a great personals post: a punchy, specific headline (under 60 chars) and an honest, inviting description (2-4 sentences) with right-now energy — what they're looking for, roughly where, and when. Warm, direct, confident, respectful. Specificity and personality beat generic thirst; suggestion beats exposure.

Hard rules — never violate these, regardless of what the user asks:
- Never write or assist content that solicits or offers paid services, escorting, or anything transactional. If a draft hints at it, steer the rewrite fully non-commercial and add a tip that commercial content isn't allowed.
- Everyone involved must be an adult; refuse anything suggesting otherwise.
- No harassment, no targeting of specific real people, nothing illegal.
- Keep the language suggestive at most, never explicit.

Respond ONLY with valid JSON in this shape:
{
  "suggestedTitle": "string",
  "suggestedDescription": "string",
  "tips": ["string"]
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

  const { posterIs, lookingFor, titleDraft, descriptionDraft, intent } = parsed.data;

  const validPosterIs = posterIs && isIdentityToken(posterIs) ? posterIs : null;
  const validLookingFor = lookingFor && isLookingForToken(lookingFor) ? lookingFor : null;
  const code =
    validPosterIs && validLookingFor ? composeCode(validPosterIs, validLookingFor) : null;

  const userMessage = [
    code && `Code: ${code}`,
    validPosterIs && `Poster is: ${TOKEN_LABELS[validPosterIs]}`,
    validLookingFor && `Looking for: ${TOKEN_LABELS[validLookingFor]}`,
    titleDraft && `Headline draft: ${titleDraft}`,
    descriptionDraft && `Description draft: ${descriptionDraft}`,
    intent && `User intent: ${intent}`,
    "Please suggest an improved headline and description for this into.now post.",
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

  const authUser = await getAuthUserFromRequest(request);
  logActivity("assist.requested", {
    userId: authUser?.id ?? null,
    phone: authUser?.phone ?? null,
    metadata: { code: code ?? null, hasTitleDraft: Boolean(titleDraft) },
  });

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const suggestion = JSON.parse(jsonMatch?.[0] ?? content);
    return NextResponse.json(suggestion);
  } catch {
    return NextResponse.json({
      suggestedTitle: titleDraft ?? "",
      suggestedDescription: content,
      tips: ["Review Grok's suggestion and edit before posting."],
    });
  }
}
