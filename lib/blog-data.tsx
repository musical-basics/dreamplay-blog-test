// Blog Types - Frontend display types
export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    heroImage: string;
    category: "tutorials" | "artist-stories" | "product-news";
    author: {
        name: string;
        avatar?: string;
    };
    publishedAt: string;
    readTime: string;
    featured?: boolean;
}

export interface Comment {
    id: string;
    name: string;
    email: string;
    comment: string;
    createdAt: string;
    likes?: number;
}

// Helper functions
export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export function getCategoryLabel(category: BlogPost["category"]): string {
    const labels: Record<BlogPost["category"], string> = {
        tutorials: "Tutorials",
        "artist-stories": "Artist Stories",
        "product-news": "Product News",
    };
    return labels[category] || category;
}
