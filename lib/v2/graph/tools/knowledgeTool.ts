import { tool } from "@langchain/core/tools"
import { z } from "zod"

/**
 * V2 Tool: Knowledge Search (Blog)
 * Same as email repo — strict zod schema (Directive 2).
 */

const KNOWLEDGE_API_URL = process.env.NEXT_PUBLIC_KNOWLEDGE_API_URL || "http://localhost:3004"
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || ""

export const knowledgeTool = tool(
    async ({ query, topK }): Promise<string> => {
        console.log(`[V2 KnowledgeTool] Searching: "${query}" (topK: ${topK})`)
        try {
            const response = await fetch(
                `${KNOWLEDGE_API_URL}/api/v2/knowledge/llamaindex-search`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-api-secret": INTERNAL_API_SECRET,
                    },
                    body: JSON.stringify({ query, topK }),
                }
            )
            if (!response.ok) return `Knowledge search failed (HTTP ${response.status}).`
            const data = await response.json()
            if (!data.results || data.results.length === 0) return "No relevant research found."
            return data.results.map((r: { score: number; metadata: { title: string; author: string; year: string }; text: string }, i: number) =>
                `[${i + 1}] "${r.metadata.title}" by ${r.metadata.author} (${r.metadata.year}) [score: ${r.score.toFixed(3)}]\n${r.text}`
            ).join("\n\n---\n\n")
        } catch (error) {
            console.error("[V2 KnowledgeTool] Error:", error)
            return "Knowledge search unavailable."
        }
    },
    {
        name: "knowledge_search",
        description: "Search the DreamPlay research vector database for relevant context to support blog content generation.",
        schema: z.object({
            query: z.string().describe("The semantic search query"),
            topK: z.number().optional().default(3).describe("Number of results (1-10)"),
        }),
    }
)
