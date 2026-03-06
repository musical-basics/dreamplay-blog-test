import { StateGraph, END } from "@langchain/langgraph"
import { BlogGraphState, type BlogState } from "./state"
import { getCheckpointer } from "./checkpointer"
import { analystNode } from "./nodes/analyst"
import { researcherNode } from "./nodes/researcher"
import { drafterNode } from "./nodes/drafter"
import { criticNode } from "./nodes/critic"

/**
 * V2 Blog Generation Graph
 * Analyst → Researcher → Drafter → Critic (with Drafter/Critic loop)
 */

function routeAfterCritic(state: BlogState): string {
    if (state.critic_feedback !== "PASS" && (state.revision_count || 0) < 2) {
        return "drafter"
    }
    return END
}

interface BuildOptions {
    interruptBeforeCritic?: boolean
}

export function buildBlogGraph(options: BuildOptions = {}) {
    const checkpointer = getCheckpointer()

    const graph = new StateGraph(BlogGraphState)
        .addNode("analyst", analystNode)
        .addNode("researcher", researcherNode)
        .addNode("drafter", drafterNode)
        .addNode("critic", criticNode)
        .addEdge("__start__", "analyst")
        .addEdge("analyst", "researcher")
        .addEdge("researcher", "drafter")
        .addEdge("drafter", "critic")
        .addConditionalEdges("critic", routeAfterCritic, {
            drafter: "drafter",
            [END]: END,
        })

    const compileOptions: Record<string, unknown> = { checkpointer }
    if (options.interruptBeforeCritic) {
        compileOptions.interruptBefore = ["critic"]
    }

    return graph.compile(compileOptions)
}
