"use client"

import Link from "next/link"
import { ArrowRight, Menu, X, ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const WEBSITE = "https://www.dreamplaypianos.com"

// --- Desktop Dropdown ---
function NavDropdown({ label, items, useDarkText }: { label: string; items: { label: string; href: string }[]; useDarkText: boolean }) {
    const [open, setOpen] = useState(false)
    return (
        <div
            className="relative h-full flex items-center"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                className={`flex items-center gap-1 text-sm transition-colors cursor-pointer ${useDarkText ? "text-neutral-700 hover:text-neutral-900" : "text-white/70 hover:text-white"}`}
            >
                {label}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            <div
                className={cn(
                    "absolute top-full right-0 mt-1 min-w-[180px] rounded-lg shadow-xl overflow-hidden transition-all duration-200 border",
                    useDarkText
                        ? "bg-white border-black/5 ring-1 ring-black/5"
                        : "bg-[#0a0a0f] border-white/10",
                    open ? "opacity-100 translate-y-0 visible" : "opacity-0 translate-y-2 invisible"
                )}
                style={{ zIndex: 100 }}
            >
                {items.map((item) => (
                    <a
                        key={item.label}
                        href={item.href}
                        className={`block px-4 py-3 text-sm transition-colors ${useDarkText
                            ? "text-gray-600 hover:text-black hover:bg-black/5"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {item.label}
                    </a>
                ))}
            </div>
        </div>
    )
}

// --- Mobile Dropdown ---
function MobileDropdownSection({ label, items, onClose }: { label: string; items: { label: string; href: string }[]; onClose: () => void }) {
    return (
        <>
            <div className="border-t border-gray-200 my-2" />
            <div className="px-1 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
            {items.map((item) => (
                <a
                    key={item.label}
                    href={item.href}
                    className="py-3 pl-3 text-neutral-600 hover:text-black font-medium border-b border-gray-50"
                    onClick={onClose}
                >
                    {item.label}
                </a>
            ))}
        </>
    )
}

interface BlogHeaderProps {
    forceOpaque?: boolean
    darkMode?: boolean
}

export function BlogHeader({ forceOpaque = false, darkMode = true }: BlogHeaderProps) {
    const [scrolled, setScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 100)
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const isScrolled = forceOpaque || scrolled || isMobileMenuOpen
    const useDarkText = isScrolled && !darkMode

    const linkClass = (dark: boolean) =>
        `text-sm transition-colors ${dark ? "text-neutral-700 hover:text-neutral-900" : "text-white/70 hover:text-white"}`

    return (
        <header
            className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300 flex flex-col"
            style={{ fontFamily: "var(--font-manrope), 'Manrope', sans-serif" }}
        >
            {/* Announcement Bar */}
            <a
                href={`${WEBSITE}/customize`}
                className="bg-[#050505] border-b border-white/10 py-2.5 text-center flex items-center justify-center w-full z-50 text-[10px] sm:text-xs text-white/80 uppercase tracking-[0.2em] font-medium hover:text-white transition-colors"
            >
                Founder&apos;s Batch Closing March 2nd. Retail MSRP ($1,199) Takes Effect After.
            </a>

            <div className={cn(
                "w-full transition-all duration-300",
                darkMode
                    ? "bg-[#050505]/95 backdrop-blur-md"
                    : isScrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-transparent"
            )}>
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <a href={WEBSITE} className="flex items-center gap-2">
                        <img
                            src={useDarkText ? "/Logo.svg" : "/DreamPlay Logo White.png"}
                            alt="DreamPlay Pianos"
                            className={`h-8 transition-all ${useDarkText ? "brightness-0" : ""}`}
                        />
                    </a>

                    {/* Main navigation */}
                    <nav className="hidden md:flex items-center gap-6 h-full">
                        <a href={`${WEBSITE}/how-it-works`} className={linkClass(useDarkText)}>How It Works</a>
                        <a href={`${WEBSITE}/better-practice`} className={linkClass(useDarkText)}>The Benefits</a>

                        <NavDropdown
                            label="Features"
                            useDarkText={useDarkText}
                            items={[
                                { label: "Product Info", href: `${WEBSITE}/product-information` },
                                { label: "Buyer's Guide", href: `${WEBSITE}/buyers-guide` },
                            ]}
                        />

                        <NavDropdown
                            label="About Us"
                            useDarkText={useDarkText}
                            items={[
                                { label: "Our Story", href: `${WEBSITE}/our-story` },
                                { label: "The DS Standard", href: `${WEBSITE}/about-us/ds-standard` },
                            ]}
                        />

                        <NavDropdown
                            label="Manufacturing & Shipping"
                            useDarkText={useDarkText}
                            items={[
                                { label: "Manufacturing", href: `${WEBSITE}/production-timeline` },
                                { label: "Shipping", href: `${WEBSITE}/information-and-policies/shipping` },
                            ]}
                        />

                        <a href={`${WEBSITE}/information-and-policies/faq`} className={linkClass(useDarkText)}>FAQ</a>
                        <Link href="/blog" className={linkClass(useDarkText)}>Blog</Link>
                    </nav>

                    {/* CTA */}
                    <div className="flex items-center gap-4">
                        <a
                            href={`${WEBSITE}/customize`}
                            className={`hidden md:flex items-center gap-2 rounded-none px-5 py-2.5 text-sm font-medium transition-all duration-300 ${useDarkText
                                ? "bg-black border border-black text-white hover:bg-neutral-800"
                                : "bg-white/5 backdrop-blur-sm border border-white/30 text-white hover:bg-white/15"
                                }`}
                        >
                            Configure Yours
                            <span className="w-6 h-6 rounded-none flex items-center justify-center bg-white">
                                <ArrowRight className="w-3 h-3 text-black" />
                            </span>
                        </a>

                        <button
                            className={`md:hidden cursor-pointer p-2 ${useDarkText ? "text-neutral-900" : "text-white"}`}
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-[100px] left-0 right-0 bg-white border-b border-gray-100 shadow-xl animate-in slide-in-from-top-2 duration-200">
                    <nav className="flex flex-col p-4">
                        <a href={`${WEBSITE}/how-it-works`} className="py-3 text-neutral-600 hover:text-black font-medium border-b border-gray-50" onClick={() => setIsMobileMenuOpen(false)}>How It Works</a>
                        <a href={`${WEBSITE}/better-practice`} className="py-3 text-neutral-600 hover:text-black font-medium border-b border-gray-50" onClick={() => setIsMobileMenuOpen(false)}>The Benefits</a>

                        <MobileDropdownSection
                            label="Features"
                            onClose={() => setIsMobileMenuOpen(false)}
                            items={[
                                { label: "Product Info", href: `${WEBSITE}/product-information` },
                                { label: "Buyer's Guide", href: `${WEBSITE}/buyers-guide` },
                            ]}
                        />

                        <MobileDropdownSection
                            label="About Us"
                            onClose={() => setIsMobileMenuOpen(false)}
                            items={[
                                { label: "Our Story", href: `${WEBSITE}/our-story` },
                                { label: "The DS Standard", href: `${WEBSITE}/about-us/ds-standard` },
                            ]}
                        />

                        <MobileDropdownSection
                            label="Manufacturing & Shipping"
                            onClose={() => setIsMobileMenuOpen(false)}
                            items={[
                                { label: "Manufacturing", href: `${WEBSITE}/production-timeline` },
                                { label: "Shipping", href: `${WEBSITE}/information-and-policies/shipping` },
                            ]}
                        />

                        <div className="border-t border-gray-200 my-2" />
                        <a href={`${WEBSITE}/information-and-policies/faq`} className="py-3 text-neutral-600 hover:text-black font-medium border-b border-gray-50" onClick={() => setIsMobileMenuOpen(false)}>FAQ</a>
                        <Link href="/blog" className="py-3 text-neutral-600 hover:text-black font-medium" onClick={() => setIsMobileMenuOpen(false)}>Blog</Link>

                        <a
                            href={`${WEBSITE}/customize`}
                            className="mt-4 flex items-center justify-center gap-2 w-full bg-black text-white rounded-none py-3 font-medium"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Configure Yours
                            <ArrowRight className="w-4 h-4" />
                        </a>
                    </nav>
                </div>
            )}
        </header>
    )
}
