'use client'

import { useState, useTransition, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    getCompanyContext, saveCompanyContext,
    getDefaultLinks, saveDefaultLinks,
    getCustomLinks, saveCustomLinks,
    type AudienceContext, type Brand, type DefaultLinks, type CustomLink
} from '@/app/actions/settings'

export function SettingsForm() {
    // Company context
    const [context, setContext] = useState('')
    const [contextLoading, setContextLoading] = useState(true)

    // Default links
    const [links, setLinks] = useState<DefaultLinks>({
        unsubscribe_url: '',
        privacy_url: '',
        contact_url: '',
        about_url: '',
        shipping_url: '',
        main_cta_url: '',
        main_activate_url: '',
        crowdfunding_cta_url: '',
        homepage_url: '',
    })
    const [linksLoading, setLinksLoading] = useState(true)

    // Custom links
    const [customLinks, setCustomLinks] = useState<CustomLink[]>([])
    const [customLinksLoading, setCustomLinksLoading] = useState(true)

    const [isPending, startTransition] = useTransition()
    const [saved, setSaved] = useState(false)

    // Audience / brand selectors
    const [audience, setAudience] = useState<AudienceContext>('dreamplay')
    const [brand, setBrand] = useState<Brand>('dreamplay')

    // Load data
    useEffect(() => {
        const load = async () => {
            setContextLoading(true)
            setLinksLoading(true)
            setCustomLinksLoading(true)

            const [ctx, lnks, cLinks] = await Promise.all([
                getCompanyContext(audience),
                getDefaultLinks(brand),
                getCustomLinks(brand),
            ])

            setContext(ctx)
            setLinks(lnks)
            setCustomLinks(cLinks)
            setContextLoading(false)
            setLinksLoading(false)
            setCustomLinksLoading(false)
        }
        load()
    }, [audience, brand])

    const handleSave = () => {
        startTransition(async () => {
            await Promise.all([
                saveCompanyContext(audience, context),
                saveDefaultLinks(brand, links),
                saveCustomLinks(brand, customLinks),
            ])
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        })
    }

    const updateLink = (key: keyof DefaultLinks, value: string) => {
        setLinks(prev => ({ ...prev, [key]: value }))
    }

    const addCustomLink = () => {
        setCustomLinks(prev => [...prev, { label: '', url: '' }])
    }

    const updateCustomLink = (index: number, field: keyof CustomLink, value: string) => {
        setCustomLinks(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], [field]: value }
            return updated
        })
    }

    const removeCustomLink = (index: number) => {
        setCustomLinks(prev => prev.filter((_, i) => i !== index))
    }

    const linkFields: { key: keyof DefaultLinks; label: string; placeholder: string }[] = [
        { key: 'homepage_url', label: 'Homepage URL', placeholder: 'https://dreamplay.example.com' },
        { key: 'main_cta_url', label: 'Main CTA URL', placeholder: 'https://...' },
        { key: 'main_activate_url', label: 'Activate URL', placeholder: 'https://...' },
        { key: 'crowdfunding_cta_url', label: 'Crowdfunding CTA URL', placeholder: 'https://...' },
        { key: 'unsubscribe_url', label: 'Unsubscribe URL', placeholder: 'https://...' },
        { key: 'privacy_url', label: 'Privacy Policy URL', placeholder: 'https://...' },
        { key: 'contact_url', label: 'Contact URL', placeholder: 'https://...' },
        { key: 'about_url', label: 'About URL', placeholder: 'https://...' },
        { key: 'shipping_url', label: 'Shipping URL', placeholder: 'https://...' },
    ]

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Audience/Brand Selectors */}
            <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                    <Label>Audience Context</Label>
                    <div className="flex gap-2">
                        {(['dreamplay', 'musicalbasics', 'crossover'] as AudienceContext[]).map(a => (
                            <button
                                key={a}
                                onClick={() => setAudience(a)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${audience === a
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                            >
                                {a}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-2 flex-1">
                    <Label>Brand (Links)</Label>
                    <div className="flex gap-2">
                        {(['dreamplay', 'musicalbasics'] as Brand[]).map(b => (
                            <button
                                key={b}
                                onClick={() => setBrand(b)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${brand === b
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                            >
                                {b}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Company Context */}
            <Card>
                <CardHeader>
                    <CardTitle>AI Copilot Context</CardTitle>
                    <CardDescription>
                        This context is sent to the AI copilot when generating blog posts.
                        Describe your brand voice, target audience, and key messaging.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {contextLoading ? (
                        <div className="h-32 flex items-center justify-center text-muted-foreground">Loading...</div>
                    ) : (
                        <Textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="Describe your company, brand voice, target audience..."
                            rows={8}
                            className="font-mono text-sm"
                        />
                    )}
                </CardContent>
            </Card>

            {/* Default Links */}
            <Card>
                <CardHeader>
                    <CardTitle>Default Links</CardTitle>
                    <CardDescription>
                        These URLs are used as defaults when the AI copilot generates blog posts with CTAs.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {linksLoading ? (
                        <div className="h-32 flex items-center justify-center text-muted-foreground">Loading...</div>
                    ) : (
                        linkFields.map(({ key, label, placeholder }) => (
                            <div key={key} className="space-y-2">
                                <Label htmlFor={key}>{label}</Label>
                                <Input
                                    id={key}
                                    type="url"
                                    value={links[key]}
                                    onChange={(e) => updateLink(key, e.target.value)}
                                    placeholder={placeholder}
                                    className="font-mono text-sm"
                                />
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Custom Links */}
            <Card>
                <CardHeader>
                    <CardTitle>Custom Links</CardTitle>
                    <CardDescription>
                        Add any additional links that should be available to the AI copilot.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {customLinksLoading ? (
                        <div className="h-16 flex items-center justify-center text-muted-foreground">Loading...</div>
                    ) : (
                        <>
                            {customLinks.map((link, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <Input
                                        value={link.label}
                                        onChange={(e) => updateCustomLink(i, 'label', e.target.value)}
                                        placeholder="Label"
                                        className="flex-1 text-sm"
                                    />
                                    <Input
                                        value={link.url}
                                        onChange={(e) => updateCustomLink(i, 'url', e.target.value)}
                                        placeholder="https://..."
                                        className="flex-[2] font-mono text-sm"
                                    />
                                    <button
                                        onClick={() => removeCustomLink(i)}
                                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={addCustomLink}
                                className="text-xs text-primary hover:underline"
                            >
                                + Add custom link
                            </button>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : saved ? (
                        <>
                            <Check className="mr-2 h-4 w-4" />
                            Saved
                        </>
                    ) : (
                        'Save Settings'
                    )}
                </Button>
                {saved && (
                    <span className="text-sm text-green-400">Settings saved successfully!</span>
                )}
            </div>
        </div>
    )
}
