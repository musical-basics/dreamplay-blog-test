"use client"

import { useState, useEffect } from "react"
import { Code, Image as ImageIcon, FileText, Loader2, Save, Trash2, LayoutTemplate, ChevronRight, Pencil, Check, X, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { getThemes, saveTheme, deleteTheme, updateTheme } from "@/app/actions/themes"
import { PreviewPane } from "@/components/editor/preview-pane"
import { CodePane } from "@/components/editor/code-pane"
import { cn } from "@/lib/utils"

interface Theme {
    id: string
    name: string
    html_template: string
    created_at: string
}

export default function ThemeAnalyzerPage() {
    const [mode, setMode] = useState<"code" | "image" | "pdf">("code")
    const [code, setCode] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [generatedHtml, setGeneratedHtml] = useState("")
    const [themeName, setThemeName] = useState("")
    const [themes, setThemes] = useState<Theme[]>([])
    const [viewTab, setViewTab] = useState<"preview" | "code">("preview")

    // Theme detail view state
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)
    const [editingName, setEditingName] = useState(false)
    const [editName, setEditName] = useState("")
    const [savingName, setSavingName] = useState(false)
    const [detailViewTab, setDetailViewTab] = useState<"preview" | "code">("preview")
    const [detailHtml, setDetailHtml] = useState("")
    const [savingHtml, setSavingHtml] = useState(false)

    useEffect(() => {
        getThemes().then(setThemes)
    }, [])

    const handleAnalyze = async () => {
        setLoading(true)
        setSelectedTheme(null) // switch back to generator view
        try {
            const fd = new FormData()
            fd.append("mode", mode)
            if (mode === "code") fd.append("code", code)
            if (file) fd.append("file", file)

            const res = await fetch("/api/analyze-theme", { method: "POST", body: fd })
            const data = await res.json()
            if (data.html) setGeneratedHtml(data.html)
            else if (data.error) console.error("Theme analysis failed:", data.error)
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const handleSave = async () => {
        if (!themeName || !generatedHtml) return
        await saveTheme(themeName, generatedHtml)
        setThemeName("")
        getThemes().then(setThemes)
    }

    const openThemeDetail = (theme: Theme) => {
        setSelectedTheme(theme)
        setDetailHtml(theme.html_template)
        setDetailViewTab("preview")
        setEditingName(false)
    }

    const handleRenameSave = async () => {
        if (!selectedTheme || !editName.trim()) return
        setSavingName(true)
        try {
            await updateTheme(selectedTheme.id, { name: editName.trim() })
            const updated = { ...selectedTheme, name: editName.trim() }
            setSelectedTheme(updated)
            setThemes(prev => prev.map(t => t.id === updated.id ? updated : t))
            setEditingName(false)
        } catch (e) {
            console.error(e)
        }
        setSavingName(false)
    }

    const handleSaveHtmlChanges = async () => {
        if (!selectedTheme || detailHtml === selectedTheme.html_template) return
        setSavingHtml(true)
        try {
            await updateTheme(selectedTheme.id, { html_template: detailHtml })
            const updated = { ...selectedTheme, html_template: detailHtml }
            setSelectedTheme(updated)
            setThemes(prev => prev.map(t => t.id === updated.id ? updated : t))
        } catch (e) {
            console.error(e)
        }
        setSavingHtml(false)
    }

    const handleDeleteTheme = async (id: string) => {
        if (!confirm("Delete this theme?")) return
        await deleteTheme(id)
        if (selectedTheme?.id === id) setSelectedTheme(null)
        getThemes().then(setThemes)
    }

    // Determine what to show on the right panel
    const showDetailView = !!selectedTheme
    const showGeneratorOutput = !showDetailView

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* LEFT: Input & Controls */}
            <div className="w-[360px] flex flex-col gap-5 p-6 border-r border-border overflow-y-auto shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <LayoutTemplate className="w-6 h-6 text-primary" />
                        Theme Analyzer
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Extract aesthetics from inspiration to create reusable CSS skeletons.</p>
                </div>

                {/* Mode tabs */}
                <div className="flex bg-muted p-1 rounded-lg">
                    {([
                        { key: "code", label: "Code", icon: Code },
                        { key: "image", label: "Image", icon: ImageIcon },
                        { key: "pdf", label: "PDF", icon: FileText },
                    ] as const).map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => { setMode(key); setFile(null); }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-md transition-all",
                                mode === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                            )}
                        >
                            <Icon className="w-4 h-4" /> {label}
                        </button>
                    ))}
                </div>

                {mode === "code" ? (
                    <Textarea
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Paste reference HTML/CSS here..."
                        className="h-64 font-mono text-xs border-border"
                    />
                ) : (
                    <div className="border-2 border-dashed border-border rounded-lg p-10 text-center flex flex-col items-center justify-center bg-muted/20 gap-3">
                        <div className="text-muted-foreground text-sm">
                            {mode === "image" ? "Drop an image or click to browse" : "Drop a PDF or click to browse"}
                        </div>
                        <input
                            type="file"
                            accept={mode === "image" ? "image/*" : ".pdf,application/pdf"}
                            onChange={e => setFile(e.target.files?.[0] || null)}
                            className="text-sm"
                        />
                        {file && <p className="text-xs text-primary mt-2">{file.name}</p>}
                    </div>
                )}

                <Button
                    onClick={handleAnalyze}
                    disabled={loading || (mode === "code" && !code) || (mode !== "code" && !file)}
                    className="w-full"
                >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Code className="w-4 h-4 mr-2" />}
                    {loading ? "Analyzing Design..." : "Extract Theme"}
                </Button>

                {/* Saved Themes List */}
                <div className="pt-5 border-t border-border">
                    <h3 className="font-semibold text-sm mb-3">Saved Themes</h3>
                    <div className="space-y-2">
                        {themes.length === 0 && (
                            <p className="text-xs text-muted-foreground">No themes saved yet.</p>
                        )}
                        {themes.map(t => (
                            <button
                                key={t.id}
                                onClick={() => openThemeDetail(t)}
                                className={cn(
                                    "w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all text-left group",
                                    selectedTheme?.id === t.id
                                        ? "border-primary bg-primary/10 text-foreground"
                                        : "border-border bg-card text-foreground hover:border-muted-foreground/40 hover:bg-muted/30"
                                )}
                            >
                                <div className="flex flex-col min-w-0 mr-2">
                                    <span className="font-medium truncate">{t.name}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTheme(t.id); }}
                                        className="text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </span>
                                    <ChevronRight className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform",
                                        selectedTheme?.id === t.id && "rotate-90 text-primary"
                                    )} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT: Output / Theme Detail */}
            <div className="flex-1 flex flex-col bg-card overflow-hidden">
                {showDetailView && selectedTheme ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <button
                                    onClick={() => setSelectedTheme(null)}
                                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                                    title="Back to generator"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>

                                {editingName ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => e.key === "Enter" && handleRenameSave()}
                                            className="h-8 w-48 text-sm"
                                            autoFocus
                                        />
                                        <button onClick={handleRenameSave} disabled={savingName} className="text-green-500 hover:text-green-400">
                                            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h2 className="text-sm font-semibold truncate">{selectedTheme.name}</h2>
                                        <button
                                            onClick={() => { setEditName(selectedTheme.name); setEditingName(true); }}
                                            className="text-muted-foreground hover:text-foreground shrink-0"
                                            title="Rename theme"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex bg-muted p-1 rounded-lg">
                                    <button
                                        onClick={() => setDetailViewTab("preview")}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            detailViewTab === "preview" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                                        )}
                                    >
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => setDetailViewTab("code")}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            detailViewTab === "code" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                                        )}
                                    >
                                        HTML/CSS
                                    </button>
                                </div>
                                {detailViewTab === "code" && detailHtml !== selectedTheme.html_template && (
                                    <Button size="sm" onClick={handleSaveHtmlChanges} disabled={savingHtml} className="h-8">
                                        {savingHtml ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
                                        Save Changes
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 bg-[#0a0a0a] overflow-y-auto p-6">
                            {detailViewTab === "preview" ? (
                                <div className="bg-white mx-auto max-w-[800px] shadow-2xl rounded overflow-hidden">
                                    <PreviewPane html={detailHtml} />
                                </div>
                            ) : (
                                <CodePane code={detailHtml} onChange={setDetailHtml} className="h-full border-none rounded" />
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Generator Header */}
                        <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                            <div className="flex bg-muted p-1 rounded-lg">
                                <button
                                    onClick={() => setViewTab("preview")}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        viewTab === "preview" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    Preview
                                </button>
                                <button
                                    onClick={() => setViewTab("code")}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        viewTab === "code" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    HTML/CSS
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={themeName}
                                    onChange={e => setThemeName(e.target.value)}
                                    placeholder="Theme Name (e.g. Luxury Dark)"
                                    className="h-8 w-48 text-xs"
                                />
                                <Button size="sm" onClick={handleSave} disabled={!generatedHtml || !themeName} className="h-8">
                                    <Save className="w-3 h-3 mr-2" /> Save Theme
                                </Button>
                            </div>
                        </div>

                        {generatedHtml ? (
                            <div className="flex-1 bg-[#0a0a0a] overflow-y-auto p-6">
                                {viewTab === "preview" ? (
                                    <div className="bg-white mx-auto max-w-[800px] shadow-2xl rounded overflow-hidden">
                                        <PreviewPane html={generatedHtml} />
                                    </div>
                                ) : (
                                    <CodePane code={generatedHtml} onChange={setGeneratedHtml} className="h-full border-none rounded" />
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm flex-col gap-3">
                                <LayoutTemplate className="w-10 h-10 opacity-20" />
                                Generate a template to see preview
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
