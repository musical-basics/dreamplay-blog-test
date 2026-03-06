import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'DreamPlay Pianos | Blog',
    description: 'Discover the world of luxury pianos through tutorials, artist stories, and product news from DreamPlay Pianos.',
}

export default function SiteLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
