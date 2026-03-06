import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getAllContextForAudience, formatContextForPrompt } from "@/app/actions/settings";

// Initialize Admin Client (Service Key) to bypass RLS if needed
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Robust JSON extractor: finds the first '{' and last '}' to ignore chatty text
function extractJson(text: string) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        return text.substring(start, end + 1);
    }
    return text; // Fallback
}

// Fallback: manually extract updatedHtml and explanation when JSON.parse fails
// This handles cases where the AI generates valid HTML but with characters that break JSON parsing
function manualExtractClassic(raw: string): { updatedHtml: string; explanation: string; suggestedAssets?: Record<string, string>; suggestedThumbnail?: string } | null {
    try {
        const htmlMatch = raw.match(/"updatedHtml"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"[a-zA-Z_]|\}$)/);
        let html = '';
        if (htmlMatch) {
            html = htmlMatch[1]
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
        } else {
            const docMatch = raw.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/i);
            if (docMatch) html = docMatch[1];
        }
        if (!html) return null;

        const expMatch = raw.match(/"explanation"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
        const explanation = expMatch
            ? expMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
            : "Changes applied successfully.";

        // NEW: Extract suggested assets if available
        let suggestedAssets = {};
        const assetsMatch = raw.match(/"suggestedAssets"\s*:\s*({[^{}]*})/);
        if (assetsMatch) {
            try { suggestedAssets = JSON.parse(assetsMatch[1]); } catch { }
        }

        // NEW: Extract suggested thumbnail if available
        let suggestedThumbnail: string | undefined;
        const thumbMatch = raw.match(/"suggestedThumbnail"\s*:\s*"([^"]+)"/);
        if (thumbMatch) {
            suggestedThumbnail = thumbMatch[1];
        }

        return { updatedHtml: html, explanation, suggestedAssets, suggestedThumbnail };
    } catch {
        return null;
    }
}

// Helper: Download image from URL and convert to Base64
async function urlToBase64(url: string) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mediaType = response.headers.get('content-type') || 'image/jpeg';
        return { base64, mediaType };
    } catch (e) {
        console.error("Image fetch failed", e);
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const { currentHtml, messages, model, audienceContext = "dreamplay", aiDossier: clientDossier = "", modelLow, modelMedium, imageMode = "library", themeHtml, hasThumbnail = false } = await req.json();

        // User-designated tier models (fallback to defaults)
        const tierLow = modelLow || "claude-haiku-4-5-20251001";
        const tierMedium = modelMedium || "claude-sonnet-4-6";

        // --- SMART ROUTER LOGIC ---
        let actualModel = model;
        let routingReason = "";

        if (model === "auto") {
            const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
            const hasImages = lastUserMessage?.imageUrls?.length > 0;
            const isEmpty = !currentHtml || currentHtml.trim() === "";

            if (isEmpty) {
                // Empty canvas always needs the stronger model (building from scratch)
                actualModel = tierMedium;
                routingReason = `New template from scratch → Medium (${tierMedium}).`;
            } else if (hasImages) {
                // Images present — vision tasks need the stronger model
                actualModel = tierMedium;
                routingReason = `Vision task (screenshot reference) → Medium (${tierMedium}).`;
            } else {
                // Text-only: fast classification using Gemini Flash
                try {
                    const { GoogleGenerativeAI } = await import("@google/generative-ai");
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
                    const flash = genAI.getGenerativeModel({
                        model: "gemini-2.0-flash",
                        generationConfig: { maxOutputTokens: 10, temperature: 0 }
                    });

                    const routerPrompt = `You are a routing agent for an email editor.
User request: "${lastUserMessage?.content}"
Is this a simple edit (changing text, fixing a typo, updating a color, swapping a link) or a complex edit (creating new layouts, adding new sections, structural redesign)?
Reply ONLY with the exact word "SIMPLE" or "COMPLEX".`;

                    const routerResult = await flash.generateContent(routerPrompt);
                    const intent = routerResult.response.text().trim().toUpperCase();

                    if (intent.includes("COMPLEX")) {
                        actualModel = tierMedium;
                        routingReason = `Complex structural edit → Medium (${tierMedium}).`;
                    } else {
                        actualModel = tierLow;
                        routingReason = `Simple text/style edit → Low (${tierLow}).`;
                    }
                } catch (e) {
                    actualModel = tierMedium;
                    routingReason = `Router fallback → Medium (${tierMedium}).`;
                }
            }
            console.log(`[Smart Router] ${routingReason} (model: ${actualModel})`);
        }
        // ------------------------------

        // 1. FETCH AUDIENCE-DRIVEN CONTEXT ⚡️
        const payload = await getAllContextForAudience(audienceContext);
        const { contextBlock: dynamicContext, linksBlock: defaultLinksBlock } = await formatContextForPrompt(payload, audienceContext);

        // 2. FETCH KNOWLEDGEBASE (server-side) ⚡️
        let aiDossier = clientDossier;
        if (!aiDossier) {
            try {
                const { data: kbDocs } = await supabase
                    .from("research_knowledgebase")
                    .select("*")
                    .eq("is_active", true);
                if (kbDocs && kbDocs.length > 0) {
                    aiDossier = kbDocs.map((doc: any) => `--- SOURCE: ${doc.title} ${doc.author ? `(by ${doc.author})` : ''} ---\n${doc.content}`).join("\n\n");
                    console.log(`[Knowledgebase] Injected ${kbDocs.length} active research doc(s) into prompt`);
                }
            } catch (e) {
                console.error("[Knowledgebase] Failed to fetch:", e);
            }
        }

        // 3. BUILD DYNAMIC IMAGE INSTRUCTIONS ⚡️
        let imageContextBlock = "";
        let imageRuleBlock = `4. **IMAGE VARIABLES:** When adding images, the \`src\` attribute MUST use new {{mustache}} variables.`;

        if (imageMode === 'library') {
            const { getDescribedAssets } = await import("@/app/actions/assets");
            const library = await getDescribedAssets();
            if (library && library.length > 0) {
                const libraryText = library.map((img: any) => {
                    let line = `- URL: ${img.public_url}\n  Description: ${img.description}`;
                    if (img.tags && img.tags.length > 0) line += `\n  Tags: ${img.tags.join(", ")}`;
                    return line;
                }).join("\n\n");
                imageContextBlock = `\n### ASSET LIBRARY:\nYou have access to the following pre-uploaded images.\n${libraryText}\n`;
                imageRuleBlock = `4. **IMAGE HANDLING (LIBRARY MODE):** 
   - ALWAYS use {{mustache}} variables for the \`src\` attribute (e.g., \`<img src="{{hero_src}}" />\`). DO NOT hardcode URLs in the HTML.
   - INSTEAD, map the URLs to your variables in the \`suggestedAssets\` JSON object.
   - Read the descriptions in the ASSET LIBRARY below. If an image fits the context, map its exact URL to your mustache variable in \`suggestedAssets\`.
   - If NO image in the library fits, map a dynamic AI placeholder: \`https://image.pollinations.ai/prompt/{URL_ENCODED_PROMPT}?width=800&height=400&nologo=true\`.
   - ALWAYS wrap ANY image in a clickable link using a corresponding {{mustache_link_url}} variable.`;
            } else {
                imageRuleBlock = `4. **IMAGE HANDLING:** ALWAYS use {{mustache}} variables for the \`src\` attribute. DO NOT hardcode URLs in the HTML. In the \`suggestedAssets\` JSON object, map these variables to a dynamic AI placeholder: \`https://image.pollinations.ai/prompt/{URL_ENCODED_PROMPT}?width=800&height=400&nologo=true\`. ALWAYS wrap the image in a clickable link using a corresponding {{mustache_link_url}} variable.`;
            }
        } else if (imageMode === 'creative') {
            imageRuleBlock = `4. **IMAGE HANDLING (CREATIVE MODE):** Do NOT use existing images. ALWAYS use {{mustache}} variables for the \`src\` attribute. DO NOT hardcode URLs in the HTML. In the \`suggestedAssets\` JSON object, map these variables to a highly creative AI image placeholder using this exact format: \`https://image.pollinations.ai/prompt/{URL_ENCODED_PROMPT}?width=800&height=400&nologo=true\`. ALWAYS wrap the image in a clickable link using a corresponding {{mustache_link_url}} variable.`;
        }

        // 4. Process History: Convert ALL image URLs to Base64
        // We do this server-side so we don't hit the 4MB payload limit from the client.
        // We only keep the last 3 messages' images to save tokens/money, but we keep ALL text.
        const processedMessages = await Promise.all(messages.map(async (msg: any, index: number) => {
            const isRecent = index >= messages.length - 3; // Only keep images from last 3 messages

            let processedImages: any[] = [];

            if (isRecent && msg.imageUrls && msg.imageUrls.length > 0) {
                // Parallel download
                const downloads = await Promise.all(msg.imageUrls.map((url: string) => urlToBase64(url)));
                processedImages = downloads.filter(img => img !== null);
            }

            return {
                role: msg.role,
                content: msg.content,
                images: processedImages // Now contains { base64, mediaType }
            };
        }));

        const systemInstruction = `
    You are an expert Blog Post HTML Developer.
    The user will give you HTML and a request. You are building web blog posts, NOT emails.
    
    ### 🛑 CRITICAL INTEGRITY RULES:
    1. **NEVER DELETE CONTENT:** Unless explicitly asked to remove something, you must PRESERVE ALL existing sections, text, images, and structure. The user's screenshot may show only ONE section, but you MUST return the ENTIRE blog post.
    2. **ALWAYS RETURN THE COMPLETE HTML DOCUMENT** starting with <!DOCTYPE html> and ending with </html>. Include EVERY section from the original HTML, even if the user's edit only affects one small part. If you return partial HTML, the entire post will be overwritten and the user will lose their work.
    3. **EDITING TEXT = FULL HTML:** Even for small text changes, return the full HTML document with only the requested text modified and everything else preserved exactly.
    
    ### CODING STANDARDS:
    1. **LAYOUT:** Use modern HTML5 (<article>, <section>, <div>, <header>, <footer>). You can use semantic tags and CSS Flexbox/Grid. NO TABLE LAYOUTS!
    2. **RESPONSIVENESS:** Ensure sections stack gracefully on mobile devices using standard CSS classes or inline styles. Use max-width containers with auto margins.
    3. **VARIABLES:** Preserve {{mustache_vars}}.
    ${imageRuleBlock}
    5. **NO EM-DASHES:** Never use em-dashes (—) in any copy or text you write. Use commas, periods, or semicolons instead.
    6. **READABLE COPY FORMATTING:** When writing or editing paragraph text/copy, add sparse inline formatting to improve scannability. Use \`<strong>\` to bold 1-2 key value propositions or outcomes per paragraph (the phrases you want the reader to remember). Use \`<u>\` to underline one supporting detail or benefit phrase per paragraph. Don't overdo it: most sentences should remain unformatted. The goal is to let a skimming reader grasp the main points from the bold text alone.
    7. **TYPOGRAPHY:** Use modern web fonts (e.g. system-ui, -apple-system, or Google Fonts). Use good line-height (1.6-1.8 for body text). Use proper heading hierarchy.
    
    ### 🛑 STRICT FACT & QUOTE RULES:
    1. NEVER invent, fabricate, or hallucinate quotes, testimonials, or people.
    2. If you quote someone, use a case study, or tell a story, it MUST be extracted verbatim from the provided "AUDIENCE INTELLIGENCE" section (e.g., use the real stories of Christopher Donison, Eliana Yi, Josef Hofmann, etc.). DO NOT invent fake personas like "Sarah M." or "Hannah Tsai".
    3. Do NOT make up statistics. Use ONLY the exact data provided (e.g., 87.1% of adult females, University of North Texas). Do not conflate universities or researchers.
    4. If the AUDIENCE INTELLIGENCE section is empty or not provided, do NOT fabricate any quotes or case studies. Write general copy instead.
    
    ### TEMPLATE CREATION DEFAULTS:
    When asked to create a NEW blog post from scratch or from a reference image:
    - All text/copy MUST be hardcoded directly in the HTML (not mustache variables).
    - For images, follow the IMAGE HANDLING rule above (rule #4). DO NOT hardcode URLs in the HTML; put them in suggestedAssets.
    - All non-image links (href on <a> tags) MUST use {{mustache_variable}} names (e.g. {{cta_link_url}}, {{hero_link_url}}).
    ${!hasThumbnail ? `
    ### THUMBNAIL GENERATION:
    The blog post does NOT have a thumbnail/featured image yet. You MUST include a "suggestedThumbnail" field in your JSON response with a URL for the blog post thumbnail.
    - Follow the same image mode rules (library or creative) as for in-body images.
    - Choose the most visually striking, relevant image that represents the blog post topic.
    - The thumbnail should be landscape-oriented (roughly 16:9 or 3:2 ratio).
    - If using a Pollinations placeholder, request dimensions ?width=1200&height=630&nologo=true for optimal social sharing.
    ` : ''}
    
    ### RESPONSE FORMAT (STRICT JSON ONLY):
    You MUST return ONLY a valid JSON object. Do not include any conversational text before or after the JSON.
    {
      "_thoughts": "Think step-by-step about what needs to be changed. Explain your math or logic here before writing the code.",
      "explanation": "A brief, friendly summary of changes for the user interface",
      "suggestedAssets": {
        "hero_src": "https://library-or-pollinations-url...",
        "body_img_1": "https://..."
      },
      ${!hasThumbnail ? '"suggestedThumbnail": "https://image-url-for-blog-card-thumbnail...",' : ''}
      "updatedHtml": "<!DOCTYPE html>\n<html>...</html>"
    }
    
    ### CRITICAL: QUESTION vs EDIT DETECTION:
    If the user is asking a QUESTION, requesting SUGGESTIONS, brainstorming ideas, or anything that does NOT require modifying the HTML:
    - Set "updatedHtml" to the EXACT ORIGINAL HTML unchanged (copy it character-for-character)
    - Put your full answer/suggestions in the "explanation" field
    - Do NOT replace the HTML with text responses, lists, or suggestions
    Examples of questions (DO NOT modify HTML): "suggest post titles", "what do you think of this copy", "come up with alternatives", "how can I improve", "give me ideas"
    Examples of edits (DO modify HTML): "change the title to X", "make the button red", "add a new section"
    
    ### 🛑 CRITICAL OVERRIDE — BLOG POST GENERATION IS ALWAYS AN EDIT:
    If the user says anything like "make this into a blog post", "build this out", "create a blog post", "write the blog post", "turn this into a post", or references earlier conversational content and asks you to generate it as a blog post — this is ALWAYS an EDIT, even if the conversation so far has been entirely conversational.
    - You MUST generate a full HTML blog post in "updatedHtml"
    - Do NOT put the blog post content in the "explanation" field as plain text
    - If the current HTML is empty or blank, you are building from scratch — return a complete HTML document in "updatedHtml"
    - The "explanation" field should contain only a SHORT summary of what you built (e.g., "Created a blog post about X with Y sections")
    - When in doubt about whether to generate HTML or respond conversationally, ALWAYS generate HTML if the user mentions "blog post", "post", "article", or "build it out"
    
    ### COMPANY CONTEXT:
    ${dynamicContext}
    ${defaultLinksBlock}
${aiDossier ? `
    ### AUDIENCE INTELLIGENCE:
    ${aiDossier}
` : ""}
    ${imageContextBlock}
${themeHtml ? `
    ### MANDATORY DESIGN THEME:
    The user has selected a specific design theme. You MUST use the provided HTML and CSS structure below as the exact foundation for the new blog post.
    - Keep the CSS <style> block completely intact.
    - Preserve the DOM structure, typography classes, and colors. Do NOT invent your own styling.
    - Swap out the placeholder text for the actual blog post content you generate.
    - Duplicate or arrange the layout components (like cards or quotes) as needed to fit the article length.

    ### PROVIDED THEME SKELETON:
    ${themeHtml}
` : ""}
    `;

        let rawResponse = "";
        let usageMeta = { model: actualModel, inputTokens: 0, outputTokens: 0, cost: 0 };

        // Pricing per million tokens
        const PRICING: Record<string, { input: number; output: number }> = {
            "claude-3-5-haiku-latest": { input: 0.80, output: 4.00 },
            "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
            "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
            "claude-sonnet-4-6": { input: 3.00, output: 15.00 },
        };

        // --- A. CLAUDE (Anthropic) ---
        if (actualModel.includes("claude")) {
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

            const anthropicMessages = processedMessages.map((msg: any) => {
                const role = (msg.role === 'result' ? 'assistant' : 'user') as "assistant" | "user";
                let content: any[] = [];

                // Add Images & Documents (PDFs)
                if (msg.images) {
                    msg.images.forEach((img: any) => {
                        const isPdf = img.mediaType === 'application/pdf';
                        content.push({
                            type: isPdf ? "document" : "image",
                            source: {
                                type: "base64",
                                media_type: img.mediaType,
                                data: img.base64
                            }
                        });
                    });
                }

                // Add Text
                if (msg.content) content.push({ type: "text", text: msg.content });

                return { role, content };
            });

            // Append Context to Last Message
            const lastMsg = anthropicMessages[anthropicMessages.length - 1];
            if (lastMsg.role === 'user') {
                lastMsg.content.push({ type: "text", text: `\n\n### CURRENT HTML:\n${currentHtml}` });
            }

            const stream = anthropic.messages.stream({
                model: actualModel,
                max_tokens: 32768,
                temperature: 0,
                system: systemInstruction,
                messages: anthropicMessages
            });

            const msg = await stream.finalMessage();

            const textBlock = msg.content[0];
            if (textBlock.type === 'text') rawResponse = textBlock.text;

            // Track usage
            if (msg.usage) {
                usageMeta.inputTokens = msg.usage.input_tokens;
                usageMeta.outputTokens = msg.usage.output_tokens;
                const pricing = PRICING[actualModel] || { input: 3, output: 15 };
                usageMeta.cost = (msg.usage.input_tokens / 1_000_000 * pricing.input) + (msg.usage.output_tokens / 1_000_000 * pricing.output);
            }
        }

        // --- B. GEMINI (Google) ---
        else {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
            const geminiModel = genAI.getGenerativeModel({
                model: "gemini-1.5-pro",
                generationConfig: { responseMimeType: "application/json" }
            });

            const geminiHistory = processedMessages.map((msg: any) => {
                const role = msg.role === 'result' ? 'model' : 'user';
                const parts = [];

                if (msg.images) {
                    msg.images.forEach((img: any) => {
                        parts.push({
                            inlineData: {
                                mimeType: img.mediaType,
                                data: img.base64
                            }
                        });
                    });
                }

                if (msg.content) parts.push({ text: msg.content });
                return { role, parts };
            });

            const lastMsg = geminiHistory[geminiHistory.length - 1];
            lastMsg.parts.push({ text: `\n\n### CURRENT HTML:\n${currentHtml}` });

            // Inject system instruction into first message
            if (geminiHistory.length > 0) {
                const firstPart = geminiHistory[0].parts[0];
                if (firstPart.text) {
                    firstPart.text = `${systemInstruction}\n\n${firstPart.text}`;
                } else {
                    geminiHistory[0].parts.unshift({ text: systemInstruction });
                }
            }

            const result = await geminiModel.generateContent({ contents: geminiHistory });
            rawResponse = result.response.text();
        }

        // --- PARSE ---
        try {
            const cleaned = extractJson(rawResponse);
            const parsed = JSON.parse(cleaned);

            parsed.meta = usageMeta;

            if (routingReason) {
                parsed.explanation = `*(⚡️ ${routingReason})*\n\n` + (parsed.explanation || "");
            }

            return NextResponse.json(parsed);
        } catch (e: any) {
            console.error("JSON Parse Error:", e.message);
            console.error("Raw response preview (first 500 chars):", rawResponse.substring(0, 500));
            // Fallback: try to manually extract HTML and explanation
            const fallback = manualExtractClassic(rawResponse);
            if (fallback) {
                console.log("Recovered via manual extraction fallback");
                return NextResponse.json(fallback);
            }
            return NextResponse.json({
                updatedHtml: currentHtml,
                explanation: "I successfully generated the code, but my output formatting broke. Please try asking me again!"
            });
        }

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
