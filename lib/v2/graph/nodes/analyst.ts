import { GoogleGenAI } from "@google/genai"
import type { BlogState } from "../state"

/**
 * V2 Blog Node: Analyst
 * Smart Router + intent classification + question detection.
 * Same logic as email analyst, adapted for blog context.
 */
export async function analystNode(state: BlogState): Promise<Partial<BlogState>> {
    console.log(`[V2 Blog Analyst] Analyzing request intent...`)
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const lastUserMessage = state.messages?.filter(m => m.role === "user").pop()
    const hasImages = (lastUserMessage?.images?.length ?? 0) > 0
    const isEmpty = !state.currentHtml || state.currentHtml.trim() === ""

    let resolvedModel = state.modelTier || "auto"
    let routingReason = ""
    let isQuestion = false

    if (resolvedModel === "auto") {
        if (isEmpty) {
            resolvedModel = "claude-sonnet-4-20250514"
            routingReason = "New blog post from scratch → Medium (Claude Sonnet)."
        } else if (hasImages) {
            resolvedModel = "claude-sonnet-4-20250514"
            routingReason = "Vision task (screenshot reference) → Medium (Claude Sonnet)."
        } else {
            try {
                const routerResponse = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{
                        role: "user", parts: [{
                            text: `You are a routing agent for a blog post editor.
User request: "${lastUserMessage?.content || state.userPrompt}"
Is this a simple edit (changing text, fixing a typo, updating a color) or a complex edit (creating new sections, structural redesign, new blog post)?
Also determine: is this a QUESTION or an EDIT?
Reply ONLY with: {"complexity": "SIMPLE" or "COMPLEX", "isQuestion": true or false}` }]
                    }]
                })
                const rawText = (routerResponse.text || "").trim()
                try {
                    let jsonStr = rawText
                    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "")
                    else if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "")
                    const parsed = JSON.parse(jsonStr)
                    isQuestion = parsed.isQuestion === true
                    if ((parsed.complexity || "").toUpperCase().includes("COMPLEX")) {
                        resolvedModel = "claude-sonnet-4-20250514"
                        routingReason = "Complex structural edit → Medium (Claude Sonnet)."
                    } else {
                        resolvedModel = "claude-haiku-4-5-20251001"
                        routingReason = "Simple text/style edit → Low (Claude Haiku)."
                    }
                } catch {
                    resolvedModel = "claude-sonnet-4-20250514"
                    routingReason = "Router parse fallback → Medium (Claude Sonnet)."
                }
            } catch {
                resolvedModel = "claude-sonnet-4-20250514"
                routingReason = "Router error fallback → Medium (Claude Sonnet)."
            }
        }
    }

    let intentSummary = state.userPrompt
    try {
        const summaryResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: `Summarize the user's blog editing request in 1-2 sentences.\nUser request: "${state.userPrompt}"\n${state.currentHtml ? `Existing HTML: ${state.currentHtml.length} chars` : "No existing HTML"}\nReply with ONLY the summary.` }] }]
        })
        intentSummary = (summaryResponse.text || state.userPrompt).trim()
    } catch { /* fallback to raw prompt */ }

    console.log(`[V2 Blog Analyst] Model: ${resolvedModel} | ${routingReason}`)
    return { resolvedModel, routingReason, isQuestion, intentSummary }
}
