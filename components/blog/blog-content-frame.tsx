"use client"

import { useRef, useEffect, useState } from "react"

interface BlogContentFrameProps {
    html: string
}

export function BlogContentFrame({ html }: BlogContentFrameProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [height, setHeight] = useState(800)

    useEffect(() => {
        const iframe = iframeRef.current
        if (!iframe) return

        const handleLoad = () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document
                if (doc) {
                    // Observe resize changes in the iframe content
                    const updateHeight = () => {
                        const h = doc.documentElement.scrollHeight
                        if (h > 0) setHeight(h)
                    }

                    updateHeight()

                    // Re-check after images/fonts load
                    const observer = new MutationObserver(updateHeight)
                    observer.observe(doc.body, { childList: true, subtree: true, attributes: true })

                    // Also listen for image loads
                    const images = doc.querySelectorAll("img")
                    images.forEach((img) => {
                        if (!img.complete) {
                            img.addEventListener("load", updateHeight)
                        }
                    })

                    // Periodic check for font loading
                    const timer = setInterval(updateHeight, 500)
                    setTimeout(() => clearInterval(timer), 5000)

                    return () => {
                        observer.disconnect()
                        clearInterval(timer)
                    }
                }
            } catch {
                // Cross-origin restrictions won't apply with srcdoc
            }
        }

        iframe.addEventListener("load", handleLoad)
        return () => iframe.removeEventListener("load", handleLoad)
    }, [html])

    return (
        <iframe
            ref={iframeRef}
            srcDoc={html}
            style={{ width: "100%", height: `${height}px`, border: "none", display: "block" }}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            title="Blog post content"
        />
    )
}
