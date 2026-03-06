import type {
  EmailBlock, EmailDesign, HeadingProps, TextProps, ImageProps,
  ButtonProps, DividerProps, SpacerProps, SocialProps
} from './types'

// ============================================================
// Blog HTML Compiler
// Converts EmailBlock[] → modern HTML5 (divs, flexbox, inline styles)
// ============================================================

const SOCIAL_ICONS: Record<string, { label: string; color: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  twitter: { label: 'Twitter', color: '#1DA1F2' },
  youtube: { label: 'YouTube', color: '#FF0000' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  tiktok: { label: 'TikTok', color: '#000000' },
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// --- Individual Block Compilers ---

function compileHeading(props: HeadingProps): string {
  const tag = props.level || 'h1'
  const sizes: Record<string, string> = { h1: '28px', h2: '22px', h3: '18px' }
  return `
<div style="padding: 10px 20px; text-align: ${props.alignment};">
  <${tag} style="margin: 0; font-size: ${sizes[tag]}; color: ${props.color}; font-family: ${props.fontFamily}; font-weight: bold;">
    ${props.text}
  </${tag}>
</div>`
}

function compileText(props: TextProps): string {
  const htmlText = props.text.replace(/\n/g, '<br>')
  return `
<div style="padding: 10px 20px; font-size: ${props.fontSize}px; line-height: ${props.lineHeight}; color: ${props.color}; font-family: Arial, Helvetica, sans-serif; text-align: ${props.alignment};">
  ${htmlText}
</div>`
}

function compileImage(props: ImageProps): string {
  const widthStyle = props.width ? `width: ${props.width}px;` : 'width: 100%;'
  const heightStyle = props.height === 'auto' ? 'height: auto;' : `height: ${props.height}px;`
  const imgTag = `<img src="${props.src}" alt="${escapeHtml(props.alt)}" style="display: block; max-width: 100%; ${widthStyle} ${heightStyle} border: 0; outline: none;" />`
  const content = props.linkUrl ? `<a href="${props.linkUrl}" target="_blank" style="display: inline-block;">${imgTag}</a>` : imgTag

  return `
<div style="padding: 0; text-align: ${props.alignment};">
  ${content}
</div>`
}

function compileButton(props: ButtonProps): string {
  const widthStyle = props.fullWidth ? 'display: block; width: 100%;' : 'display: inline-block;'
  return `
<div style="padding: 10px 20px; text-align: ${props.alignment};">
  <a href="${props.url}" target="_blank" style="${widthStyle} padding: ${props.paddingY}px ${props.paddingX}px; background-color: ${props.bgColor}; color: ${props.textColor}; font-family: Arial, Helvetica, sans-serif; font-size: ${props.fontSize}px; font-weight: bold; text-decoration: none; text-align: center; border-radius: ${props.borderRadius}px;">
    ${escapeHtml(props.text)}
  </a>
</div>`
}

function compileDivider(props: DividerProps): string {
  return `
<div style="padding: 10px 20px; text-align: center;">
  <hr style="border: none; border-top: ${props.thickness}px ${props.style} ${props.color}; width: ${props.widthPercent}%; margin: 0 auto;" />
</div>`
}

function compileSpacer(props: SpacerProps): string {
  return `<div style="height: ${props.height}px;"></div>`
}

function compileSocial(props: SocialProps): string {
  const icons = props.networks.map(n => {
    const info = SOCIAL_ICONS[n.platform] || { label: n.platform, color: '#333' }
    return `<a href="${n.url}" target="_blank" style="text-decoration: none; display: inline-block; margin: 0 6px;">
      <span style="display: inline-block; width: ${props.iconSize}px; height: ${props.iconSize}px; background-color: ${info.color}; border-radius: 50%; text-align: center; line-height: ${props.iconSize}px; color: #ffffff; font-size: ${Math.round(props.iconSize * 0.4)}px; font-family: Arial, sans-serif; font-weight: bold;">${info.label.charAt(0)}</span>
    </a>`
  }).join('\n')

  return `
<div style="padding: 10px 20px; text-align: ${props.alignment};">
  ${icons}
</div>`
}

// --- Main Compiler ---

function compileBlock(block: EmailBlock): string {
  switch (block.type) {
    case 'heading': return compileHeading(block.props as HeadingProps)
    case 'text': return compileText(block.props as TextProps)
    case 'image': return compileImage(block.props as ImageProps)
    case 'button': return compileButton(block.props as ButtonProps)
    case 'divider': return compileDivider(block.props as DividerProps)
    case 'spacer': return compileSpacer(block.props as SpacerProps)
    case 'social': return compileSocial(block.props as SocialProps)
    default: return `<!-- unknown block type: ${(block as any).type} -->`
  }
}

export function compileBlocksToHtml(blocks: EmailDesign): string {
  const bodyContent = blocks.map(compileBlock).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog Post</title>
  <style>
    /* Reset */
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
    a { color: inherit; }
    @media only screen and (max-width: 640px) {
      .blog-container { width: 100% !important; padding: 0 16px !important; }
      .blog-container img { width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 800px; margin: 0 auto; padding: 20px 0;">
    <article class="blog-container" style="max-width: 800px; margin: 0 auto; background-color: #ffffff;">
${bodyContent}
    </article>
  </div>
</body>
</html>`
}
