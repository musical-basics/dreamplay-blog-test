"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { BlogPostEditor } from "@/components/editor/blog-post-editor"
import { createClient } from "@/lib/supabase/client"
import { togglePostStatus, savePostBackup } from "@/app/actions/posts"
import { Post } from "@/lib/types"

function EditorInner() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const postId = searchParams.get("id")
    const supabase = createClient()

    const [post, setPost] = useState<Post | null>(null)
    const [html, setHtml] = useState("")
    const [assets, setAssets] = useState<Record<string, string>>({})
    const [title, setTitle] = useState("Untitled Post")
    const [slug, setSlug] = useState("")
    const [excerpt, setExcerpt] = useState("")
    const [thumbnail, setThumbnail] = useState<string | null>(null)
    const [postStatus, setPostStatus] = useState<'draft' | 'published'>('draft')
    const [loading, setLoading] = useState(!!postId)

    // Load existing post if ID provided
    useEffect(() => {
        if (!postId) return
        const loadPost = async () => {
            setLoading(true)
            const { data } = await supabase
                .from("posts")
                .select("*")
                .eq("id", postId)
                .single()

            if (data) {
                setPost(data)
                setHtml(data.html_content || "")
                setAssets(data.variable_values || {})
                setTitle(data.title)
                setSlug(data.slug)
                setExcerpt(data.excerpt || "")
                setThumbnail(data.featured_image || null)
                setPostStatus(data.status || 'draft')
            }
            setLoading(false)
        }
        loadPost()
    }, [postId])

    const handleSave = async () => {
        if (postId && post) {
            // Snapshot current state before overwriting
            await savePostBackup(postId)
            // Update existing post
            await supabase
                .from("posts")
                .update({
                    title,
                    slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                    excerpt,
                    html_content: html,
                    variable_values: assets,
                    featured_image: thumbnail,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", postId)
        } else {
            // Create new post
            const newSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
            const { data } = await supabase
                .from("posts")
                .insert({
                    title,
                    slug: newSlug,
                    excerpt,
                    html_content: html,
                    variable_values: assets,
                    featured_image: thumbnail,
                })
                .select("id")
                .single()

            if (data) {
                router.replace(`/editor?id=${data.id}`)
            }
        }
    }

    const handlePublish = async () => {
        if (!postId) return
        const updated = await togglePostStatus(postId)
        if (updated) {
            setPostStatus(updated.status as 'draft' | 'published')
        }
    }

    const handleRestore = (backup: { html_content: string; variable_values: Record<string, any> }) => {
        setHtml(backup.html_content)
        setAssets(backup.variable_values || {})
    }

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background text-foreground">
                <p className="text-muted-foreground">Loading post...</p>
            </div>
        )
    }

    return (
        <BlogPostEditor
            html={html}
            assets={assets}
            title={title}
            slug={slug}
            excerpt={excerpt}
            onHtmlChange={setHtml}
            onAssetsChange={setAssets}
            onTitleChange={setTitle}
            onSlugChange={setSlug}
            onExcerptChange={setExcerpt}
            postName={title}
            onNameChange={setTitle}
            onSave={handleSave}
            onPublish={handlePublish}
            postId={postId}
            postStatus={postStatus}
            onRestore={handleRestore}
            thumbnail={thumbnail}
            onThumbnailChange={setThumbnail}
        />
    )
}

export default function EditorPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading...</p></div>}>
            <EditorInner />
        </Suspense>
    )
}
