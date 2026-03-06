"use server"

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

function getSupabase() {
    return createClient(supabaseUrl, supabaseServiceKey)
}

export async function getThemes() {
    const supabase = getSupabase()
    const { data } = await supabase.from("blog_themes").select("*").order("created_at", { ascending: false })
    return data || []
}

export async function saveTheme(name: string, html_template: string) {
    const supabase = getSupabase()
    const { error } = await supabase.from("blog_themes").insert([{ name, html_template }])
    if (error) throw new Error(error.message)
    return { success: true }
}

export async function deleteTheme(id: string) {
    const supabase = getSupabase()
    await supabase.from("blog_themes").delete().eq("id", id)
}

export async function updateTheme(id: string, updates: { name?: string; html_template?: string }) {
    const supabase = getSupabase()
    const { error } = await supabase.from("blog_themes").update(updates).eq("id", id)
    if (error) throw new Error(error.message)
    return { success: true }
}
