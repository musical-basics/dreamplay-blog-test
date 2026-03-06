import { GoogleGenAI } from "@google/genai"
import type { BlogState } from "../state"

/**
 * V2 Blog Node: Critic
 * QA review with blog-specific checks (semantic HTML, no table layouts, fact verification).
 */
const MAX_REVISIONS = 2

export async function criticNode(state: BlogState): Promise<Partial<BlogState>> {
    const currentRevision = (state.revision_count || 0) + 1
    console.log(`[V2 Blog Critic] Auditing draft (revision ${currentRevision})...`)

    if (state.isQuestion) {
        console.log(`[V2 Blog Critic] Skipping (question detected)`)
        return { finalHtml: state.draftHtml || state.currentHtml || "", critic_feedback: "PASS", revision_count: 1 }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user", parts: [{
                text: `You are a strict QA Auditor for blog post HTML.

USER INTENT: ${state.intentSummary || state.userPrompt}

ORIGINAL HTML (${state.currentHtml?.length || 0} chars):
${state.currentHtml ? state.currentHtml.substring(0, 2000) : "No original (new post)"}

DRAFT HTML (${state.draftHtml?.length || 0} chars):
${state.draftHtml ? state.draftHtml.substring(0, 3000) : "Empty draft"}

AUDIT CHECKLIST:
1. Does it start with <!DOCTYPE html> and end with </html>?
2. Are ALL original sections preserved (unless user asked to remove)?
3. Are {{mustache_vars}} intact?
4. NO table-based layouts (blog uses semantic HTML5 + Flexbox/Grid)?
5. No em-dashes (—) in copy?
6. No fabricated quotes or statistics?
7. Does it fulfill the user's intent?

Output ONLY: {"verdict": "PASS" or "FAIL", "issues": [...], "feedback": "..."}
FAIL only for critical issues.` }]
        }]
    })

    const rawText = (response.text || "").trim()
    let verdict = "PASS"
    let feedback = ""

    try {
        let jsonStr = rawText
        if (jsonStr.startsWith("```json")) jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "")
        else if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "")
        const parsed = JSON.parse(jsonStr)
        verdict = parsed.verdict === "FAIL" ? "FAIL" : "PASS"
        feedback = parsed.feedback || ""
    } catch {
        verdict = "PASS"
    }

    if (verdict === "FAIL" && currentRevision >= MAX_REVISIONS) {
        console.log(`[V2 Blog Critic] Max revisions reached, forcing PASS`)
        verdict = "PASS"
    }

    console.log(`[V2 Blog Critic] Verdict: ${verdict}`)
    return {
        finalHtml: verdict === "PASS" ? (state.draftHtml || state.currentHtml || "") : undefined,
        critic_feedback: verdict === "FAIL" ? feedback : "PASS",
        revision_count: 1,
    }
}
