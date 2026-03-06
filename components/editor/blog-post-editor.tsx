"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { AssetLoader } from "./asset-loader"
import { CodePane } from "./code-pane"
import { PreviewPane } from "./preview-pane"
import { CopilotPane } from "./copilot-pane"
import { renderTemplate } from "@/lib/render-template"
import { Monitor, Smartphone, Loader2, Check, PanelRightClose, PanelRightOpen, ArrowLeft, History, Globe, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels"
import { getPostBackups } from "@/app/actions/posts"
import { formatDistanceToNow } from "date-fns"

interface BlogPostEditorProps {
    html: string
    assets: Record<string, string>
    title: string
    slug: string
    excerpt: string
    onHtmlChange: (html: string) => void
    onAssetsChange: (assets: Record<string, string>) => void
    onTitleChange: (title: string) => void
    onSlugChange: (slug: string) => void
    onExcerptChange: (excerpt: string) => void
    postName: string
    onNameChange: (name: string) => void
    onSave?: () => void
    onPublish?: () => void
    postId?: string | null
    postStatus?: 'draft' | 'published'
    onRestore?: (backup: { html_content: string; variable_values: Record<string, any> }) => void
    thumbnail?: string | null
    onThumbnailChange?: (thumbnail: string | null) => void
}

export function BlogPostEditor({
    html,
    assets,
    title,
    slug,
    excerpt,
    onHtmlChange,
    onAssetsChange,
    onTitleChange,
    onSlugChange,
    onExcerptChange,
    postName,
    onNameChange,
    onSave,
    onPublish,
    postId,
    postStatus,
    onRestore,
    thumbnail,
    onThumbnailChange
}: BlogPostEditorProps) {
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle')
    const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success'>('idle')
    const [isCopilotOpen, setIsCopilotOpen] = useState(true)
    const copilotRef = useRef<ImperativePanelHandle>(null)
    const searchParams = useSearchParams()
    const currentId = searchParams.get("id")
    const { toast } = useToast()

    // Version history
    const [backups, setBackups] = useState<{ id: string; saved_at: string; title: string }[]>([])
    const [historyOpen, setHistoryOpen] = useState(false)
    const [restoringId, setRestoringId] = useState<string | null>(null)
    const historyRef = useRef<HTMLDivElement>(null)

    // ─── Auto-Save ───
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const autoSavePendingRef = useRef(false)

    const fetchBackups = useCallback(async () => {
        if (!postId) return
        const data = await getPostBackups(postId)
        setBackups(data)
    }, [postId])

    const triggerAutoSave = useCallback(async () => {
        if (!onSave) return
        setSaveStatus('saving')
        await Promise.resolve(onSave())
        await fetchBackups()
        setSaveStatus('success')
        toast({ title: "Auto-saved", description: "Your changes have been saved automatically.", duration: 2000 })
        setTimeout(() => setSaveStatus('idle'), 2000)
    }, [onSave, fetchBackups, toast])

    // Manual edit: start a 1-minute debounce on the FIRST edit only
    const handleManualHtmlChange = useCallback((newHtml: string) => {
        onHtmlChange(newHtml)
        if (!autoSavePendingRef.current && postId) {
            autoSavePendingRef.current = true
            autoSaveTimerRef.current = setTimeout(() => {
                autoSavePendingRef.current = false
                triggerAutoSave()
            }, 60_000) // 1 minute
        }
    }, [onHtmlChange, postId, triggerAutoSave])

    // AI response: save immediately
    const handleAiHtmlChange = useCallback((newHtml: string, prompt?: string) => {
        onHtmlChange(newHtml)
        // Clear any pending manual-edit timer (AI save supersedes)
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current)
            autoSaveTimerRef.current = null
            autoSavePendingRef.current = false
        }
        if (postId) {
            // Small delay to let React state settle before saving
            setTimeout(() => triggerAutoSave(), 300)
        }
    }, [onHtmlChange, postId, triggerAutoSave])

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        }
    }, [])

    useEffect(() => {
        fetchBackups()
    }, [fetchBackups])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
                setHistoryOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const extractedVariables = useMemo(() => {
        const regex = /\{\{(\w+)\}\}/g
        const matches: string[] = []
        let match
        while ((match = regex.exec(html)) !== null) {
            if (!matches.includes(match[1])) matches.push(match[1])
        }
        return matches
    }, [html])

    const updateAsset = useCallback((key: string, value: string) => {
        onAssetsChange({ ...assets, [key]: value })
    }, [assets, onAssetsChange])

    const previewHtml = useMemo(() => {
        return renderTemplate(html, assets)
    }, [html, assets])

    const handleSaveClick = async () => {
        if (!onSave) return
        setSaveStatus('saving')
        await Promise.resolve(onSave())
        await fetchBackups()
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 2000)
    }

    const handlePublishClick = async () => {
        if (!onPublish) return
        setPublishStatus('publishing')
        await Promise.resolve(onPublish())
        setPublishStatus('success')
        setTimeout(() => setPublishStatus('idle'), 2000)
    }

    const toggleCopilot = () => {
        const panel = copilotRef.current
        if (panel) {
            if (isCopilotOpen) {
                panel.collapse()
            } else {
                panel.expand()
            }
        }
    }

    return (
        <div className="h-screen bg-background text-foreground overflow-hidden">
            <PanelGroup direction="horizontal">
                {/* Left Sidebar - Post Settings + Asset Loader */}
                <Panel defaultSize={15} minSize={12} maxSize={25} className="bg-background border-r border-border">
                    <div className="h-full flex flex-col">
                        {/* Header Link */}
                        <div className="p-3 border-b border-border">
                            <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <ArrowLeft className="w-3 h-3" />
                                Back to Dashboard
                            </Link>
                        </div>

                        {/* Post Settings */}
                        <div className="p-4 border-b border-border bg-muted/20 space-y-3">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-muted-foreground">Post Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => onTitleChange(e.target.value)}
                                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                                    placeholder="My Awesome Blog Post"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-muted-foreground">URL Slug</label>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => onSlugChange(e.target.value)}
                                    placeholder="my-awesome-post"
                                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-muted-foreground">Excerpt</label>
                                <textarea
                                    value={excerpt}
                                    onChange={(e) => onExcerptChange(e.target.value)}
                                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs h-16 resize-none focus:outline-none focus:border-primary"
                                    placeholder="A brief summary of the post..."
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <AssetLoader variables={extractedVariables} assets={assets} onUpdateAsset={updateAsset} showBackButton={false} />
                        </div>
                    </div>
                </Panel>

                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

                {/* Center Left - Code Pane */}
                <Panel defaultSize={30} minSize={20} className="bg-background border-r border-border">
                    <div className="h-full overflow-hidden">
                        <CodePane code={html} onChange={handleManualHtmlChange} className="h-full" />
                    </div>
                </Panel>

                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

                {/* Center Right - Preview Pane */}
                <Panel defaultSize={35} minSize={25} className="bg-background flex flex-col">
                    <div className="h-full flex flex-col overflow-hidden">
                        <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card flex-shrink-0">
                            <h2 className="text-sm font-semibold">Preview</h2>

                            <div className="flex items-center gap-2">
                                {/* View Toggle */}
                                <div className="flex bg-muted p-1 rounded-lg">
                                    <button
                                        onClick={() => setViewMode('desktop')}
                                        className={cn(
                                            "p-1.5 rounded-md transition-all",
                                            viewMode === 'desktop' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title="Desktop View"
                                    >
                                        <Monitor className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('mobile')}
                                        className={cn(
                                            "p-1.5 rounded-md transition-all",
                                            viewMode === 'mobile' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title="Mobile View"
                                    >
                                        <Smartphone className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Post Name */}
                                <div className="flex items-center gap-2 border-l border-border pl-2 mr-2">
                                    <input
                                        type="text"
                                        value={postName}
                                        onChange={(e) => onNameChange(e.target.value)}
                                        className="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-2 w-[180px] text-foreground placeholder:text-muted-foreground"
                                        placeholder="Post Title"
                                    />
                                </div>

                                {/* Save Button */}
                                {onSave && (
                                    <button
                                        type="button"
                                        onClick={handleSaveClick}
                                        disabled={saveStatus === 'saving'}
                                        className={cn(
                                            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                                            saveStatus === 'success'
                                                ? "bg-green-600 text-white hover:bg-green-700"
                                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                                        )}
                                    >
                                        {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {saveStatus === 'success' && <Check className="w-4 h-4" />}
                                        {saveStatus === 'idle' && "Save Post"}
                                        {saveStatus === 'saving' && "Saving..."}
                                        {saveStatus === 'success' && "Saved!"}
                                    </button>
                                )}

                                {/* Publish Button */}
                                {onPublish && postId && (
                                    <button
                                        type="button"
                                        onClick={handlePublishClick}
                                        disabled={publishStatus === 'publishing'}
                                        className={cn(
                                            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                                            publishStatus === 'success'
                                                ? "bg-green-600 text-white"
                                                : postStatus === 'published'
                                                    ? "bg-amber-600 text-white hover:bg-amber-700"
                                                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                                        )}
                                    >
                                        {publishStatus === 'publishing' && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {publishStatus === 'success' && <Check className="w-4 h-4" />}
                                        {publishStatus === 'idle' && <Send className="w-4 h-4" />}
                                        {publishStatus === 'publishing' && (postStatus === 'published' ? "Unpublishing..." : "Publishing...")}
                                        {publishStatus === 'success' && (postStatus === 'published' ? "Unpublished!" : "Published!")}
                                        {publishStatus === 'idle' && (postStatus === 'published' ? "Unpublish" : "Publish Post")}
                                    </button>
                                )}

                                {/* Version History */}
                                {postId && backups.length > 0 && (
                                    <div className="relative" ref={historyRef}>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryOpen(!historyOpen)}
                                            className="p-2 rounded-md text-sm font-medium border border-border bg-background hover:bg-muted transition-all flex items-center gap-1.5"
                                            title="Version History"
                                        >
                                            <History className="w-4 h-4" />
                                            <span className="text-xs text-muted-foreground">{backups.length}</span>
                                        </button>
                                        {historyOpen && (
                                            <div className="absolute top-full right-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                                                <div className="px-3 py-2 border-b border-border">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                                                        Saved Versions
                                                    </p>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto">
                                                    {backups.map((backup) => (
                                                        <button
                                                            key={backup.id}
                                                            onClick={async () => {
                                                                if (!onRestore || !postId) return
                                                                setRestoringId(backup.id)
                                                                const { restorePostBackup } = await import("@/app/actions/posts")
                                                                const result = await restorePostBackup(postId, backup.id)
                                                                if (result.success && result.data) {
                                                                    onRestore(result.data)
                                                                }
                                                                setRestoringId(null)
                                                                setHistoryOpen(false)
                                                            }}
                                                            disabled={restoringId === backup.id}
                                                            className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 border-b border-border/50 last:border-0"
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-xs font-medium text-foreground truncate">
                                                                    {backup.title || "No title"}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {formatDistanceToNow(new Date(backup.saved_at), { addSuffix: true })}
                                                                </span>
                                                            </div>
                                                            {restoringId === backup.id && (
                                                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground flex-shrink-0" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Copilot Toggle */}
                                <button
                                    onClick={toggleCopilot}
                                    className={cn(
                                        "p-2 rounded-md transition-all text-sm font-medium border ml-2",
                                        isCopilotOpen
                                            ? "bg-muted text-muted-foreground hover:text-foreground border-transparent"
                                            : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                    )}
                                    title={isCopilotOpen ? "Hide Copilot" : "Show Copilot"}
                                >
                                    {isCopilotOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-[#0f0f10] p-8">
                            <div className="h-fit min-h-[500px] mx-auto transition-all duration-300 bg-white shadow-lg my-8" style={{ maxWidth: viewMode === 'mobile' ? '375px' : '800px' }}>
                                <PreviewPane html={previewHtml} viewMode={viewMode} />
                            </div>
                        </div>
                    </div>
                </Panel>

                <PanelResizeHandle className={cn("w-1 bg-border hover:bg-primary/20 transition-colors", !isCopilotOpen && "hidden")} />

                {/* Right Sidebar - Copilot */}
                <Panel
                    ref={copilotRef}
                    defaultSize={20}
                    minSize={15}
                    maxSize={30}
                    collapsible={true}
                    collapsedSize={0}
                    onCollapse={() => setIsCopilotOpen(false)}
                    onExpand={() => setIsCopilotOpen(true)}
                    className={cn(
                        "bg-card border-l border-border transition-all duration-300 ease-in-out",
                        !isCopilotOpen && "border-none"
                    )}
                >
                    <div className="h-full overflow-hidden">
                        <CopilotPane html={html} onHtmlChange={handleAiHtmlChange} postId={postId} assets={assets} onAssetsChange={onAssetsChange} thumbnail={thumbnail} onThumbnailChange={onThumbnailChange} />
                    </div>
                </Panel>
            </PanelGroup>
        </div>
    )
}
