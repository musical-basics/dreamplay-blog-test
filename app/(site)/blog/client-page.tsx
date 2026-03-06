"use client";

import { useState, useMemo } from "react";
import type { BlogPost } from "@/lib/blog-data";
import { FeaturedPost } from "@/components/blog/featured-post";
import { BlogCard } from "@/components/blog/blog-card";
import { CategoryFilter } from "@/components/blog/category-filter";
import { NewsletterForm } from "@/components/blog/newsletter-form";
import { BlogHeader } from "@/components/blog/blog-header";
import { Music } from "lucide-react";

type Category = "all" | "tutorials" | "artist-stories" | "product-news";

interface BlogClientPageProps {
    posts: BlogPost[];
}

export default function BlogClientPage({ posts }: BlogClientPageProps) {
    const [activeCategory, setActiveCategory] = useState<Category>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const featuredPost = useMemo(() => posts.find((post) => post.featured), [posts]);

    const filteredPosts = useMemo(() => {
        let filtered = posts.filter((post) => !post.featured);

        if (activeCategory !== "all") {
            filtered = filtered.filter((post) => post.category === activeCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (post) =>
                    post.title.toLowerCase().includes(query) ||
                    post.excerpt.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [posts, activeCategory, searchQuery]);

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-white/20">
            <BlogHeader forceOpaque={true} darkMode={true} />

            <main className="pt-[100px] md:pt-[120px]">
                {/* Hero Section */}
                <section className="px-6 py-12 md:py-20 lg:py-24">
                    <div className="mx-auto max-w-6xl text-center">
                        <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/50 mb-4 font-bold">Discover</p>
                        <h1 className="mb-6 font-serif text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-white leading-tight">
                            The DreamPlay Journal
                        </h1>
                        <p className="mx-auto max-w-2xl font-sans text-sm md:text-base text-white/60 leading-relaxed">
                            Read the latest news, tutorials, and artist stories from the world of narrow & ergonomic keyboards.
                        </p>
                    </div>
                </section>

                {/* Featured Post */}
                {featuredPost && (
                    <section className="px-6 pb-12 md:pb-24">
                        <div className="mx-auto max-w-6xl">
                            <FeaturedPost post={featuredPost} />
                        </div>
                    </section>
                )}

                {/* Filter & Grid Section */}
                <section className="border-t border-white/10 px-6 py-16 md:py-24 bg-[#0a0a0f]">
                    <div className="mx-auto max-w-6xl">
                        <div className="mb-12">
                            <CategoryFilter
                                activeCategory={activeCategory}
                                onCategoryChange={setActiveCategory}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                            />
                        </div>

                        {filteredPosts.length > 0 ? (
                            <div className="grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredPosts.map((post) => (
                                    <BlogCard key={post.id} post={post} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center border border-white/10 bg-[#050505]">
                                <p className="font-sans text-sm text-white/60">
                                    No articles found matching your criteria.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveCategory("all");
                                        setSearchQuery("");
                                    }}
                                    className="mt-6 inline-block border border-white/30 px-6 py-3 font-sans text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black cursor-pointer"
                                >
                                    Clear filters
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Newsletter Section */}
                <NewsletterForm />
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 px-6 py-12 bg-[#050505]">
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
