"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = "all" | "tutorials" | "artist-stories" | "product-news";

interface CategoryFilterProps {
    activeCategory: Category;
    onCategoryChange: (category: Category) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

const categories: { value: Category; label: string }[] = [
    { value: "all", label: "All Posts" },
    { value: "tutorials", label: "Tutorials" },
    { value: "artist-stories", label: "Artist Stories" },
    { value: "product-news", label: "Product News" },
];

export function CategoryFilter({
    activeCategory,
    onCategoryChange,
    searchQuery,
    onSearchChange,
}: CategoryFilterProps) {
    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-8">
            <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                    <button
                        key={category.value}
                        onClick={() => onCategoryChange(category.value)}
                        className={cn(
                            "px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 border cursor-pointer",
                            activeCategory === category.value
                                ? "border-white bg-white text-black"
                                : "border-white/10 bg-transparent text-white/60 hover:border-white/50 hover:text-white"
                        )}
                    >
                        {category.label}
                    </button>
                ))}
            </div>
            <div className="relative w-full lg:w-72 shrink-0">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full rounded-none border border-white/20 bg-transparent py-3 pl-12 pr-4 font-sans text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none focus:ring-0 transition-colors"
                />
            </div>
        </div>
    );
}
