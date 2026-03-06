import Anthropic from "@anthropic-ai/sdk"
import type { BlogState } from "../state"

/**
 * V2 Blog Node: Drafter
 * Generates or modifies blog post HTML using Claude.
 * System instruction extracted from blog copilot route.
 */
export async function drafterNode(state: BlogState): Promise<Partial<BlogState>> {
    const model = state.resolvedModel || "claude-sonnet-4-20250514"
    console.log(`[V2 Blog Drafter] Generating with ${model} (revision ${state.revision_count || 0})...`)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const systemInstruction = `
You are an expert Blog Post HTML Developer.
The user will give you HTML and a request. You are building web blog posts, NOT emails.

### 🛑 CRITICAL INTEGRITY RULES:
1. **NEVER DELETE CONTENT:** Unless explicitly asked to remove something, PRESERVE ALL existing sections.
2. **ALWAYS RETURN THE COMPLETE HTML DOCUMENT** starting with <!DOCTYPE html> and ending with </html>.
3. **EDITING TEXT = FULL HTML:** Return the full HTML document with only the requested text modified.

### CODING STANDARDS:
1. **LAYOUT:** Use modern HTML5 (<article>, <section>, <div>). CSS Flexbox/Grid allowed. NO TABLE LAYOUTS.
2. **RESPONSIVENESS:** Ensure sections stack on mobile. Use max-width containers with auto margins.
3. **VARIABLES:** Preserve {{mustache_vars}}.
${state.imageRuleBlock || "4. **IMAGE VARIABLES:** Use {{mustache}} variables for image src attributes."}
5. **NO EM-DASHES:** Never use em-dashes (—). Use commas, periods, or semicolons.
6. **READABLE COPY:** Use <strong> for key value propositions and <u> for supporting details.
7. **TYPOGRAPHY:** Use modern web fonts (system-ui, -apple-system). Good line-height (1.6-1.8).

### 🛑 STRICT FACT & QUOTE RULES:
1. NEVER invent quotes, testimonials, or people.
2. If you quote someone, it MUST be from the AUDIENCE INTELLIGENCE section.
3. Do NOT make up statistics. Use ONLY the exact data provided.

### TEMPLATE CREATION DEFAULTS:
When creating a NEW blog post:
- All text/copy MUST be hardcoded directly in the HTML.
- For images, follow the IMAGE HANDLING rule above.
- All non-image links MUST use {{mustache_variable}} names.
${!state.hasThumbnail ? `
### THUMBNAIL GENERATION:
Include a "suggestedThumbnail" field with a URL for the blog post thumbnail.
Use Pollinations: ?width=1200&height=630&nologo=true for optimal social sharing.
` : ""}

### RESPONSE FORMAT (STRICT JSON ONLY):
{
  "_thoughts": "Step-by-step analysis",
  "explanation": "Brief summary of changes",
  "suggestedAssets": { "hero_src": "https://..." },
  ${!state.hasThumbnail ? '"suggestedThumbnail": "https://...",' : ""}
  "updatedHtml": "<!DOCTYPE html>\\n<html>...</html>"
}

### QUESTION vs EDIT:
If the user is asking a QUESTION, set "updatedHtml" to the EXACT ORIGINAL HTML unchanged.
If the user mentions "blog post", "post", "article", or "build it out" — ALWAYS generate HTML.

### COMPANY CONTEXT:
${state.dynamicContext || ""}
${state.linksBlock || ""}
${state.aiDossier ? `\n### AUDIENCE INTELLIGENCE:\n${state.aiDossier}` : ""}
${state.researchBlock ? `\n### RESEARCH DATA:\n${state.researchBlock}` : ""}
${state.imageContextBlock || ""}
${state.themeHtml ? `\n### MANDATORY DESIGN THEME:\nUse this HTML/CSS structure as the foundation. Keep CSS intact, swap placeholder text.\n${state.themeHtml}` : ""}
${state.critic_feedback ? `\n### PREVIOUS AUDIT FEEDBACK:\n${state.critic_feedback}` : ""}
`

    const anthropicMessages = (state.messages || []).map(msg => {
        const role = (msg.role === "result" ? "assistant" : "user") as "assistant" | "user"
        const content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = []
        if (msg.images && msg.images.length > 0) {
            for (const img of msg.images) {
                content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } })
            }
        }
        if (msg.content) content.push({ type: "text", text: msg.content })
        return { role, content }
    })

    const lastMsg = anthropicMessages[anthropicMessages.length - 1]
    if (lastMsg && lastMsg.role === "user") {
        lastMsg.content.push({ type: "text", text: `\n\n### CURRENT HTML:\n${state.currentHtml || ""}` })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = anthropic.messages.stream({ model, max_tokens: 32768, temperature: 0, system: systemInstruction, messages: anthropicMessages as any })
    const msg = await stream.finalMessage()

    let rawResponse = ""
    const textBlock = msg.content[0]
    if (textBlock.type === "text") rawResponse = textBlock.text

    const PRICING: Record<string, { input: number; output: number }> = {
        "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
        "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
        "claude-sonnet-4-6": { input: 3.00, output: 15.00 },
    }
    let usageMeta = { model, inputTokens: 0, outputTokens: 0, cost: 0 }
    if (msg.usage) {
        const pricing = PRICING[model] || { input: 3, output: 15 }
        usageMeta = {
            model,
            inputTokens: msg.usage.input_tokens,
            outputTokens: msg.usage.output_tokens,
            cost: (msg.usage.input_tokens / 1_000_000 * pricing.input) + (msg.usage.output_tokens / 1_000_000 * pricing.output),
        }
    }

    let draftHtml = state.currentHtml || ""
    let explanation = "Changes applied."
    let suggestedAssets: Record<string, string> = {}
    let suggestedThumbnail = ""

    try {
        const start = rawResponse.indexOf("{")
        const end = rawResponse.lastIndexOf("}")
        if (start !== -1 && end !== -1 && end > start) {
            const parsed = JSON.parse(rawResponse.substring(start, end + 1))
            if (parsed.updatedHtml) draftHtml = parsed.updatedHtml
            if (parsed.explanation) explanation = parsed.explanation
            if (parsed.suggestedAssets) suggestedAssets = parsed.suggestedAssets
            if (parsed.suggestedThumbnail) suggestedThumbnail = parsed.suggestedThumbnail
        }
    } catch {
        const docMatch = rawResponse.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/i)
        if (docMatch) draftHtml = docMatch[1]
        else explanation = "Generated content but parsing failed. Please try again."
    }

    console.log(`[V2 Blog Drafter] Draft complete (${draftHtml.length} chars, cost: $${usageMeta.cost.toFixed(4)})`)

    return { draftHtml, explanation, suggestedAssets, suggestedThumbnail, usageMeta }
}
