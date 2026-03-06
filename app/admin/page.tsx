import Link from 'next/link'
import { Plus, ExternalLink, FileText, Eye, FilePen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getPostStats, getPosts } from '@/app/actions/posts'
import { DownloadHtmlButton } from '@/components/admin/download-html-button'

export default async function AdminDashboard() {
    const stats = await getPostStats()
    const posts = await getPosts()
    const recentPosts = posts.slice(0, 10)

    const statCards = [
        { label: 'Total Posts', value: stats.total, icon: FileText, color: 'text-blue-400' },
        { label: 'Published', value: stats.published, icon: Eye, color: 'text-green-400' },
        { label: 'Drafts', value: stats.draft, icon: FilePen, color: 'text-yellow-400' },
    ]

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of your blog.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" asChild>
                        <Link href="/blog" target="_blank">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Blog
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/editor">
                            <Plus className="mr-2 h-4 w-4" />
                            New Post
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {statCards.map((stat) => (
                    <Card key={stat.label}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.label}
                            </CardTitle>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Posts */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Recent Posts</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Your latest blog posts and their status.</p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/admin/posts">View All</Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {recentPosts.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-12 text-center">
                            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-foreground">No posts yet</h3>
                            <p className="text-muted-foreground mt-2">Create your first blog post using one of the editors.</p>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-border">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50">
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Title</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Updated</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentPosts.map((post) => (
                                        <tr key={post.id} className="border-b border-border last:border-0">
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/editor?id=${post.id}`}
                                                    className="font-medium text-foreground hover:underline"
                                                >
                                                    {post.title || 'Untitled'}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    variant={post.status === 'published' ? 'default' : 'secondary'}
                                                    className={post.status === 'published'
                                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                                    }
                                                >
                                                    {post.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm capitalize text-muted-foreground">{post.category}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-muted-foreground">
                                                    {new Date(post.updated_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <DownloadHtmlButton
                                                    htmlContent={post.html_content}
                                                    filename={`${post.slug || post.id}.html`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
