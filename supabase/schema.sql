-- DreamPlay Blog Schema
-- Run this in your Supabase SQL Editor (same DB as emailer)

CREATE TABLE IF NOT EXISTS posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  excerpt text,
  category text DEFAULT 'tutorials',
  featured_image text,
  html_content text,
  variable_values jsonb DEFAULT '{}'::jsonb,
  status text CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Replaces campaign_versions for the History Sheet
CREATE TABLE IF NOT EXISTS post_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  html_content text NOT NULL,
  prompt text,
  created_at timestamptz DEFAULT now()
);

-- AI Knowledgebase for research papers (PDF-to-Markdown)
CREATE TABLE IF NOT EXISTS research_knowledgebase (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  author text,
  year text,
  url text,
  content text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE research_knowledgebase ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access" ON research_knowledgebase FOR ALL TO authenticated USING (true);
