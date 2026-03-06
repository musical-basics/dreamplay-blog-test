"use client";

import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { type BlogPost, getCategoryLabel, formatDate } from "@/lib/blog-data";

interface FeaturedPostProps {
    post: BlogPost;
}

export function FeaturedPost({ post }: FeaturedPostProps) {
    return (
        <Link href={`/blog/${post.slug}`} className="group block text-left">
            <article className="relative min-h-[500px] overflow-hidden border border-white/10 bg-[#050505] transition-all duration-500 hover:border-white/30 hover:shadow-2xl lg:min-h-[600px]">
                <div className="absolute inset-0 lg:w-[65%]">
                    <img
                        src={post.heroImage || "/placeholder.svg"}
                        alt={post.title}
                        className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#050505]" />
                </div>
                <div className="relative flex h-full min-h-[500px] flex-col justify-end p-8 md:p-12 lg:min-h-[600px] lg:items-end lg:justify-center">
                    <div className="max-w-xl lg:w-1/2 lg:pl-12">
                        <div className="mb-6 flex flex-wrap items-center gap-4">
                            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-black bg-white px-3 py-1">
                                Featured
                            </span>
                            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
                                {getCategoryLabel(post.category)}
                            </span>
                            <span className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.3em] text-white/40">
                                <Clock className="h-3 w-3" />
                                {post.readTime}
                            </span>
                        </div>

                        <h2 className="mb-6 font-serif text-4xl leading-tight text-white md:text-5xl lg:text-6xl group-hover:text-white/90 transition-colors text-balance">
                            {post.title}
                        </h2>

                        <p className="mb-8 font-sans text-sm md:text-base leading-relaxed text-white/70 line-clamp-3">
                            {post.excerpt}
                        </p>

                        <div className="flex flex-wrap items-center gap-6 border-t border-white/10 pt-8">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center border border-white/20 bg-white/5 font-serif text-sm text-white">
                                    {post.author.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-sans text-[11px] font-bold uppercase tracking-widest text-white">
                                        {post.author.name}
                                    </span>
                                    <span className="mt-1 font-sans text-[10px] uppercase tracking-widest text-white/40">
                                        {formatDate(post.publishedAt)}
                                    </span>
                                </div>
                            </div>
                            <span className="hidden h-8 w-px bg-white/20 md:block" />
                            <span className="inline-flex items-center gap-2 border border-white bg-white px-6 py-3 font-sans text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-white/90">
                                Read Article
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </span>
                        </div>
                    </div>
                </div>
            </article>
        </Link>
    );
}
