import pg from "pg"
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"

const { Pool } = pg

/**
 * V2 LangGraph Checkpointer for Blog Repo
 * Shared v2_ai_schema — tables pre-provisioned, no setup().
 */

let _pool: pg.Pool | null = null

function getPool(): pg.Pool {
    if (!_pool) {
        const connString = process.env.SUPABASE_DB_URL
        if (!connString) throw new Error("SUPABASE_DB_URL is not set.")
        _pool = new Pool({ connectionString: connString })
    }
    return _pool
}

export function getCheckpointer(): PostgresSaver {
    const pool = getPool()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PostgresSaver(pool as any, undefined, { schema: "v2_ai_schema" })
}
