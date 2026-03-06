'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DownloadHtmlButtonProps {
    htmlContent: string | null
    filename: string
}

export function DownloadHtmlButton({ htmlContent, filename }: DownloadHtmlButtonProps) {
    if (!htmlContent) return null

    const handleDownload = () => {
        const blob = new Blob([htmlContent], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
            title="Download HTML"
        >
            <Download className="h-4 w-4" />
        </Button>
    )
}
