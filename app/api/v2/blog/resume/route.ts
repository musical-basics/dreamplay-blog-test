import { NextResponse } from "next/server"
import { Command } from "@langchain/langgraph"
import { buildBlogGraph } from "@/lib/v2/graph/graph"
import type { BlogState } from "@/lib/v2/graph/state"

/**
 * V2 Blog HITL Resume API — Command Endpoint
 * Same pattern as email resume route.
 */
export async function POST(req: Request) {
    try {
        const { thread_id, decision, notes = "", editedHtml } = await req.json()

        if (!thread_id) return NextResponse.json({ error: "thread_id is required" }, { status: 400 })
        if (!decision) return NextResponse.json({ error: "decision is required" }, { status: 400 })

        const compiledGraph = buildBlogGraph()
        const currentState = await compiledGraph.getState({ configurable: { thread_id } })

        if (!currentState?.values) return NextResponse.json({ error: "Thread not found" }, { status: 404 })

        const state = currentState.values as BlogState

        if (decision === "rejected") {
            return NextResponse.json({
                updatedHtml: state.currentHtml || "",
                explanation: "Draft rejected.",
                thread_id,
                meta: state.usageMeta,
            })
        }

        const resumePayload: Record<string, unknown> = { decision, notes }
        if (decision === "edit" && editedHtml) resumePayload.editedHtml = editedHtml

        const result = await compiledGraph.invoke(new Command({ resume: resumePayload }), { configurable: { thread_id } })
        const finalState = result as BlogState

        const response: Record<string, unknown> = {
            updatedHtml: finalState.finalHtml || finalState.draftHtml || state.currentHtml,
            explanation: finalState.explanation || "Changes applied after review.",
            suggestedAssets: finalState.suggestedAssets || {},
            suggestedThumbnail: finalState.suggestedThumbnail || "",
            thread_id,
            meta: finalState.usageMeta,
        }

        return NextResponse.json(response)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
