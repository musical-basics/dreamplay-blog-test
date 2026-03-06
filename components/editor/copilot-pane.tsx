"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Sparkles, Send, X, Zap, Brain, Bot, Paperclip, Loader2, FileText, History, Plus, LayoutTemplate, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getAnthropicModels } from "@/app/actions/ai-models"
import { getTemplateList, getPostHtml } from "@/app/actions/posts"
import { renderTemplate } from "@/lib/render-template"

interface Message {
    role: "user" | "details" | "result"
    content: string
    imageUrls?: string[]
}

interface CopilotPaneProps {
    html: string
    onHtmlChange: (html: string, prompt: string) => void
    audienceContext?: "dreamplay" | "musicalbasics" | "both"
    aiDossier?: string
    postId?: string | null
    assets?: Record<string, string>
    onAssetsChange?: (assets: Record<string, string>) => void
    thumbnail?: string | null
    onThumbnailChange?: (thumbnail: string | null) => void
}

interface ChatSession {
    id: string
    startedAt: string
    messages: Message[]
}

const MAX_SESSIONS = 5
const STORAGE_PREFIX = "blog_copilot_sessions_"

// Module-level map to persist in-flight loading state across React remounts.
// Keyed by postId (or "_new" for unsaved posts). When the component remounts
// (e.g. due to HMR, Suspense re-suspend, or tab-switch in dev mode),
// isLoading can initialize from this map instead of defaulting to false.
const inflightRequests = new Map<string, AbortController>()

type ComputeTier = "low" | "medium" | "high"

export function CopilotPane({ html, onHtmlChange, audienceContext = "dreamplay", aiDossier = "", postId, assets, onAssetsChange, thumbnail, onThumbnailChange }: CopilotPaneProps) {
    const [overrideModel, setOverrideModel] = useState<string | null>(null)
    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [imageMode, setImageMode] = useState<"library" | "creative">("library")
    const [themes, setThemes] = useState<any[]>([])
    const [selectedThemeId, setSelectedThemeId] = useState<string>("none")

    const [modelLow, setModelLow] = useState("claude-haiku-4-5-20251001")
    const [modelMedium, setModelMedium] = useState("claude-sonnet-4-6")
    const [modelHigh, setModelHigh] = useState("claude-opus-4-6")
    const [autoRouting, setAutoRouting] = useState(false)

    useEffect(() => {
        getAnthropicModels().then(models => {
            if (models.length > 0) setAvailableModels(models)
        })

        // Lazy load themes
        import("@/app/actions/themes").then(m => m.getThemes().then(setThemes))

        const low = localStorage.getItem("mb_model_low")
        const med = localStorage.getItem("mb_model_medium")
        const high = localStorage.getItem("mb_model_high")
        const auto = localStorage.getItem("mb_auto_routing")
        if (low) setModelLow(low)
        if (med) setModelMedium(med)
        if (high) setModelHigh(high)
        if (auto === "true") setAutoRouting(true)
    }, [])

    const getModelForTier = (tier: ComputeTier): string => {
        if (overrideModel) return overrideModel
        switch (tier) {
            case "low": return modelLow
            case "medium": return modelMedium
            case "high": return modelHigh
        }
    }

    const [currentSessionId, setCurrentSessionId] = useState<string>(() => `s-${Date.now()}`)
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [sessionPickerOpen, setSessionPickerOpen] = useState(false)
    const sessionPickerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!postId) return
        try {
            const raw = localStorage.getItem(`${STORAGE_PREFIX}${postId}`)
            if (raw) {
                const saved: ChatSession[] = JSON.parse(raw)
                setSessions(saved)
                if (saved.length > 0) {
                    const latest = saved[0]
                    setCurrentSessionId(latest.id)
                    setMessages(latest.messages)
                }
            }
        } catch (e) {
            console.error("Failed to load copilot sessions:", e)
        }
    }, [postId])

    const saveCurrentSession = useCallback((msgs: Message[]) => {
        if (!postId || msgs.length <= 1) return
        try {
            const raw = localStorage.getItem(`${STORAGE_PREFIX}${postId}`)
            let allSessions: ChatSession[] = raw ? JSON.parse(raw) : []

            const existingIdx = allSessions.findIndex(s => s.id === currentSessionId)
            const session: ChatSession = {
                id: currentSessionId,
                startedAt: existingIdx >= 0 ? allSessions[existingIdx].startedAt : new Date().toISOString(),
                messages: msgs,
            }

            if (existingIdx >= 0) {
                allSessions[existingIdx] = session
            } else {
                allSessions.unshift(session)
            }

            allSessions = allSessions.slice(0, MAX_SESSIONS)
            localStorage.setItem(`${STORAGE_PREFIX}${postId}`, JSON.stringify(allSessions))
            setSessions(allSessions)
        } catch (e) {
            console.error("Failed to save copilot session:", e)
        }
    }, [postId, currentSessionId])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (sessionPickerRef.current && !sessionPickerRef.current.contains(e.target as Node)) {
                setSessionPickerOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleNewSession = () => {
        const newId = `s-${Date.now()}`
        setCurrentSessionId(newId)
        setMessages([{ role: "result", content: "I'm ready. Upload screenshots or reference images and I'll create beautiful blog content." }])
        setSessionPickerOpen(false)
    }

    const handleLoadSession = (session: ChatSession) => {
        setCurrentSessionId(session.id)
        setMessages(session.messages)
        setSessionPickerOpen(false)
    }

    const [messages, setMessages] = useState<Message[]>([
        { role: "result", content: "I'm ready. Upload screenshots or reference images and I'll create beautiful blog content." },
    ])

    const [input, setInput] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const [pendingAttachments, setPendingAttachments] = useState<string[]>([])
    const inflightKey = postId || "_new"
    const [isLoading, setIsLoading] = useState(() => inflightRequests.has(inflightKey))
    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [isRefPickerOpen, setIsRefPickerOpen] = useState(false)
    const [refTemplates, setRefTemplates] = useState<{ id: string; name: string; created_at: string }[]>([])
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [capturingRef, setCapturingRef] = useState(false)
    const [referenceCSS, setReferenceCSS] = useState<string | null>(null)
    const [refTemplateName, setRefTemplateName] = useState<string | null>(null)
    const refIframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isLoading, pendingAttachments])

    useEffect(() => {
        saveCurrentSession(messages)
    }, [messages, saveCurrentSession])

    const uploadFile = async (file: File) => {
        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Upload failed")
            }

            setPendingAttachments(prev => [...prev, data.url])
        } catch (error: any) {
            console.error("Upload failed:", error)
            setMessages(prev => [...prev, { role: 'result', content: `❌ Failed to upload image: ${file.name} (${error.message})` }])
        } finally {
            setIsUploading(false)
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                e.preventDefault()
                const file = items[i].getAsFile()
                if (file) uploadFile(file)
            }
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            Array.from(e.target.files).forEach(file => uploadFile(file))
        }
    }

    const handleOpenRefPicker = async () => {
        setIsRefPickerOpen(true)
        setLoadingTemplates(true)
        try {
            const templates = await getTemplateList()
            setRefTemplates(templates)
        } catch (e) {
            console.error("Failed to load templates", e)
        } finally {
            setLoadingTemplates(false)
        }
    }

    const handleSelectRefTemplate = async (template: { id: string; name: string }) => {
        setIsRefPickerOpen(false)
        setCapturingRef(true)
        setRefTemplateName(template.name)

        try {
            const postData = await getPostHtml(template.id)
            if (!postData?.html_content) {
                throw new Error("No HTML content found")
            }

            const renderedHtml = renderTemplate(postData.html_content, postData.variable_values || {})

            const styleMatch = renderedHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi)
            const extractedCSS = styleMatch ? styleMatch.join("\n") : ""
            setReferenceCSS(extractedCSS || null)

            const iframe = refIframeRef.current
            if (iframe) {
                const doc = iframe.contentDocument
                if (doc) {
                    doc.open()
                    doc.write(renderedHtml)
                    doc.close()

                    await new Promise(resolve => setTimeout(resolve, 1500))

                    const html2canvas = (await import("html2canvas")).default
                    const canvas = await html2canvas(doc.body, {
                        width: 800,
                        backgroundColor: "#ffffff",
                        useCORS: true,
                        logging: false,
                    })

                    const blob = await new Promise<Blob>((resolve) =>
                        canvas.toBlob((b) => resolve(b!), "image/png", 0.9)
                    )

                    const formData = new FormData()
                    formData.append("file", blob, `ref-${template.id}.png`)
                    const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
                    const uploadData = await uploadRes.json()

                    if (uploadRes.ok && uploadData.url) {
                        setPendingAttachments(prev => [...prev, uploadData.url])
                    }
                }
            }
        } catch (e: any) {
            console.error("Failed to capture reference template:", e)
            setRefTemplateName(null)
            setReferenceCSS(null)
        } finally {
            setCapturingRef(false)
        }
    }

    const clearReference = () => {
        setReferenceCSS(null)
        setRefTemplateName(null)
    }

    const handleSendMessage = async (tier?: ComputeTier) => {
        if ((!input.trim() && pendingAttachments.length === 0) || isLoading || isUploading) return

        const userMessage = input.trim()
        const attachments = [...pendingAttachments]

        let fullMessage = userMessage
        if (referenceCSS) {
            fullMessage = `[Reference template style attached. Match this CSS for fonts, colors, and spacing:]\n${referenceCSS}\n\n${userMessage}`
            setReferenceCSS(null)
            setRefTemplateName(null)
        }

        let model: string
        if (autoRouting && !tier) {
            model = "auto"
        } else {
            model = getModelForTier(tier || "medium")
        }

        setInput("")
        setPendingAttachments([])

        const newMessage: Message = {
            role: "user",
            content: userMessage,
            imageUrls: attachments
        }

        const apiMessage: Message = {
            role: "user",
            content: fullMessage,
            imageUrls: attachments
        }

        const newHistory = [...messages, newMessage]
        const apiHistory = [...messages, apiMessage]
        setMessages(newHistory)
        setIsLoading(true)

        // Track this request in module-level map so isLoading survives remounts
        const abortController = new AbortController()
        inflightRequests.set(inflightKey, abortController)

        try {
            const response = await fetch("/api/copilot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentHtml: html,
                    messages: apiHistory,
                    model,
                    audienceContext,
                    aiDossier,
                    modelLow,
                    modelMedium,
                    imageMode,
                    themeHtml: selectedThemeId !== "none" ? themes.find(t => t.id === selectedThemeId)?.html_template : null,
                    hasThumbnail: !!thumbnail,
                }),
                signal: abortController.signal,
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.error || "Failed to generate code")

            if (data.updatedHtml) {
                onHtmlChange(data.updatedHtml, userMessage)
                // NEW: Populate Asset Loader magically!
                if (data.suggestedAssets && Object.keys(data.suggestedAssets).length > 0 && onAssetsChange && assets) {
                    onAssetsChange({ ...assets, ...data.suggestedAssets })
                }
                // NEW: Auto-set thumbnail if AI suggests one and none exists
                if (data.suggestedThumbnail && !thumbnail && onThumbnailChange) {
                    onThumbnailChange(data.suggestedThumbnail)
                }
            } else if (data.explanation && /<!DOCTYPE html|<html[\s>]/i.test(data.explanation)) {
                // Fallback: AI accidentally put the HTML in the explanation field
                const htmlMatch = data.explanation.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/i)
                if (htmlMatch) {
                    console.warn("[Copilot] Recovered HTML from explanation field (AI put it in wrong field)")
                    onHtmlChange(htmlMatch[1], userMessage)
                    if (data.suggestedAssets && Object.keys(data.suggestedAssets).length > 0 && onAssetsChange && assets) {
                        onAssetsChange({ ...assets, ...data.suggestedAssets })
                    }
                    if (data.suggestedThumbnail && !thumbnail && onThumbnailChange) {
                        onThumbnailChange(data.suggestedThumbnail)
                    }
                    data.explanation = "Blog post generated successfully."
                }
            }

            const resultMessages: Message[] = [
                { role: "result", content: data.explanation || "Done." }
            ];

            if (data.meta) {
                const m = data.meta;
                const costStr = m.cost < 0.01 ? `$${(m.cost * 100).toFixed(2)}¢` : `$${m.cost.toFixed(4)}`;
                resultMessages.push({
                    role: "details",
                    content: `${m.model}  ·  ${m.inputTokens.toLocaleString()} in / ${m.outputTokens.toLocaleString()} out  ·  ${costStr}`
                });
            }

            setMessages(prev => [...prev, ...resultMessages])

        } catch (error: any) {
            if (error.name === 'AbortError') return // Component unmounted, don't update state
            console.error("Copilot Error:", error)
            setMessages(prev => [
                ...prev,
                { role: "result", content: `Error: ${error.message}` }
            ])
        } finally {
            inflightRequests.delete(inflightKey)
            setIsLoading(false)
        }
    }

    const canSend = !isLoading && (input.trim() || pendingAttachments.length > 0)

    return (
        <div className="flex flex-col h-full border-l border-border bg-card text-card-foreground">
            <iframe
                ref={refIframeRef}
                style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "800px", height: "2000px", border: "none" }}
            />
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center px-4 gap-2 justify-between shrink-0 bg-background/50 backdrop-blur">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h2 className="text-sm font-semibold">Copilot Vision</h2>
                    {postId && (
                        <div className="relative" ref={sessionPickerRef}>
                            <button
                                onClick={() => setSessionPickerOpen(!sessionPickerOpen)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Chat Sessions"
                            >
                                <History className="w-3 h-3" />
                                {sessions.length > 0 && <span>{sessions.length}</span>}
                            </button>
                            {sessionPickerOpen && (
                                <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                                    <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Chat Sessions</p>
                                        <button
                                            onClick={handleNewSession}
                                            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                                        >
                                            <Plus className="w-3 h-3" />
                                            New
                                        </button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {sessions.map((session) => (
                                            <button
                                                key={session.id}
                                                onClick={() => handleLoadSession(session)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0",
                                                    session.id === currentSessionId && "bg-primary/5 border-l-2 border-l-primary"
                                                )}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(session.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                                                        {new Date(session.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                                    </span>
                                                    <span className="text-xs text-foreground truncate">
                                                        {session.messages.filter(m => m.role === "user").slice(-1)[0]?.content?.slice(0, 40) || "Empty session"}
                                                        {(session.messages.filter(m => m.role === "user").slice(-1)[0]?.content?.length || 0) > 40 ? "…" : ""}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {session.messages.filter(m => m.role === "user").length} messages
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                        {sessions.length === 0 && (
                                            <p className="text-xs text-muted-foreground text-center py-4">No saved sessions</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <Select
                    value={overrideModel || "tier-default"}
                    onValueChange={(val) => setOverrideModel(val === "tier-default" ? null : val)}
                >
                    <SelectTrigger className="w-[180px] h-8 text-xs bg-muted/50 border-transparent hover:border-border">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="tier-default">🎛️ Use Tier Buttons</SelectItem>
                        {availableModels.map(model => (
                            <SelectItem key={model} value={model}>{model}</SelectItem>
                        ))}
                        {availableModels.length === 0 && (
                            <SelectItem value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet (Legacy)</SelectItem>
                        )}
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                {messages.map((msg, index) => (
                    <div key={index} className={cn("flex flex-col gap-2 max-w-[90%]", msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start")}>
                        {msg.imageUrls && msg.imageUrls.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-1 justify-end">
                                {msg.imageUrls.map((url, i) => (
                                    <div key={i} className="relative group overflow-hidden rounded-lg border border-border">
                                        <img src={url} alt="attachment" className="h-24 w-auto object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {msg.content && (
                            <div className={cn(
                                "rounded-2xl text-sm whitespace-pre-wrap leading-relaxed",
                                msg.role === "user"
                                    ? "p-3 bg-primary text-primary-foreground rounded-br-sm"
                                    : msg.role === "details"
                                        ? "px-3 py-1.5 text-[11px] font-mono text-muted-foreground bg-transparent"
                                        : "p-3 bg-muted text-foreground rounded-bl-sm"
                            )}>
                                {msg.content}
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="mr-auto flex items-center gap-2 text-muted-foreground text-sm p-2">
                        <Brain className="w-4 h-4 animate-pulse" />
                        Thinking...
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border mt-auto shrink-0 bg-background/50 backdrop-blur">
                {(pendingAttachments.length > 0 || isUploading || refTemplateName || capturingRef) && (
                    <div className="space-y-2 pb-3">
                        {(refTemplateName || capturingRef) && (
                            <div className="flex items-center gap-2">
                                {capturingRef ? (
                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Capturing reference...
                                    </Badge>
                                ) : refTemplateName && (
                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 gap-1 pr-1">
                                        <LayoutTemplate className="w-3 h-3" />
                                        Ref: {refTemplateName}
                                        <button onClick={clearReference} className="ml-1 rounded-full p-0.5 hover:bg-purple-500/20">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </Badge>
                                )}
                            </div>
                        )}
                        {(pendingAttachments.length > 0 || isUploading) && (
                            <div className="flex gap-2 overflow-x-auto">
                                {pendingAttachments.map((url, i) => (
                                    <div key={i} className="relative group shrink-0">
                                        {url.toLowerCase().endsWith('.pdf') ? (
                                            <div className="h-14 w-14 rounded-md border border-border bg-muted flex items-center justify-center">
                                                <FileText className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                        ) : (
                                            <img src={url} className="h-14 w-14 rounded-md object-cover border border-border" />
                                        )}
                                        <button
                                            onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {isUploading && (
                                    <div className="h-14 w-14 rounded-md border border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/20">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    {/* Image Mode Toggle */}
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit border border-border">
                        <button
                            type="button"
                            onClick={() => setImageMode('library')}
                            className={cn("text-[10px] font-medium px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5", imageMode === 'library' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            title="Attempt to use images from your Asset Library first"
                        >
                            📚 Use Library
                        </button>
                        <button
                            type="button"
                            onClick={() => setImageMode('creative')}
                            className={cn("text-[10px] font-medium px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5", imageMode === 'creative' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            title="Generate AI images on the fly"
                        >
                            ✨ Be Creative
                        </button>
                    </div>

                    {/* Theme Dropdown */}
                    <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
                        <SelectTrigger className="h-8 text-[10px] w-[160px] bg-muted/50 border-border">
                            <Palette className="w-3 h-3 mr-1.5 text-muted-foreground shrink-0" />
                            <SelectValue placeholder="Select Theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No Theme (Default)</SelectItem>
                            {themes.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,application/pdf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                    />

                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                if (autoRouting && !overrideModel) {
                                    handleSendMessage()
                                } else {
                                    handleSendMessage("low")
                                }
                            }
                        }}
                        onPaste={handlePaste}
                        placeholder="Type a message..."
                        className="w-full min-h-[40px]"
                        disabled={isLoading}
                        autoFocus
                    />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:text-foreground h-8 w-8"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading || isLoading}
                                title="Attach image"
                            >
                                <Paperclip className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "shrink-0 hover:text-foreground h-8 w-8",
                                    refTemplateName ? "text-purple-400" : "text-muted-foreground"
                                )}
                                onClick={handleOpenRefPicker}
                                disabled={isUploading || isLoading || capturingRef}
                                title="Reference a post style"
                            >
                                <LayoutTemplate className="w-4 h-4" />
                            </Button>
                        </div>

                        {autoRouting && !overrideModel ? (
                            <Button
                                size="icon"
                                onClick={() => handleSendMessage()}
                                disabled={!canSend}
                                className={cn("bg-amber-600 hover:bg-amber-500 text-white h-8 w-8", isLoading && "opacity-50")}
                                title="Auto-routed send"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </Button>
                        ) : (
                            <div className="flex gap-1">
                                <Button
                                    size="icon"
                                    onClick={() => handleSendMessage("low")}
                                    disabled={!canSend}
                                    className="bg-green-600 hover:bg-green-500 text-white h-8 w-8"
                                    title={`Low: ${overrideModel || modelLow} (Enter)`}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    onClick={() => handleSendMessage("medium")}
                                    disabled={!canSend}
                                    className="bg-amber-600 hover:bg-amber-500 text-white h-8 w-8"
                                    title={`Medium: ${overrideModel || modelMedium}`}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    onClick={() => handleSendMessage("high")}
                                    disabled={!canSend}
                                    className="bg-red-600 hover:bg-red-500 text-white h-8 w-8"
                                    title={`High: ${overrideModel || modelHigh}`}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reference Template Picker Dialog */}
            <Dialog open={isRefPickerOpen} onOpenChange={setIsRefPickerOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reference Post</DialogTitle>
                        <DialogDescription>Select a post to use as a style reference. A screenshot and CSS will be attached to your next prompt.</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        {loadingTemplates ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : refTemplates.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No posts found.</p>
                        ) : (
                            <ScrollArea className="h-[300px] pr-4">
                                <div className="space-y-2">
                                    {refTemplates.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleSelectRefTemplate(t)}
                                            className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                                        >
                                            <h4 className="font-medium text-sm text-foreground">{t.name}</h4>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Created: {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
