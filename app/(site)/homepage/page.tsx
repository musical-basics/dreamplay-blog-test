import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { BlogHeader } from "@/components/blog/blog-header"
import { ArrowRight, Clock } from "lucide-react"

export default async function HomepagePage() {
    const supabase = await createClient()

    const { data: posts } = await supabase
        .from("posts")
        .select("id, title, slug, excerpt, category, featured_image, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-white/20">
            {/* Navigation */}
            <BlogHeader forceOpaque={true} darkMode={true} />

            {/* Hero */}
            <header className="max-w-6xl mx-auto px-6 pt-[120px] md:pt-[160px] pb-16 text-center">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/50 mb-4 font-bold">The Journal</p>
                <h1 className="text-5xl md:text-7xl font-serif font-semibold text-white mb-6 tracking-tight leading-tight">DreamPlay Blog</h1>
                <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
                    Tutorials, insights, and stories from the DreamPlay team.
                </p>
            </header>

            {/* Posts Grid */}
            <section className="max-w-6xl mx-auto px-6 pb-24 border-t border-white/10 pt-16">
                {!posts || posts.length === 0 ? (
                    <div className="text-center py-24 border border-white/10 bg-white/5">
                        <p className="text-white/50 font-sans text-sm">No published posts yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        {posts.map((post) => (
                            <Link
                                key={post.id}
                                href={`/blog/${post.slug}`}
                                className="group flex flex-col border border-white/10 bg-[#050505] transition-all duration-500 hover:-translate-y-1 hover:border-white/30 hover:bg-white/[0.04] hover:shadow-2xl"
                            >
                                {post.featured_image && (
                                    <div className="relative aspect-[4/3] overflow-hidden border-b border-white/10">
                                        <img
                                            src={post.featured_image}
                                            alt={post.title}
                                            className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/10 transition-opacity duration-300 group-hover:opacity-0" />
                                    </div>
                                )}
                                <div className="flex flex-col flex-1 p-6 md:p-8 text-left">
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 group-hover:text-white/80 transition-colors">
                                            {post.category || "Blog"}
                                        </span>
                                    </div>
                                    <h3 className="mb-4 font-serif text-xl font-medium leading-tight text-white transition-colors duration-300 group-hover:text-gray-300 line-clamp-2">
                                        {post.title}
                                    </h3>
                                    {post.excerpt && (
                                        <p className="mb-6 line-clamp-3 font-sans text-sm leading-relaxed text-white/50 flex-1">
                                            {post.excerpt}
                                        </p>
                                    )}
                                    <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                                        {post.published_at && (
                                            <span className="font-sans text-[10px] uppercase tracking-widest text-white/40">
                                                {new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-2 font-sans text-[10px] font-bold uppercase tracking-widest text-white transition-colors group-hover:text-gray-400">
                                            Read <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
