"use server"

import { createClient } from "@/lib/supabase/server"

export async function saveVersion(postId: string, html: string, prompt: string) {
    const supabase = await createClient()
    await supabase.from('post_versions').insert({
        post_id: postId,
        html_content: html,
        prompt: prompt
    })
}

export async function getVersions(postId: string) {
    const supabase = await createClient()
    const { data } = await supabase
        .from('post_versions')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
    return data
}
