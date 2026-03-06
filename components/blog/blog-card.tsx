"use client";

import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { type BlogPost, getCategoryLabel, formatDate } from "@/lib/blog-data";

interface BlogCardProps {
    post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
    return (
        <Link href={`/blog/${post.slug}`} className="group block h-full">
            <article className="flex h-full flex-col border border-white/10 bg-[#050505] transition-all duration-500 hover:-translate-y-1 hover:border-white/30 hover:bg-white/[0.04] hover:shadow-2xl">
                <div className="relative aspect-[4/3] overflow-hidden border-b border-white/10">
                    <img
                        src={post.heroImage || "/placeholder.svg"}
                        alt={post.title}
                        className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/10 transition-opacity duration-300 group-hover:opacity-0" />
                </div>
                <div className="flex flex-1 flex-col p-6 md:p-8 text-left">
                    <div className="mb-4 flex items-center justify-between">
                        <span className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
                            {getCategoryLabel(post.category)}
                        </span>
                        <span className="flex items-center gap-1.5 font-sans text-[9px] uppercase tracking-widest text-white/40">
                            <Clock className="h-3 w-3" />
                            {post.readTime}
                        </span>
                    </div>
                    <h3 className="mb-4 font-serif text-2xl font-medium leading-tight text-white transition-colors duration-300 group-hover:text-gray-300">
                        {post.title}
                    </h3>
                    <p className="mb-8 flex-1 font-sans text-sm leading-relaxed text-white/50 line-clamp-3">
                        {post.excerpt}
                    </p>
                    <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-6">
                        <span className="font-sans text-[10px] uppercase tracking-widest text-white/40">
                            {formatDate(post.publishedAt)}
                        </span>
                        <span className="inline-flex items-center gap-2 font-sans text-[10px] font-bold uppercase tracking-widest text-white transition-colors group-hover:text-gray-400">
                            Read <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </span>
                    </div>
                </div>
            </article>
        </Link>
    );
}
