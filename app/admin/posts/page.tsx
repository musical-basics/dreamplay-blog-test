import { getPosts } from '@/app/actions/posts'
import { PostsTable } from '@/components/admin/posts-table'

export default async function PostsPage() {
    const posts = await getPosts()

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Posts</h1>
                <p className="text-muted-foreground">Manage all your blog posts in one place.</p>
            </div>

            {/* Posts Table */}
            <PostsTable initialPosts={posts} />
        </div>
    )
}
