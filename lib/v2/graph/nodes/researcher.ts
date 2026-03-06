import { getAllContextForAudience, formatContextForPrompt } from "@/app/actions/settings"
import { knowledgeTool } from "../tools/knowledgeTool"
import type { BlogState } from "../state"

/**
 * V2 Blog Node: Researcher
 * Gathers audience context, knowledge search, AND asset library context.
 */
export async function researcherNode(state: BlogState): Promise<Partial<BlogState>> {
    const audience = (state.audienceContext || "dreamplay") as "dreamplay" | "musicalbasics" | "both"
    console.log(`[V2 Blog Researcher] Gathering context (audience: ${audience}, imageMode: ${state.imageMode || "library"})`)

    // 1. Audience context
    let dynamicContext = ""
    let linksBlock = ""
    try {
        const payload = await getAllContextForAudience(audience)
        const formatted = await formatContextForPrompt(payload, audience)
        dynamicContext = formatted.contextBlock
        linksBlock = formatted.linksBlock
    } catch (error) {
        console.error("[V2 Blog Researcher] Audience context error:", error)
    }

    // 2. Knowledge search
    let researchBlock = ""
    if (!state.isQuestion) {
        try {
            const result = await knowledgeTool.invoke({
                query: state.intentSummary || state.userPrompt,
                topK: 2,
            })
            if (result && !result.includes("No relevant research") && !result.includes("unavailable")) {
                researchBlock = result
            }
        } catch (error) {
            console.error("[V2 Blog Researcher] Knowledge search error:", error)
        }
    }

    // 3. Asset library context
    let imageContextBlock = ""
    let imageRuleBlock = `4. **IMAGE VARIABLES:** When adding images, the \`src\` attribute MUST use {{mustache}} variables.`

    const imageMode = state.imageMode || "library"

    if (imageMode === "library") {
        try {
            const { getDescribedAssets } = await import("@/app/actions/assets")
            const library = await getDescribedAssets()
            if (library && library.length > 0) {
                const libraryText = library.map((img: { public_url: string; description: string; tags?: string[] }) => {
                    let line = `- URL: ${img.public_url}\n  Description: ${img.description}`
                    if (img.tags && img.tags.length > 0) line += `\n  Tags: ${img.tags.join(", ")}`
                    return line
                }).join("\n\n")
                imageContextBlock = `\n### ASSET LIBRARY:\nYou have access to the following pre-uploaded images.\n${libraryText}\n`
                imageRuleBlock = `4. **IMAGE HANDLING (LIBRARY MODE):** ALWAYS use {{mustache}} variables for src. Map URLs to variables in suggestedAssets. If no library image fits, use Pollinations: \`https://image.pollinations.ai/prompt/{URL_ENCODED_PROMPT}?width=800&height=400&nologo=true\`.`
            }
        } catch {
            // No asset library available
        }
    } else if (imageMode === "creative") {
        imageRuleBlock = `4. **IMAGE HANDLING (CREATIVE MODE):** ALWAYS use {{mustache}} variables for src. Map to Pollinations URLs in suggestedAssets: \`https://image.pollinations.ai/prompt/{URL_ENCODED_PROMPT}?width=800&height=400&nologo=true\`.`
    }

    return {
        dynamicContext,
        linksBlock,
        researchBlock,
        aiDossier: state.aiDossier || "",
        imageContextBlock,
        imageRuleBlock,
    }
}
