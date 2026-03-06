import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const mode = formData.get("mode") as "code" | "image" | "pdf";
        const code = formData.get("code") as string;
        const file = formData.get("file") as File;

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

        const prompt = `You are an expert Frontend Developer & UI/UX Designer.
Your task is to analyze the provided reference material and extract a highly polished, reusable HTML & CSS Blog Template.

REQUIREMENTS:
1. Output a complete, valid HTML5 document (<!DOCTYPE html>...</html>).
2. Embed all CSS inside a <style> block in the <head>. Import any necessary Google Fonts.
3. Extract the exact color palette, typography, spacing, and component styles (quotes, stats, grids, buttons) from the reference.
4. Use placeholder text (e.g., "Heading Goes Here", "Lorem ipsum...") for the content. Do NOT write a real article.
5. Create placeholders for images using <img src="https://image.pollinations.ai/prompt/Placeholder?width=800&height=400&nologo=true" />.
6. Return ONLY the raw HTML code. Do not wrap it in markdown backticks like \`\`\`html.

CRITICAL CSS RULES:
7. **NO VIEWPORT UNITS for sizing:** NEVER use vh, vw, svh, dvh, or any viewport-relative unit for width, height, min-height, or max-height. These templates will be rendered inside narrow containers and iframes where viewport units produce wildly wrong results.
   - For hero/header sections, use \`aspect-ratio\` (e.g., \`aspect-ratio: 2.2 / 1\`) combined with \`max-height\` in pixels.
   - For full-width sections, use percentage widths or \`max-width\` in pixels.
8. **IMAGE CONTAINMENT:** All images must stay within their container. Use \`max-width: 100%; height: auto;\` on all images. Do NOT use \`width: 100vw\` or \`margin-left: 50%; transform: translateX(-50%)\` breakout patterns. Keep images within the content flow.
9. **RESPONSIVE DESIGN:** Use \`clamp()\`, \`min()\`, percentage-based widths, and \`aspect-ratio\` for responsive layouts. Media queries are fine for breakpoints, but the size values inside them must also follow rule #7.`;

        const contents: any[] = [{ role: "user", parts: [] }];

        if (mode === "code") {
            contents[0].parts.push({ text: `Here is the reference code:\n\n${code}\n\n${prompt}` });
        } else if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString("base64");
            contents[0].parts.push({ inlineData: { data: base64Data, mimeType: file.type } });
            contents[0].parts.push({ text: prompt });
        } else {
            return NextResponse.json({ error: "Missing input data" }, { status: 400 });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: contents,
            config: { temperature: 0 }
        });

        let html = response.text || "";
        // Clean up markdown block wrapping if Gemini includes it
        if (html.startsWith("```html")) html = html.replace(/^```html\n/, "").replace(/\n```$/, "");
        else if (html.startsWith("```")) html = html.replace(/^```\n/, "").replace(/\n```$/, "");

        return NextResponse.json({ html: html.trim() });

    } catch (error: any) {
        console.error("Theme Analyzer Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
