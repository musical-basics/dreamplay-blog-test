"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ─── Types ──────────────────────────────────────────────

export type AudienceContext = "dreamplay" | "musicalbasics" | "crossover"
export type Brand = "dreamplay" | "musicalbasics"

export interface DefaultLinks {
    unsubscribe_url: string
    privacy_url: string
    contact_url: string
    about_url: string
    shipping_url: string
    main_cta_url: string
    main_activate_url: string
    crowdfunding_cta_url: string
    homepage_url: string
}

const DEFAULT_LINKS_EMPTY: DefaultLinks = {
    unsubscribe_url: "",
    privacy_url: "",
    contact_url: "",
    about_url: "",
    shipping_url: "",
    main_cta_url: "",
    main_activate_url: "",
    crowdfunding_cta_url: "",
    homepage_url: "",
}

// ─── Context (per audience) ─────────────────────────────

function contextKey(audience: AudienceContext): string {
    return `context_${audience}`
}

export async function getCompanyContext(audience: AudienceContext = "dreamplay"): Promise<string> {
    const supabase = await createClient()

    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", contextKey(audience))
        .single()

    if (data?.value) return data.value

    if (audience !== "crossover") {
        const { data: legacy } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "company_context")
            .single()
        return legacy?.value || ""
    }

    return ""
}

export async function saveCompanyContext(audience: AudienceContext, newContext: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            key: contextKey(audience),
            value: newContext,
            updated_at: new Date().toISOString()
        })

    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    return { success: true }
}

// ─── Links (per brand) ──────────────────────────────────

function linksKey(brand: Brand): string {
    return `links_${brand}`
}

export async function getDefaultLinks(brand: Brand = "dreamplay"): Promise<DefaultLinks> {
    const supabase = await createClient()

    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", linksKey(brand))
        .single()

    if (data?.value) {
        try { return JSON.parse(data.value) } catch { }
    }

    const { data: legacy } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "default_links")
        .single()

    if (legacy?.value) {
        try { return JSON.parse(legacy.value) } catch { }
    }

    return DEFAULT_LINKS_EMPTY
}

export async function saveDefaultLinks(brand: Brand, links: DefaultLinks) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            key: linksKey(brand),
            value: JSON.stringify(links),
            updated_at: new Date().toISOString()
        })

    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    return { success: true }
}

// ─── Custom Links ───────────────────────────────────────

export interface CustomLink {
    label: string
    url: string
}

function customLinksKey(brand: Brand): string {
    return `custom_links_${brand}`
}

export async function getCustomLinks(brand: Brand = "dreamplay"): Promise<CustomLink[]> {
    const supabase = await createClient()

    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", customLinksKey(brand))
        .single()

    if (data?.value) {
        try { return JSON.parse(data.value) } catch { }
    }

    return []
}

export async function saveCustomLinks(brand: Brand, links: CustomLink[]) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("app_settings")
        .upsert({
            key: customLinksKey(brand),
            value: JSON.stringify(links),
            updated_at: new Date().toISOString()
        })

    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    return { success: true }
}

// ─── Composite helper for Copilot routes ────────────────

export interface AudiencePayload {
    contexts: { audience: AudienceContext; text: string }[]
    links: { brand: Brand; links: DefaultLinks }[]
}

export async function getAllContextForAudience(
    audience: "dreamplay" | "musicalbasics" | "both"
): Promise<AudiencePayload> {
    if (audience === "both") {
        const [ctxMB, ctxDP, ctxCross, linksMB, linksDP] = await Promise.all([
            getCompanyContext("musicalbasics"),
            getCompanyContext("dreamplay"),
            getCompanyContext("crossover"),
            getDefaultLinks("musicalbasics"),
            getDefaultLinks("dreamplay"),
        ])
        return {
            contexts: [
                { audience: "crossover", text: ctxCross },
                { audience: "musicalbasics", text: ctxMB },
                { audience: "dreamplay", text: ctxDP },
            ],
            links: [
                { brand: "musicalbasics", links: linksMB },
                { brand: "dreamplay", links: linksDP },
            ],
        }
    }

    const [ctx, links] = await Promise.all([
        getCompanyContext(audience),
        getDefaultLinks(audience),
    ])

    return {
        contexts: [{ audience, text: ctx }],
        links: [{ brand: audience, links }],
    }
}

export async function formatContextForPrompt(
    payload: AudiencePayload,
    audience: "dreamplay" | "musicalbasics" | "both"
): Promise<{ contextBlock: string; linksBlock: string }> {
    if (audience === "both") {
        const crossover = payload.contexts.find(c => c.audience === "crossover")
        const mb = payload.contexts.find(c => c.audience === "musicalbasics")
        const dp = payload.contexts.find(c => c.audience === "dreamplay")
        const linksMB = payload.links.find(l => l.brand === "musicalbasics")
        const linksDP = payload.links.find(l => l.brand === "dreamplay")

        const formatLinks = (links?: DefaultLinks) => {
            if (!links) return ""
            const entries = Object.entries(links).filter(([_, v]) => v)
            return entries.length > 0 ? entries.map(([k, v]) => `- ${k}: ${v}`).join("\n") : "No links configured."
        }

        const contextBlock = `
### AUDIENCE RELATIONSHIP & HIERARCHY:
${crossover?.text || "This audience bridges both brands."}

### BRAND 1: MUSICALBASICS
${mb?.text || "No context configured."}

### BRAND 2: DREAMPLAY
${dp?.text || "No context configured."}`

        const linksBlock = `
### DEFAULT LINKS — MUSICALBASICS:
${formatLinks(linksMB?.links)}

### DEFAULT LINKS — DREAMPLAY:
${formatLinks(linksDP?.links)}`

        return { contextBlock, linksBlock }
    }

    const ctx = payload.contexts[0]
    const lnk = payload.links[0]

    const entries = Object.entries(lnk?.links || {}).filter(([_, v]) => v)
    const linksBlock = entries.length > 0
        ? `\n### DEFAULT LINKS:\nWhen creating NEW blog posts, use these URLs as defaults for CTAs and links. Use {{mustache}} variables for CTA links.\n${entries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n`
        : ""

    return {
        contextBlock: ctx?.text || "",
        linksBlock,
    }
}
