import { createClient } from '@/lib/supabase/server'
import BlogClientPage from './client-page'
import type { BlogPost } from '@/lib/blog-data'

export const dynamic = 'force-dynamic'

export default async function BlogIndexPage() {
    const supabase = await createClient()

    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) {
        console.error('Error fetching posts:', error)
    }

    const formattedPosts: BlogPost[] = (posts || []).map((post) => ({
        id: post.id,
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.html_content || '',
        heroImage: post.featured_image || '/placeholder.svg',
        category: (post.category as BlogPost['category']) || 'tutorials',
        author: {
            name: post.author || 'Admin',
        },
        publishedAt: post.published_at || post.created_at,
        readTime: post.read_time || '5 min read',
        featured: post.featured || false,
    }))

    return <BlogClientPage posts={formattedPosts} />
}
