"use server"

import Anthropic from "@anthropic-ai/sdk";

export async function getAnthropicModels() {
    if (!process.env.ANTHROPIC_API_KEY) return []

    try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const list = await anthropic.models.list();

        return list.data
            .map(m => m.id)
            .filter(id => id.includes("claude"))
            .sort((a, b) => b.localeCompare(a));
    } catch (e) {
        console.error("Failed to fetch Anthropic models:", e);
        return [];
    }
}
