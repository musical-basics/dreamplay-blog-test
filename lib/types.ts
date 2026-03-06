export type PostStatus = 'draft' | 'published'

export interface Post {
    id: string
    created_at: string
    updated_at: string
    title: string
    slug: string
    excerpt: string | null
    category: string
    featured_image: string | null
    html_content: string | null
    variable_values: Record<string, any> | null
    status: PostStatus
    published_at: string | null
}

export interface PostVersion {
    id: string
    post_id: string
    html_content: string
    prompt: string | null
    created_at: string
}
