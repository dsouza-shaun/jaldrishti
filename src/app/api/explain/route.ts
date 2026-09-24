import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// POST /api/explain
//
// Receives the FULL structured analysis JSON (already computed by the
// deterministic rule engine) and asks the LLM to produce a plain-language
// explanation + suggested follow-up questions.
//
// IMPORTANT: The AI is NOT asked to decide feasibility. The structured
// classification in the JSON is the authoritative answer; the LLM only
// summarises it.
//
// Body:
//   { analysis: <AnalysisResult JSON> }
//
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const analysis = body.analysis;
    if (!analysis) {
      return NextResponse.json({ error: "Missing analysis" }, { status: 400 });
    }

    const classification = analysis.classification?.classification ?? "Unknown";
    const reasons: string[] = analysis.classification?.reasons ?? [];
    const water = analysis.waterDemand ?? {};
    const gw = analysis.groundwater ?? {};
    const rf = analysis.rainfall ?? {};
    const eco = analysis.ecology ?? {};
    const reg = analysis.regulatory ?? {};
    const power = analysis.power ?? {};

    // Build a compact, well-structured prompt for the LLM.
    const systemPrompt = `You are the explanation layer of JalDrishti, a pre-development feasibility screening system for data-centre projects in India.

Your role:
1. You are given a STRUCTURED JSON result that was already produced by deterministic rule engines.
2. You must NOT re-decide feasibility. The classification field is authoritative.
3. You write a concise, plain-language explanation of WHY the system produced this classification, citing the underlying data and the rule.
4. You list 3-5 follow-up questions the developer should investigate next.
5. You distinguish VERIFIED evidence from PROXY / UNKNOWN evidence.
6. You never invent values, thresholds, or buffer distances that are not in the JSON.
7. You respond in well-structured Markdown.

Output format:
## Plain-language explanation
(2-3 short paragraphs)

## Evidence summary
- Verified: ...
- Proxy: ...
- Unknown: ...

## Suggested follow-up questions
1. ...
2. ...
3. ...
`;

    const userPrompt = `Project: ${analysis.projectName}
Site: lat ${analysis.site?.latitude}, lng ${analysis.site?.longitude}
WKT: ${analysis.site?.pointWkt}

CLASSIFICATION: ${classification}
Reasons:
${reasons.map((r: string) => `- ${r}`).join("\n")}

Water demand:
- IT load: ${analysis.projectName ? "" : ""}${body.itLoad ?? "n/a"} MW
- Daily water: ${water.waterKlPerDay ?? "n/a"} kL/day
- Annual water: ${water.waterMcmPerYear ?? "n/a"} MCM/year
- WUE used: ${water.wueUsed ?? "n/a"} L/kWh (${water.wueSource ?? "n/a"})

Groundwater:
- Block: ${gw.block ?? "UNKNOWN"} (${gw.district ?? ""}, ${gw.state ?? ""})
- Category: ${gw.category ?? "UNKNOWN"}
- Stage of development: ${gw.stage ?? "n/a"}%
- TDS: ${gw.tds ?? "n/a"} mg/L
- Distance to block centroid: ${gw.distanceKm?.toFixed(2) ?? "n/a"} km
- Evidence: ${gw.provenance?.evidenceStatus ?? "UNKNOWN"}

Rainfall:
- Nearest station: ${rf.station ?? "UNKNOWN"} (${rf.distanceKm?.toFixed(2) ?? "n/a"} km away)
- Annual normal: ${rf.annualNormal ?? "n/a"} mm
- Monsoon normal: ${rf.monsoonNormal ?? "n/a"} mm
- Evidence: ${rf.provenance?.evidenceStatus ?? "UNKNOWN"}

Ecology:
- ESZ overlap: ${eco.esz?.overlap ?? false} (nearest: ${eco.esz?.nearestDistanceKm?.toFixed(2) ?? "n/a"} km)
- Forest overlap: ${eco.forest?.overlap ?? false} (nearest: ${eco.forest?.nearestDistanceKm?.toFixed(2) ?? "n/a"} km)
- Wetland overlap: ${eco.wetland?.overlap ?? false} (nearest: ${eco.wetland?.nearestDistanceKm?.toFixed(2) ?? "n/a"} km)
- CRZ overlap: ${eco.crz?.overlap ?? false} (nearest: ${eco.crz?.nearestDistanceKm?.toFixed(2) ?? "n/a"} km)

Regulatory:
- CGWA: ${reg.cgwa?.outcome ?? "n/a"} (hard constraint: ${reg.cgwa?.hardConstraint ?? false})
- EC: ${reg.ec?.outcome ?? "n/a"}
- SPCB: ${reg.spcb?.outcome ?? "n/a"}

Power:
- Timeline: ${power.timeline ?? "UNKNOWN"}
- Evidence: ${power.provenance?.evidenceStatus ?? "UNKNOWN"}
`;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 900,
    });

    // SDK shape varies - try common paths
    const completionAny = completion as unknown as {
      choices?: Array<{ message?: { content?: string }; text?: string }>;
      content?: string;
    };
    const text: string =
      completionAny.choices?.[0]?.message?.content ??
      completionAny.content ??
      completionAny.choices?.[0]?.text ??
      "";

    return NextResponse.json({ explanation: text, prompt: userPrompt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
