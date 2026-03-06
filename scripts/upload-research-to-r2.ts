/**
 * Bulk Upload Research PDFs to Cloudflare R2 + Supabase Metadata
 * 
 * Usage:
 *   pnpm tsx scripts/upload-research-to-r2.ts --dry-run              # Preview what would happen
 *   pnpm tsx scripts/upload-research-to-r2.ts --limit 5              # R2 upload only, first 5
 *   pnpm tsx scripts/upload-research-to-r2.ts --supabase --limit 5   # R2 + Supabase, first 5
 *   pnpm tsx scripts/upload-research-to-r2.ts --supabase             # R2 + Supabase, all
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"

// Load .env.local from the blog repo root
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

// ── CLI args ──────────────────────────────────────────────
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const doSupabase = args.includes("--supabase")
const limitIdx = args.indexOf("--limit")
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity

// ── R2 Client ─────────────────────────────────────────────
const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN!

// ── Supabase Client (only if --supabase flag) ─────────────
const supabase = doSupabase
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    )
    : null

// ── Manifest types ────────────────────────────────────────
interface ManifestSource {
    pdf_file: string
    pdf_path: string
    file_exists: boolean
    file_size_kb: number
    document_title: string
    authors: string
    year: string | null
    source_url: string
    source: string
    description: string
    batch: string
    download_status: string
}

interface Manifest {
    metadata: {
        generated: string
        total_entries: number
        batches: Record<string, { count: number; pdf_directory: string }>
    }
    sources: ManifestSource[]
}

// ── Check if object already exists in R2 ──────────────────
async function existsInR2(key: string): Promise<boolean> {
    try {
        await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
        return true
    } catch {
        return false
    }
}

// ── Insert metadata into Supabase ─────────────────────────
async function upsertToSupabase(source: ManifestSource, r2Key: string): Promise<boolean> {
    if (!supabase) return false

    // Check if row already exists by r2_key
    const { data: existing } = await supabase
        .from("research_knowledgebase")
        .select("id")
        .eq("r2_key", r2Key)
        .maybeSingle()

    if (existing) {
        console.log(`  📋 DB EXISTS: ${r2Key}`)
        return true
    }

    const { error } = await supabase
        .from("research_knowledgebase")
        .insert({
            title: source.document_title,
            author: Array.isArray(source.authors)
                ? source.authors.join(", ")
                : source.authors || null,
            year: source.year || null,
            url: source.source_url || null,
            source: source.source || null,
            description: source.description || null,
            content: "",            // filled later by Phase 3 (PDF extraction)
            is_active: false,       // don't inject into AI prompt yet
            r2_key: r2Key,
            file_size_kb: source.file_size_kb || null,
            batch: source.batch,
            download_status: source.download_status,
        })

    if (error) {
        console.error(`  ❌ DB ERROR: ${error.message}`)
        return false
    }

    console.log(`  📋 DB INSERTED: ${source.document_title}`)
    return true
}

// ── Process a single source ───────────────────────────────
type Result = "uploaded" | "skipped" | "exists" | "failed"

async function processOne(source: ManifestSource): Promise<{ r2: Result; db: "inserted" | "exists" | "skipped" | "failed" }> {
    const r2Key = `pdfs/research/${source.batch}/${source.pdf_file}`

    // Skip if no local file
    if (!source.file_exists) {
        console.log(`  ⏭️  SKIP (no file): ${source.document_title}`)
        return { r2: "skipped", db: "skipped" }
    }

    // Skip failed downloads
    if (source.download_status === "failed") {
        console.log(`  ⏭️  SKIP (failed download): ${source.document_title}`)
        return { r2: "skipped", db: "skipped" }
    }

    // Verify file actually exists on disk
    if (!fs.existsSync(source.pdf_path)) {
        console.log(`  ❌ FILE NOT FOUND: ${source.pdf_path}`)
        return { r2: "failed", db: "skipped" }
    }

    if (isDryRun) {
        const sizeMb = (source.file_size_kb / 1024).toFixed(2)
        console.log(`  📄 WOULD UPLOAD: ${r2Key} (${sizeMb} MB)`)
        if (doSupabase) console.log(`  📋 WOULD INSERT: ${source.document_title}`)
        return { r2: "uploaded", db: doSupabase ? "inserted" : "skipped" }
    }

    // ── R2 Upload ──
    let r2Result: Result
    const alreadyInR2 = await existsInR2(r2Key)
    if (alreadyInR2) {
        console.log(`  ✅ R2 EXISTS: ${r2Key}`)
        r2Result = "exists"
    } else {
        try {
            const fileBuffer = fs.readFileSync(source.pdf_path)
            await r2Client.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: r2Key,
                Body: fileBuffer,
                ContentType: "application/pdf",
            }))
            console.log(`  ✅ R2 UPLOADED: ${r2Key}`)
            r2Result = "uploaded"
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`  ❌ R2 FAILED: ${msg}`)
            return { r2: "failed", db: "skipped" }
        }
    }

    // ── Supabase Insert ──
    let dbResult: "inserted" | "exists" | "skipped" | "failed" = "skipped"
    if (doSupabase) {
        const ok = await upsertToSupabase(source, r2Key)
        dbResult = ok ? "inserted" : "failed"
        // If the row already existed, upsertToSupabase logs it — refine the result
        if (ok) {
            const { data: check } = await supabase!
                .from("research_knowledgebase")
                .select("id")
                .eq("r2_key", r2Key)
                .maybeSingle()
            dbResult = check ? "inserted" : "failed"
        }
    }

    return { r2: r2Result, db: dbResult }
}

// ── Main ──────────────────────────────────────────────────
async function main() {
    // Load manifest
    const manifestPath = path.resolve(__dirname, "../../upload_manifest.json")
    if (!fs.existsSync(manifestPath)) {
        console.error(`❌ Manifest not found at: ${manifestPath}`)
        process.exit(1)
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    console.log(`\n📦 Manifest loaded: ${manifest.metadata.total_entries} total entries`)
    console.log(`   Batch 1: ${manifest.metadata.batches.batch1.count} | Batch 2: ${manifest.metadata.batches.batch2.count}`)

    if (isDryRun) console.log(`\n🔍 DRY RUN — nothing will be written\n`)
    if (doSupabase) console.log(`🗄️  Supabase mode ON — will insert metadata\n`)
    if (limit < Infinity) console.log(`📏 Limit: ${limit} file(s)\n`)

    // Filter eligible sources
    const eligible = manifest.sources
        .filter(s => s.file_exists && s.download_status !== "failed")
        .slice(0, limit)

    console.log(`📋 Eligible: ${eligible.length} files\n`)

    // Process sequentially
    const r2Results = { uploaded: 0, skipped: 0, exists: 0, failed: 0 }
    const dbResults = { inserted: 0, exists: 0, skipped: 0, failed: 0 }

    for (let i = 0; i < eligible.length; i++) {
        const source = eligible[i]
        console.log(`[${i + 1}/${eligible.length}] ${source.document_title}`)
        const { r2, db } = await processOne(source)
        r2Results[r2]++
        dbResults[db]++
    }

    // Summary
    console.log(`\n${"─".repeat(50)}`)
    console.log(`📊 R2 Summary:`)
    console.log(`   ✅ Uploaded: ${r2Results.uploaded}`)
    console.log(`   📁 Already existed: ${r2Results.exists}`)
    console.log(`   ⏭️  Skipped: ${r2Results.skipped}`)
    console.log(`   ❌ Failed: ${r2Results.failed}`)

    if (doSupabase) {
        console.log(`\n📊 Supabase Summary:`)
        console.log(`   📋 Inserted: ${dbResults.inserted}`)
        console.log(`   📁 Already existed: ${dbResults.exists}`)
        console.log(`   ⏭️  Skipped: ${dbResults.skipped}`)
        console.log(`   ❌ Failed: ${dbResults.failed}`)
    }

    console.log(`${"─".repeat(50)}\n`)
}

main().catch(err => {
    console.error("Fatal error:", err)
    process.exit(1)
})
