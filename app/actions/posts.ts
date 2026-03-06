"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { Post } from "@/lib/types"

// ─── GET ALL POSTS ───────────────────────────────────────
export async function getPosts(): Promise<Post[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching posts:", error)
        return []
    }
    return data || []
}

// ─── GET SINGLE POST ─────────────────────────────────────
export async function getPost(id: string): Promise<Post | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .single()

    if (error) return null
    return data
}

// ─── CREATE POST ─────────────────────────────────────────
export async function createPost(data: {
    title: string
    slug?: string
    html_content?: string
    variable_values?: Record<string, any>
}): Promise<{ data: Post | null; error: string | null }> {
    const supabase = await createClient()

    const slug = data.slug || data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

    const { data: post, error } = await supabase
        .from("posts")
        .insert({
            title: data.title,
            slug,
            html_content: data.html_content || "",
            variable_values: data.variable_values || {},
        })
        .select("*")
        .single()

    if (error) return { data: null, error: error.message }

    revalidatePath("/")
    revalidatePath("/posts")
    return { data: post, error: null }
}

// ─── UPDATE POST ─────────────────────────────────────────
export async function updatePost(
    id: string,
    updates: Partial<Pick<Post, "title" | "slug" | "excerpt" | "category" | "featured_image" | "html_content" | "variable_values" | "status" | "published_at">>
): Promise<{ error: string | null }> {
    const supabase = await createClient()

    const { error } = await supabase
        .from("posts")
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/")
    revalidatePath("/posts")
    return { error: null }
}

// ─── DELETE POST ─────────────────────────────────────────
export async function deletePost(id: string): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { error } = await supabase.from("posts").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/")
    revalidatePath("/posts")
    return { error: null }
}

// ─── PUBLISH POST ────────────────────────────────────────
export async function publishPost(id: string): Promise<{ error: string | null }> {
    return updatePost(id, {
        status: "published",
        published_at: new Date().toISOString(),
    })
}

// ─── UNPUBLISH POST ──────────────────────────────────────
export async function unpublishPost(id: string): Promise<{ error: string | null }> {
    return updatePost(id, {
        status: "draft",
        published_at: null,
    })
}

// ─── TOGGLE POST STATUS ─────────────────────────────────
export async function togglePostStatus(id: string): Promise<Post | null> {
    const supabase = await createClient()
    const { data: post } = await supabase
        .from("posts")
        .select("status")
        .eq("id", id)
        .single()

    if (!post) return null

    const newStatus = post.status === "published" ? "draft" : "published"
    const { data: updated, error } = await supabase
        .from("posts")
        .update({
            status: newStatus,
            published_at: newStatus === "published" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single()

    if (error) return null

    revalidatePath("/")
    revalidatePath("/posts")
    return updated
}

// ─── BULK DELETE POSTS ───────────────────────────────────
export async function deletePosts(ids: string[]): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { error } = await supabase.from("posts").delete().in("id", ids)

    if (error) return { error: error.message }

    revalidatePath("/")
    revalidatePath("/posts")
    return { error: null }
}

// ─── BULK UPDATE STATUS ──────────────────────────────────
export async function updatePostsStatus(ids: string[], status: "draft" | "published"): Promise<{ error: string | null }> {
    const supabase = await createClient()
    const { error } = await supabase
        .from("posts")
        .update({
            status,
            published_at: status === "published" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        })
        .in("id", ids)

    if (error) return { error: error.message }

    revalidatePath("/")
    revalidatePath("/posts")
    return { error: null }
}

// ─── GET POST STATS ──────────────────────────────────────
export async function getPostStats(): Promise<{ total: number; published: number; draft: number }> {
    const supabase = await createClient()
    const { data } = await supabase
        .from("posts")
        .select("status")

    const posts = data || []
    return {
        total: posts.length,
        published: posts.filter(p => p.status === "published").length,
        draft: posts.filter(p => p.status === "draft").length,
    }
}

// ─── GET TEMPLATE LIST (for Copilot reference picker) ────
export async function getTemplateList(): Promise<{ id: string; name: string; created_at: string }[]> {
    const supabase = await createClient()
    const { data } = await supabase
        .from("posts")
        .select("id, title, created_at")
        .order("created_at", { ascending: false })
        .limit(50)

    return (data || []).map(p => ({
        id: p.id,
        name: p.title,
        created_at: p.created_at,
    }))
}

// ─── GET POST HTML (for Copilot reference capture) ───────
export async function getPostHtml(id: string): Promise<{ html_content: string | null; variable_values: Record<string, any> | null } | null> {
    const supabase = await createClient()
    const { data } = await supabase
        .from("posts")
        .select("html_content, variable_values")
        .eq("id", id)
        .single()

    return data
}

// ─── SAVE BACKUP (before each save) ──────────────────────
export async function savePostBackup(postId: string): Promise<void> {
    const supabase = await createClient()
    const { data: post } = await supabase
        .from("posts")
        .select("html_content, variable_values, title")
        .eq("id", postId)
        .single()

    if (!post || !post.html_content) return

    // Save a snapshot to post_versions
    await supabase.from("post_versions").insert({
        post_id: postId,
        html_content: post.html_content,
        prompt: `Backup: ${post.title}`,
    })

    // Keep only the last 5 versions per post
    const { data: versions } = await supabase
        .from("post_versions")
        .select("id")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })

    if (versions && versions.length > 10) {
        const idsToDelete = versions.slice(10).map(v => v.id)
        await supabase.from("post_versions").delete().in("id", idsToDelete)
    }
}

// ─── GET POST BACKUPS ────────────────────────────────────
export async function getPostBackups(postId: string): Promise<{ id: string; saved_at: string; title: string }[]> {
    const supabase = await createClient()
    const { data } = await supabase
        .from("post_versions")
        .select("id, created_at, prompt")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(20)

    return (data || []).map(v => ({
        id: v.id,
        saved_at: v.created_at,
        title: v.prompt || "Untitled version",
    }))
}

// ─── RESTORE BACKUP ──────────────────────────────────────
export async function restorePostBackup(postId: string, versionId: string): Promise<{ success: boolean; data?: { html_content: string; variable_values: Record<string, any> } }> {
    const supabase = await createClient()
    const { data: version } = await supabase
        .from("post_versions")
        .select("html_content")
        .eq("id", versionId)
        .single()

    if (!version) return { success: false }

    // Save current state as backup first
    await savePostBackup(postId)

    // Restore the version
    await supabase
        .from("posts")
        .update({
            html_content: version.html_content,
            updated_at: new Date().toISOString(),
        })
        .eq("id", postId)

    return {
        success: true,
        data: {
            html_content: version.html_content,
            variable_values: {},
        },
    }
}
