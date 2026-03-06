---
description: Bulk upload research PDFs to Cloudflare R2 and manage the research knowledgebase
---

# Bulk Upload Research PDFs

## Context
- 182 research sources (PDFs + metadata) across two batches
- Manifest file: `/Users/lionelyu/Documents/DreamPlay Repos/upload_manifest.json`
- PDF directories:
  - Batch 1 (73 PDFs): `/Users/lionelyu/Documents/DreamPlay Research 2026/citation_downloads/`
  - Batch 2 (109 PDFs): `/Users/lionelyu/Documents/DreamPlay Research 2026/citations2/`
- Full instructions: `/Users/lionelyu/Documents/DreamPlay Repos/BULK_UPLOAD_INSTRUCTIONS.md`

## Stack
- **Storage**: Cloudflare R2 (S3-compatible), bucket: `dreamplay-blog-assets`
- **R2 Key Pattern**: `pdfs/research/{batch}/{pdf_file}`
- **Public URL**: `https://pub-2908cd1cb16b4bc0b70e0e2f4b670e12.r2.dev/pdfs/research/{batch}/{pdf_file}`
- **Database**: Supabase (`research_knowledgebase` table for AI KB, `research_sources` table for bulk metadata)
- **App**: `dreamplay-blog` (Next.js)

## R2 Upload Script

Location: `dreamplay-blog/scripts/upload-research-to-r2.ts`

### Environment Variables Required (in `dreamplay-blog/.env.local`)
```
R2_ACCOUNT_ID=<cloudflare_account_id>
R2_ACCESS_KEY_ID=<r2_access_key>
R2_SECRET_ACCESS_KEY=<r2_secret_key>
R2_BUCKET_NAME=dreamplay-blog-assets
R2_PUBLIC_DOMAIN=https://pub-2908cd1cb16b4bc0b70e0e2f4b670e12.r2.dev
```

### Commands
```bash
# Preview what would be uploaded (no actual uploads)
// turbo
pnpm tsx scripts/upload-research-to-r2.ts --dry-run

# Upload only the first N PDFs (for testing)
pnpm tsx scripts/upload-research-to-r2.ts --limit 1

# Upload all eligible PDFs (skips already-uploaded files)
pnpm tsx scripts/upload-research-to-r2.ts
```

### Features
- **Dry-run mode** (`--dry-run`): Lists what would be uploaded
- **Limit** (`--limit N`): Upload only first N entries
- **Resume/dedup**: Checks if file already exists in R2 via HeadObject before uploading
- **Skips**: Entries with `file_exists: false` or `download_status: "failed"`

## Phase Status (as of 2026-03-01)
- ✅ **Phase 1**: All 172 PDFs uploaded to R2 (0 failures)
- ⬜ **Phase 2**: Supabase metadata insertion (create `research_sources` table, insert manifest data)
- ⬜ **Phase 3**: AI knowledgebase integration (connect to existing `research_knowledgebase`, PDF extraction via Gemini, auto-fill author/year)

## Existing Knowledgebase Code
- Server actions: `dreamplay-blog/app/actions/knowledgebase.ts`
- Admin UI: `dreamplay-blog/app/admin/knowledgebase/page.tsx`
- Table: `research_knowledgebase` (columns: id, title, author, year, url, content, is_active, created_at)
- Used by AI copilot routes: `app/api/copilot/route.ts`, `app/api/copilot-dnd/route.ts`
