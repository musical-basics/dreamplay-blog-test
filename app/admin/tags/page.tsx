"use client"

import { useState, useEffect } from "react"
import { getAllTags, createTag, updateTag, deleteTag } from "@/app/actions/tags"
import { Loader2, Plus, Pencil, Trash2, Tag, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PRESET_COLORS = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308",
    "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
    "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
]

type TagItem = { id: string; name: string; color: string; created_at: string }

export default function TagsPage() {
    const [tags, setTags] = useState<TagItem[]>([])
    const [loading, setLoading] = useState(true)

    // Create form
    const [newName, setNewName] = useState("")
    const [newColor, setNewColor] = useState(PRESET_COLORS[5])
    const [creating, setCreating] = useState(false)

    // Edit state
    const [editId, setEditId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editColor, setEditColor] = useState("")

    useEffect(() => {
        getAllTags().then(data => {
            setTags(data as TagItem[])
            setLoading(false)
        })
    }, [])

    const handleCreate = async () => {
        if (!newName.trim()) return
        setCreating(true)
        const res = await createTag(newName, newColor)
        if (res.success && res.tag) {
            setTags(prev => [...prev, res.tag as TagItem].sort((a, b) => a.name.localeCompare(b.name)))
            setNewName("")
            setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
        }
        setCreating(false)
    }

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return
        await updateTag(id, editName, editColor)
        setTags(prev => prev.map(t => t.id === id ? { ...t, name: editName.trim(), color: editColor } : t))
        setEditId(null)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this tag? It will be removed from all assets.")) return
        await deleteTag(id)
        setTags(prev => prev.filter(t => t.id !== id))
    }

    const startEdit = (tag: TagItem) => {
        setEditId(tag.id)
        setEditName(tag.name)
        setEditColor(tag.color)
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Tag className="w-6 h-6 text-primary" />
                    Manage Tags
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Create color-coded tags to organize your assets. Tags can be assigned to images in the Asset Library.
                </p>
            </div>

            {/* ── Create new tag ─────────────────── */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <p className="text-sm font-medium text-foreground">New Tag</p>
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-lg border border-border shrink-0 cursor-pointer"
                        style={{ backgroundColor: newColor }}
                        title="Selected color"
                    />
                    <Input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Tag name..."
                        className="flex-1"
                        onKeyDown={e => e.key === "Enter" && handleCreate()}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={creating || !newName.trim()}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                            "bg-primary text-primary-foreground hover:bg-primary/90",
                            (creating || !newName.trim()) && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Add
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setNewColor(c)}
                            className={cn(
                                "w-7 h-7 rounded-md border-2 transition-all",
                                newColor === c ? "border-white scale-110" : "border-transparent hover:border-white/40"
                            )}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            </div>

            {/* ── Tag list ───────────────────────── */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : tags.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                    No tags yet. Create one above to get started.
                </div>
            ) : (
                <div className="space-y-2">
                    {tags.map(tag => (
                        <div
                            key={tag.id}
                            className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 group"
                        >
                            {editId === tag.id ? (
                                /* ── Editing ── */
                                <>
                                    <div className="flex flex-wrap gap-1.5 shrink-0">
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setEditColor(c)}
                                                className={cn(
                                                    "w-5 h-5 rounded border transition-all",
                                                    editColor === c ? "border-white scale-110" : "border-transparent hover:border-white/40"
                                                )}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                    <Input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="flex-1 h-8 text-sm"
                                        onKeyDown={e => e.key === "Enter" && handleUpdate(tag.id)}
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => handleUpdate(tag.id)}
                                        className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setEditId(null)}
                                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                /* ── Display ── */
                                <>
                                    <div
                                        className="w-4 h-4 rounded-full shrink-0"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                    <span className="flex-1 text-sm font-medium text-foreground">{tag.name}</span>
                                    <button
                                        onClick={() => startEdit(tag)}
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                                        title="Edit tag"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(tag.id)}
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete tag"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
