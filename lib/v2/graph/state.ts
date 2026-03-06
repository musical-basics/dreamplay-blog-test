import { Annotation } from "@langchain/langgraph"

/**
 * V2 Blog Generation Pipeline — State Definition
 *
 * Extends the base email pattern with blog-specific fields:
 * - imageMode (library vs creative)
 * - themeHtml (design theme skeleton)
 * - suggestedAssets (variable → URL mapping)
 * - suggestedThumbnail
 */
export const BlogGraphState = Annotation.Root({
    // ── Input fields ─────────────────────────────────────
    userPrompt: Annotation<string>,
    currentHtml: Annotation<string>,
    audienceContext: Annotation<string>,
    platform: Annotation<string>({
        reducer: (_current, update) => update,
        default: () => "blog",
    }),

    // ── Blog-specific inputs ─────────────────────────────
    imageMode: Annotation<string>({
        reducer: (_current, update) => update,
        default: () => "library",
    }),
    themeHtml: Annotation<string>,
    hasThumbnail: Annotation<boolean>({
        reducer: (_current, update) => update,
        default: () => false,
    }),

    // ── Message history ──────────────────────────────────
    messages: Annotation<Array<{
        role: string
        content: string
        images?: Array<{ base64: string; mediaType: string }>
    }>>({
        reducer: (_current, update) => update,
        default: () => [],
    }),

    // ── Smart Router ─────────────────────────────────────
    modelTier: Annotation<string>({
        reducer: (_current, update) => update,
        default: () => "auto",
    }),
    routingReason: Annotation<string>({
        reducer: (_current, update) => update,
        default: () => "",
    }),
    resolvedModel: Annotation<string>,

    // ── Analyst output ───────────────────────────────────
    intentSummary: Annotation<string>,
    isQuestion: Annotation<boolean>({
        reducer: (_current, update) => update,
        default: () => false,
    }),

    // ── Context (Researcher) ─────────────────────────────
    dynamicContext: Annotation<string>,
    linksBlock: Annotation<string>,
    researchBlock: Annotation<string>,
    aiDossier: Annotation<string>,
    imageContextBlock: Annotation<string>,
    imageRuleBlock: Annotation<string>,

    // ── Pipeline control ─────────────────────────────────
    revision_count: Annotation<number>({
        reducer: (current, update) => current + update,
        default: () => 0,
    }),
    critic_feedback: Annotation<string>({
        reducer: (_current, update) => update,
        default: () => "",
    }),

    // ── Outputs ──────────────────────────────────────────
    draftHtml: Annotation<string>,
    finalHtml: Annotation<string>,
    explanation: Annotation<string>,
    suggestedAssets: Annotation<Record<string, string>>({
        reducer: (_current, update) => update,
        default: () => ({}),
    }),
    suggestedThumbnail: Annotation<string>,
    usageMeta: Annotation<{
        model: string
        inputTokens: number
        outputTokens: number
        cost: number
    } | null>({
        reducer: (_current, update) => update,
        default: () => null,
    }),
})

export type BlogState = typeof BlogGraphState.State
