import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Music } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/render-template";
import { BlogContentFrame } from "@/components/blog/blog-content-frame";
import { BlogHeader } from "@/components/blog/blog-header";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{
        slug: string;
    }>;
}

export default async function BlogPostPage({ params }: PageProps) {
    const { slug } = await params;

    const supabase = await createClient();

    const { data: post, error } = await supabase
        .from("posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .single();

    if (error || !post) {
        notFound();
    }

    const renderedContent = renderTemplate(
        post.html_content || "",
        post.variable_values || {}
    );

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex flex-col font-sans text-white selection:bg-white/20">
            <BlogHeader forceOpaque={true} darkMode={true} />

            {/* Back to Blog link */}
            <div className="mx-auto w-full max-w-6xl px-6 pt-[120px] md:pt-[140px]">
                <Link
                    href="/blog"
                    className="inline-flex items-center gap-2 font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
                >
                    <ArrowLeft className="h-3 w-3" />
                    Back to Journal
                </Link>
            </div>

            {/* Blog Content (sandboxed in iframe to prevent style leakage) */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12">
                <div className="rounded-none border border-white/10 bg-white p-2 md:p-8 shadow-2xl">
                    <BlogContentFrame html={renderedContent} />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 bg-[#050505] px-6 py-12 mt-12">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
                    <div className="flex items-center gap-2">
                        <Music className="h-5 w-5 text-white/50" />
                        <span className="font-serif text-lg tracking-wide text-white">DreamPlay Pianos</span>
                    </div>
                    <div className="flex gap-6">
                        <a href="https://www.dreamplaypianos.com/privacy" className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">Privacy</a>
                        <a href="https://www.dreamplaypianos.com/terms" className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">Terms</a>
                    </div>
                    <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/40">
                        © 2026 DreamPlay Pianos.
                    </p>
                </div>
            </footer>
        </div>
    );
}
