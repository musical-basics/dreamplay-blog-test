"use server"

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

function getSupabase() {
    return createClient(supabaseUrl, supabaseServiceKey)
}

// ─── Tag CRUD ────────────────────────────────────────

export async function getAllTags() {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from("asset_tags")
        .select("*")
        .order("name")

    if (error) return []
    return data
}

export async function createTag(name: string, color: string) {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from("asset_tags")
        .insert({ name: name.trim(), color })
        .select()
        .single()

    if (error) return { success: false, error: error.message }
    return { success: true, tag: data }
}

export async function updateTag(id: string, name: string, color: string) {
    const supabase = getSupabase()
    const { error } = await supabase
        .from("asset_tags")
        .update({ name: name.trim(), color })
        .eq("id", id)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function deleteTag(id: string) {
    const supabase = getSupabase()
    // asset_tag_links will cascade-delete automatically
    const { error } = await supabase
        .from("asset_tags")
        .delete()
        .eq("id", id)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// ─── Asset ↔ Tag Linking ─────────────────────────────

export async function getAllAssetTagLinks() {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from("asset_tag_links")
        .select("asset_id, tag_id")

    if (error) return []
    return data as { asset_id: string; tag_id: string }[]
}

export async function setAssetTags(assetId: string, tagIds: string[]) {
    const supabase = getSupabase()

    // 1. Remove existing links for this asset
    await supabase
        .from("asset_tag_links")
        .delete()
        .eq("asset_id", assetId)

    // 2. Insert new links (if any)
    if (tagIds.length > 0) {
        const rows = tagIds.map(tagId => ({ asset_id: assetId, tag_id: tagId }))
        const { error } = await supabase
            .from("asset_tag_links")
            .insert(rows)

        if (error) return { success: false, error: error.message }
    }

    return { success: true }
}
