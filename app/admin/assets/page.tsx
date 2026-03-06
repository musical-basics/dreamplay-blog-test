"use client"

import { useState, useEffect, useRef } from "react"
import { getAllLibraryAssets, updateAssetDescription, toggleAssetStar, uploadHashedAsset, deleteAsset } from "@/app/actions/assets"
import { getAllTags, getAllAssetTagLinks, setAssetTags, createTag } from "@/app/actions/tags"
import { Loader2, ImageIcon, Search, Check, Star, Upload, Trash2, Plus, Filter, X, Tags } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import imageCompression from "browser-image-compression"

type TagItem = { id: string; name: string; color: string }

type FilterMode = "all" | "starred" | "unstarred"

const COMPRESSION_THRESHOLD = 300 * 1024 // 300KB

export default function AssetsLibraryPage() {
    const [assets, setAssets] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [savingId, setSavingId] = useState<string | null>(null)
    const [filter, setFilter] = useState<FilterMode>("all")
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [allTags, setAllTags] = useState<TagItem[]>([])
    const [assetTagMap, setAssetTagMap] = useState<Record<string, string[]>>({})
    const [openTagPicker, setOpenTagPicker] = useState<string | null>(null)
    const [includeTags, setIncludeTags] = useState<string[]>([])
    const [excludeTags, setExcludeTags] = useState<string[]>([])
    const [showIncludeDropdown, setShowIncludeDropdown] = useState(false)
    const [showExcludeDropdown, setShowExcludeDropdown] = useState(false)
    const includeRef = useRef<HTMLDivElement>(null)
    const excludeRef = useRef<HTMLDivElement>(null)
    const [showAllTags, setShowAllTags] = useState(false)

    // Bulk tagging state
    const [selectedAssets, setSelectedAssets] = useState<string[]>([])
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
    const [showBulkTagPicker, setShowBulkTagPicker] = useState(false)
    const [isBulkTugging, setIsBulkTugging] = useState(false)

    // Recently used tags (persisted in localStorage)
    const [recentTagIds, setRecentTagIds] = useState<string[]>(() => {
        if (typeof window === 'undefined') return []
        try {
            return JSON.parse(localStorage.getItem('recentAssetTags') || '[]')
        } catch { return [] }
    })

    const addToRecentTags = (tagId: string) => {
        setRecentTagIds(prev => {
            const updated = [tagId, ...prev.filter(t => t !== tagId)].slice(0, 10)
            localStorage.setItem('recentAssetTags', JSON.stringify(updated))
            return updated
        })
    }

    useEffect(() => {
        const fetchAll = async () => {
            const [dbAssets, dbTags, dbLinks] = await Promise.all([
                getAllLibraryAssets(),
                getAllTags(),
                getAllAssetTagLinks(),
            ])
            setAssets(dbAssets)
            setAllTags(dbTags as TagItem[])
            // Build a map: assetId → tagId[]
            const map: Record<string, string[]> = {}
            for (const link of dbLinks) {
                if (!map[link.asset_id]) map[link.asset_id] = []
                map[link.asset_id].push(link.tag_id)
            }
            setAssetTagMap(map)
            setLoading(false)
        }
        fetchAll()
    }, [])

    const handleSaveDescription = async (id: string, description: string) => {
        setSavingId(id)
        await updateAssetDescription(id, description)
        setTimeout(() => setSavingId(null), 1000)
    }

    const handleToggleStar = async (id: string, currentlyStarred: boolean) => {
        // Optimistic update
        setAssets(prev => prev.map(a => a.id === id ? { ...a, is_starred: !currentlyStarred } : a))
        await toggleAssetStar(id, !currentlyStarred)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this asset? This action can't be undone.")) return
        setAssets(prev => prev.filter(a => a.id !== id))
        await deleteAsset(id)
    }

    const handleToggleTag = async (assetId: string, tagId: string) => {
        const current = assetTagMap[assetId] || []
        const isAdding = !current.includes(tagId)
        const updated = isAdding
            ? [...current, tagId]
            : current.filter(t => t !== tagId)
        setAssetTagMap(prev => ({ ...prev, [assetId]: updated }))
        if (isAdding) addToRecentTags(tagId)
        await setAssetTags(assetId, updated)
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        try {
            for (const rawFile of Array.from(files)) {
                let fileToUpload: File = rawFile

                // Compress if image is over 300KB
                if (rawFile.type.startsWith("image/") && rawFile.size > COMPRESSION_THRESHOLD) {
                    const compressed = await imageCompression(rawFile, {
                        maxSizeMB: 0.3,       // target ~300KB
                        maxWidthOrHeight: 2048,
                        useWebWorker: true,
                        fileType: rawFile.type as string,
                    })
                    fileToUpload = new File([compressed], rawFile.name, { type: compressed.type })
                }

                const formData = new FormData()
                formData.set("file", fileToUpload)

                const result = await uploadHashedAsset(formData, "")
                if (result.success && result.asset) {
                    setAssets(prev => [result.asset, ...prev])
                }
            }
        } catch (err) {
            console.error("Upload failed:", err)
        } finally {
            setUploading(false)
            // Reset the input so the same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (includeRef.current && !includeRef.current.contains(e.target as Node)) setShowIncludeDropdown(false)
            if (excludeRef.current && !excludeRef.current.contains(e.target as Node)) setShowExcludeDropdown(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const filteredAssets = assets.filter(a => {
        const matchesSearch = a.filename.toLowerCase().includes(search.toLowerCase()) ||
            (a.description || "").toLowerCase().includes(search.toLowerCase())
        const matchesFilter = filter === "all" ||
            (filter === "starred" && a.is_starred) ||
            (filter === "unstarred" && !a.is_starred)
        if (!matchesSearch || !matchesFilter) return false

        const assetTags = assetTagMap[a.id] || []

        // Include filter: asset must have at least one of the included tags
        if (includeTags.length > 0) {
            const hasIncluded = assetTags.some(t => includeTags.includes(t))
            if (!hasIncluded) return false
        }

        // Exclude filter: asset must NOT have any of the excluded tags
        if (excludeTags.length > 0) {
            const hasExcluded = assetTags.some(t => excludeTags.includes(t))
            if (hasExcluded) return false
        }

        return true
    })

    const handleSelectAsset = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        e.preventDefault()

        if (e.shiftKey && lastSelectedId) {
            const currentIndex = filteredAssets.findIndex(a => a.id === id)
            const lastIndex = filteredAssets.findIndex(a => a.id === lastSelectedId)

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex)
                const end = Math.max(currentIndex, lastIndex)

                const rangeIds = filteredAssets.slice(start, end + 1).map(a => a.id)
                setSelectedAssets(prev => Array.from(new Set([...prev, ...rangeIds])))
                return
            }
        }

        if (selectedAssets.includes(id)) {
            setSelectedAssets(prev => prev.filter(x => x !== id))
            setLastSelectedId(null) // Reset anchor on deselect
        } else {
            setSelectedAssets(prev => [...prev, id])
            setLastSelectedId(id)
        }
    }

    const handleBulkToggleTag = async (tagId: string) => {
        setIsBulkTugging(true)
        try {
            // Check if ALL selected assets currently have this tag
            const allHaveTag = selectedAssets.every(id => (assetTagMap[id] || []).includes(tagId))
            const newMap = { ...assetTagMap }

            if (!allHaveTag) addToRecentTags(tagId)

            await Promise.all(selectedAssets.map(async (id) => {
                const currentTags = newMap[id] || []
                let updatedTags: string[]

                if (allHaveTag) {
                    updatedTags = currentTags.filter(t => t !== tagId) // Remove from all
                } else {
                    updatedTags = currentTags.includes(tagId) ? currentTags : [...currentTags, tagId] // Add to all
                }

                newMap[id] = updatedTags
                await setAssetTags(id, updatedTags)
            }))

            setAssetTagMap(newMap)
        } finally {
            setIsBulkTugging(false)
        }
    }

    const starredCount = assets.filter(a => a.is_starred).length

    const TAG_CHIP_LIMIT = 20
    const visibleChipTags = showAllTags ? allTags : allTags.slice(0, TAG_CHIP_LIMIT)
    const hasMoreTags = allTags.length > TAG_CHIP_LIMIT

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ImageIcon className="w-6 h-6 text-primary" />
                    AI Asset Library
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Star images and add descriptions so the AI Copilot can embed them directly into blog posts. Only <strong>starred</strong> images are sent to the AI.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by filename or description..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Upload button */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                            "bg-primary text-primary-foreground hover:bg-primary/90",
                            uploading && "opacity-60 cursor-not-allowed"
                        )}
                    >
                        {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        {uploading ? "Uploading..." : "Upload Image"}
                    </button>

                    {/* Tag Filters */}
                    <div className="flex items-center gap-2">
                        {/* Include Tags */}
                        <div ref={includeRef} className="relative">
                            <button
                                onClick={() => { setShowIncludeDropdown(v => !v); setShowExcludeDropdown(false) }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                                    includeTags.length > 0
                                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25"
                                        : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                Include{includeTags.length > 0 && ` (${includeTags.length})`}
                            </button>
                            {showIncludeDropdown && (
                                <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-lg shadow-xl p-1.5 min-w-[200px] max-h-64 overflow-y-auto">
                                    {allTags.length === 0 && (
                                        <p className="text-xs text-muted-foreground px-2 py-3 text-center">No tags yet</p>
                                    )}
                                    {allTags.map(tag => {
                                        const isActive = includeTags.includes(tag.id)
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => {
                                                    setIncludeTags(prev =>
                                                        isActive ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                                                    )
                                                }}
                                                className={cn(
                                                    "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                                                    isActive ? "bg-emerald-500/15 text-emerald-300" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                )}
                                            >
                                                <div
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: tag.color }}
                                                />
                                                <span className="flex-1">{tag.name}</span>
                                                {isActive && <Check className="w-3 h-3" />}
                                            </button>
                                        )
                                    })}
                                    {includeTags.length > 0 && (
                                        <>
                                            <div className="border-t border-border my-1" />
                                            <button
                                                onClick={() => setIncludeTags([])}
                                                className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                <X className="w-3 h-3" /> Clear all
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Exclude Tags */}
                        <div ref={excludeRef} className="relative">
                            <button
                                onClick={() => { setShowExcludeDropdown(v => !v); setShowIncludeDropdown(false) }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                                    excludeTags.length > 0
                                        ? "bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25"
                                        : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                Exclude{excludeTags.length > 0 && ` (${excludeTags.length})`}
                            </button>
                            {showExcludeDropdown && (
                                <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-lg shadow-xl p-1.5 min-w-[200px] max-h-64 overflow-y-auto">
                                    {allTags.length === 0 && (
                                        <p className="text-xs text-muted-foreground px-2 py-3 text-center">No tags yet</p>
                                    )}
                                    {allTags.map(tag => {
                                        const isActive = excludeTags.includes(tag.id)
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => {
                                                    setExcludeTags(prev =>
                                                        isActive ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                                                    )
                                                }}
                                                className={cn(
                                                    "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                                                    isActive ? "bg-red-500/15 text-red-300" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                )}
                                            >
                                                <div
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: tag.color }}
                                                />
                                                <span className="flex-1">{tag.name}</span>
                                                {isActive && <Check className="w-3 h-3" />}
                                            </button>
                                        )
                                    })}
                                    {excludeTags.length > 0 && (
                                        <>
                                            <div className="border-t border-border my-1" />
                                            <button
                                                onClick={() => setExcludeTags([])}
                                                className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                <X className="w-3 h-3" /> Clear all
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Star filter tabs */}
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                        <button
                            onClick={() => setFilter("all")}
                            className={cn(
                                "text-xs font-medium px-3 py-1.5 rounded-md transition-all",
                                filter === "all" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            All ({assets.length})
                        </button>
                        <button
                            onClick={() => setFilter("starred")}
                            className={cn(
                                "text-xs font-medium px-3 py-1.5 rounded-md transition-all flex items-center gap-1",
                                filter === "starred" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            Starred ({starredCount})
                        </button>
                        <button
                            onClick={() => setFilter("unstarred")}
                            className={cn(
                                "text-xs font-medium px-3 py-1.5 rounded-md transition-all",
                                filter === "unstarred" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Unstarred ({assets.length - starredCount})
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick tag chips */}
            {allTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {visibleChipTags.map(tag => {
                        const isActive = includeTags.includes(tag.id)
                        return (
                            <button
                                key={tag.id}
                                onClick={() => {
                                    setIncludeTags(prev =>
                                        isActive ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                                    )
                                }}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border",
                                    isActive
                                        ? "text-white border-transparent shadow-sm"
                                        : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                                )}
                                style={isActive ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                            >
                                <div
                                    className={cn("w-2.5 h-2.5 rounded-full shrink-0", isActive && "bg-white/30")}
                                    style={!isActive ? { backgroundColor: tag.color } : undefined}
                                />
                                {tag.name}
                            </button>
                        )
                    })}
                    {hasMoreTags && (
                        <button
                            onClick={() => setShowAllTags(v => !v)}
                            className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 transition-colors"
                        >
                            {showAllTags ? "Show less" : `+${allTags.length - TAG_CHIP_LIMIT} more`}
                        </button>
                    )}
                    {includeTags.length > 0 && (
                        <button
                            onClick={() => setIncludeTags([])}
                            className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 transition-colors flex items-center gap-1"
                        >
                            <X className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
            )}

            {/* Sticky Bulk Action Bar */}
            {selectedAssets.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <div className="bg-popover border border-border shadow-2xl rounded-full px-4 py-2 flex items-center gap-4">
                        <span className="text-sm font-medium px-2">{selectedAssets.length} selected</span>

                        <div className="relative">
                            <button
                                onClick={() => setShowBulkTagPicker(v => !v)}
                                disabled={isBulkTugging}
                                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                {isBulkTugging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tags className="w-4 h-4" />}
                                Bulk Tag
                            </button>

                            {showBulkTagPicker && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 bg-popover border border-border rounded-xl shadow-xl p-2 w-56 max-h-64 overflow-y-auto">
                                    <p className="text-xs font-medium text-muted-foreground px-2 pb-2 mb-2 border-b border-border">Apply to {selectedAssets.length} assets</p>
                                    {allTags.map(tag => {
                                        const allHaveIt = selectedAssets.every(id => (assetTagMap[id] || []).includes(tag.id))
                                        const someHaveIt = !allHaveIt && selectedAssets.some(id => (assetTagMap[id] || []).includes(tag.id))

                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => handleBulkToggleTag(tag.id)}
                                                className={cn(
                                                    "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                                                    allHaveIt ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                )}
                                            >
                                                <div
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: tag.color }}
                                                />
                                                <span className="flex-1 truncate">{tag.name}</span>
                                                {allHaveIt && <Check className="w-3 h-3 text-primary" />}
                                                {someHaveIt && <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" title="Some selected assets have this tag" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="w-px h-6 bg-border" />

                        <button
                            onClick={() => { setSelectedAssets([]); setLastSelectedId(null); setShowBulkTagPicker(false); }}
                            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Clear selection"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredAssets.map(asset => (
                        <div
                            key={asset.id}
                            className={cn(
                                "bg-card border rounded-xl overflow-hidden shadow-sm flex flex-col transition-colors",
                                asset.is_starred ? "border-yellow-500/40 ring-1 ring-yellow-500/20" : "border-border",
                                selectedAssets.includes(asset.id) && "border-primary ring-2 ring-primary bg-primary/5"
                            )}
                        >
                            <div className="h-40 bg-muted/30 border-b border-border flex items-center justify-center p-2 relative group">
                                <img src={asset.public_url} alt={asset.filename} className="max-h-full max-w-full object-contain rounded" />
                                {/* Selection Checkbox */}
                                <div
                                    onClick={(e) => handleSelectAsset(e, asset.id)}
                                    className={cn(
                                        "absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center border transition-all cursor-pointer shadow-sm z-10",
                                        selectedAssets.includes(asset.id)
                                            ? "bg-primary border-primary text-primary-foreground opacity-100"
                                            : "bg-black/40 border-white/40 text-transparent hover:border-white opacity-0 group-hover:opacity-100"
                                    )}
                                >
                                    <Check className="w-4 h-4" />
                                </div>
                                {/* Star button overlay */}
                                <button
                                    onClick={() => handleToggleStar(asset.id, !!asset.is_starred)}
                                    className={cn(
                                        "absolute top-2 right-2 p-1.5 rounded-full transition-all",
                                        asset.is_starred
                                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                            : "bg-black/40 text-white/60 hover:text-white hover:bg-black/60"
                                    )}
                                    title={asset.is_starred ? "Remove from AI library" : "Add to AI library"}
                                >
                                    <Star className={cn("w-4 h-4", asset.is_starred && "fill-yellow-400")} />
                                </button>
                            </div>
                            <div className="p-4 flex flex-col flex-1 gap-3">
                                <p className="text-xs font-mono text-muted-foreground truncate" title={asset.filename}>
                                    {asset.filename}
                                </p>
                                <div className="flex-1">
                                    <Textarea
                                        defaultValue={asset.description || ""}
                                        placeholder="Describe for AI (e.g. 'Pianist hand stretching in pain')..."
                                        className="text-xs resize-none h-24 bg-muted/30 focus:bg-background"
                                        onBlur={(e) => {
                                            if (e.target.value !== asset.description) {
                                                handleSaveDescription(asset.id, e.target.value);
                                                asset.description = e.target.value;
                                            }
                                        }}
                                    />
                                </div>
                                {/* Tags */}
                                <div className="flex flex-wrap items-center gap-1.5 min-h-[24px] relative">
                                    {(assetTagMap[asset.id] || []).map(tagId => {
                                        const tag = allTags.find(t => t.id === tagId)
                                        if (!tag) return null
                                        return (
                                            <span
                                                key={tag.id}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                                                style={{ backgroundColor: tag.color }}
                                            >
                                                {tag.name}
                                            </span>
                                        )
                                    })}
                                    <button
                                        onClick={() => setOpenTagPicker(openTagPicker === asset.id ? null : asset.id)}
                                        className="p-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        title="Manage tags"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    {/* Recent tag suggestions (faded, quick-assign) */}
                                    {(() => {
                                        const assigned = assetTagMap[asset.id] || []
                                        const suggestions = recentTagIds
                                            .filter(tid => !assigned.includes(tid))
                                            .slice(0, 3)
                                            .map(tid => allTags.find(t => t.id === tid))
                                            .filter(Boolean) as TagItem[]
                                        if (suggestions.length === 0) return null
                                        return suggestions.map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => handleToggleTag(asset.id, tag.id)}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-dashed transition-all opacity-30 hover:opacity-100"
                                                style={{ borderColor: tag.color, color: tag.color }}
                                                title={`Quick-assign "${tag.name}"`}
                                            >
                                                {tag.name}
                                            </button>
                                        ))
                                    })()}
                                    {openTagPicker === asset.id && (
                                        <div className="absolute bottom-full left-0 mb-1 z-20 bg-popover border border-border rounded-lg shadow-xl p-2 min-w-[200px] max-h-56 overflow-y-auto">
                                            {allTags.map(tag => {
                                                const isActive = (assetTagMap[asset.id] || []).includes(tag.id)
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        onClick={() => handleToggleTag(asset.id, tag.id)}
                                                        className={cn(
                                                            "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                                                            isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                        )}
                                                    >
                                                        <div
                                                            className="w-3 h-3 rounded-full shrink-0"
                                                            style={{ backgroundColor: tag.color }}
                                                        />
                                                        <span className="flex-1">{tag.name}</span>
                                                        {isActive && <Check className="w-3 h-3 text-primary" />}
                                                    </button>
                                                )
                                            })}
                                            {allTags.length > 0 && <div className="border-t border-border my-1.5" />}
                                            <form
                                                onSubmit={async (e) => {
                                                    e.preventDefault()
                                                    const input = (e.target as HTMLFormElement).elements.namedItem("newTag") as HTMLInputElement
                                                    const name = input.value.trim()
                                                    if (!name) return
                                                    const colors = ["#ef4444", "#f97316", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#eab308"]
                                                    const color = colors[Math.floor(Math.random() * colors.length)]
                                                    const res = await createTag(name, color)
                                                    if (res.success && res.tag) {
                                                        const newTag = res.tag as TagItem
                                                        setAllTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)))
                                                        // Auto-assign to this asset
                                                        const current = assetTagMap[asset.id] || []
                                                        const updated = [...current, newTag.id]
                                                        setAssetTagMap(prev => ({ ...prev, [asset.id]: updated }))
                                                        addToRecentTags(newTag.id)
                                                        await setAssetTags(asset.id, updated)
                                                    }
                                                    input.value = ""
                                                }}
                                                className="flex items-center gap-1.5 px-1"
                                            >
                                                <input
                                                    name="newTag"
                                                    type="text"
                                                    placeholder="Create new tag..."
                                                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none py-1.5 px-1"
                                                    autoComplete="off"
                                                />
                                                <button type="submit" className="p-1 rounded text-muted-foreground hover:text-primary transition-colors">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground h-6">
                                    <button
                                        onClick={() => handleDelete(asset.id)}
                                        className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        title="Delete asset"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    {savingId === asset.id && <span className="text-primary flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
