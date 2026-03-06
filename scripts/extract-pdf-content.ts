/**
 * Extract PDF content from R2 and update research_knowledgebase
 * 
 * Usage:
 *   pnpm tsx scripts/extract-pdf-content.ts --limit 1     # Extract 1 PDF
 *   pnpm tsx scripts/extract-pdf-content.ts --dry-run      # Preview which PDFs need extraction
 */

import { createClient } from "@supabase/supabase-js"
import { GoogleGenAI } from "@google/genai"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

// ── CLI args ──────────────────────────────────────────────
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const limitIdx = args.indexOf("--limit")
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity

// ── Clients ───────────────────────────────────────────────
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN!

// ── Load manifest for local PDF paths ─────────────────────
interface ManifestSource {
    pdf_file: string
    pdf_path: string
    file_exists: boolean
    batch: string
}

interface Manifest {
    sources: ManifestSource[]
}

const manifestPath = path.resolve(__dirname, "../../upload_manifest.json")
const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))

// Build a lookup: r2_key → local pdf_path
const localPathMap = new Map<string, string>()
for (const s of manifest.sources) {
    if (s.file_exists) {
        const r2Key = `pdfs/research/${s.batch}/${s.pdf_file}`
        localPathMap.set(r2Key, s.pdf_path)
    }
}

// ── Extract PDF via Gemini ────────────────────────────────
async function extractPdfContent(pdfBuffer: Buffer, title: string): Promise<{
    markdown: string
    author: string | null
    year: string | null
} | null> {
    try {
        const base64Data = pdfBuffer.toString("base64")

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: "application/pdf"
                            }
                        },
                        {
                            text: `Extract the complete text of this document and convert it into highly readable Markdown.

Rules:
1. Preserve all statistics, quotes, headings, and data accurately.
2. Remove any page numbers, headers, footers, or irrelevant publishing stamps.
3. Do not include introductory conversational text — just output the raw Markdown.

After the Markdown content, add a metadata block at the very end in this exact format:
---METADATA---
AUTHOR: [author name(s), comma-separated, or "unknown" if not found]
YEAR: [publication year as 4 digits, or "unknown" if not found]

The document title is: "${title}"`
                        }
                    ]
                }
            ]
        })

        let text = response.text || ""

        // Parse out metadata
        let author: string | null = null
        let year: string | null = null

        const metadataMatch = text.match(/---METADATA---\s*\n\s*AUTHOR:\s*(.+)\s*\n\s*YEAR:\s*(.+)/i)
        if (metadataMatch) {
            const rawAuthor = metadataMatch[1].trim()
            const rawYear = metadataMatch[2].trim()
            if (rawAuthor && rawAuthor.toLowerCase() !== "unknown") author = rawAuthor
            if (rawYear && rawYear.toLowerCase() !== "unknown" && /^\d{4}$/.test(rawYear)) year = rawYear

            // Remove metadata block from markdown
            text = text.replace(/---METADATA---[\s\S]*$/, "").trim()
        }

        // Clean markdown fences
        if (text.startsWith("```markdown")) {
            text = text.replace(/^```markdown\n/, "").replace(/\n```$/, "")
        } else if (text.startsWith("```")) {
            text = text.replace(/^```\n/, "").replace(/\n```$/, "")
        }

        return { markdown: text.trim(), author, year }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  ❌ Gemini error: ${msg}`)
        return null
    }
}

// ── Main ──────────────────────────────────────────────────
async function main() {
    // Query entries needing extraction
    const { data: entries, error } = await supabase
        .from("research_knowledgebase")
        .select("id, title, author, year, r2_key, content")
        .not("r2_key", "is", null)
        .or("content.is.null,content.eq.")
        .order("created_at", { ascending: true })
        .limit(limit)

    if (error) {
        console.error("❌ Supabase query error:", error.message)
        process.exit(1)
    }

    if (!entries || entries.length === 0) {
        console.log("✅ No entries need extraction!")
        return
    }

    console.log(`\n📄 Found ${entries.length} entries needing extraction\n`)

    if (isDryRun) {
        for (const entry of entries) {
            console.log(`  📋 ${entry.title} (${entry.r2_key})`)
        }
        console.log(`\n🔍 DRY RUN — no extractions performed\n`)
        return
    }

    let extracted = 0
    let failed = 0

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        console.log(`[${i + 1}/${entries.length}] ${entry.title}`)

        // Try local file first (faster, no download needed)
        const localPath = localPathMap.get(entry.r2_key)
        let pdfBuffer: Buffer | null = null

        if (localPath && fs.existsSync(localPath)) {
            console.log(`  📂 Reading local file: ${localPath}`)
            pdfBuffer = fs.readFileSync(localPath)
        } else {
            // Download from R2
            const url = `${PUBLIC_DOMAIN}/${entry.r2_key}`
            console.log(`  ⬇️  Downloading from R2: ${url}`)
            try {
                const res = await fetch(url)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                pdfBuffer = Buffer.from(await res.arrayBuffer())
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err)
                console.error(`  ❌ Download failed: ${msg}`)
                failed++
                continue
            }
        }

        // Extract with Gemini
        console.log(`  🤖 Extracting with Gemini (this may take ~15-30s)...`)
        const result = await extractPdfContent(pdfBuffer, entry.title)

        if (!result || !result.markdown) {
            console.error(`  ❌ Extraction failed or returned empty`)
            failed++
            continue
        }

        // Build update object
        const update: Record<string, unknown> = {
            content: result.markdown,
            updated_at: new Date().toISOString(),
        }

        // Only update author/year if currently missing and Gemini found them
        if ((!entry.author || entry.author === "") && result.author) {
            update.author = result.author
            console.log(`  👤 Author detected: ${result.author}`)
        }
        if ((!entry.year || entry.year === "") && result.year) {
            update.year = result.year
            console.log(`  📅 Year detected: ${result.year}`)
        }

        // Update Supabase
        const { error: updateError } = await supabase
            .from("research_knowledgebase")
            .update(update)
            .eq("id", entry.id)

        if (updateError) {
            console.error(`  ❌ DB update failed: ${updateError.message}`)
            failed++
            continue
        }

        const contentPreview = result.markdown.substring(0, 100).replace(/\n/g, " ")
        console.log(`  ✅ Extracted ${result.markdown.length} chars`)
        console.log(`  📝 Preview: ${contentPreview}...`)
        extracted++
    }

    // Summary
    console.log(`\n${"─".repeat(50)}`)
    console.log(`📊 Extraction Summary:`)
    console.log(`   ✅ Extracted: ${extracted}`)
    console.log(`   ❌ Failed: ${failed}`)
    console.log(`${"─".repeat(50)}\n`)
}

main().catch(err => {
    console.error("Fatal error:", err)
    process.exit(1)
})
