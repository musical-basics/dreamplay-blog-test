"use client";

import { useState } from "react";
import { CheckCircle2, Package, ArrowRight } from "lucide-react";
import { subscribeToNewsletter } from "@/app/actions/email-actions";

export function NewsletterForm() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setStatus("loading");

        try {
            const res = await subscribeToNewsletter({
                email,
                tags: ["Blog Newsletter", "Free Shipping Lead"],
                temp_session_id: typeof window !== "undefined" ? localStorage.getItem("dp_temp_session") || undefined : undefined
            });

            if (!res.success) {
                throw new Error(res.error || "Failed to subscribe");
            }

            setStatus("success");
            setEmail("");
            if (typeof window !== "undefined") {
                localStorage.setItem("dp_v2_subscribed", "true");
                localStorage.setItem("dp_user_email", email);
            }
        } catch (err) {
            setStatus("error");
        }
    };

    if (status === "success") {
        return (
            <section className="border-t border-white/10 bg-[#050505] px-6 py-24 md:py-32 text-white">
                <div className="mx-auto max-w-2xl text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-white/20 bg-white/5">
                        <CheckCircle2 className="text-white" size={32} strokeWidth={1.5} />
                    </div>
                    <h2 className="mb-4 font-serif text-3xl md:text-4xl tracking-tight leading-tight text-white">
                        Check your inbox.
                    </h2>
                    <p className="mx-auto max-w-sm font-sans text-sm md:text-base leading-relaxed text-white/60">
                        We just sent you an email with instructions to unlock your VIP Free Shipping Pass.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="border-t border-white/10 bg-[#050505] px-6 py-24 md:py-32 text-white">
            <div className="mx-auto max-w-2xl text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-white/10 bg-white/5">
                    <Package className="text-white" size={24} strokeWidth={1.5} />
                </div>
                <p className="mb-3 font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
                    VIP Offer
                </p>
                <h2 className="mb-6 font-serif text-3xl md:text-4xl tracking-tight leading-tight text-white">
                    Unlock Free Global Shipping.
                </h2>
                <p className="mx-auto mb-10 max-w-lg font-sans text-sm md:text-base leading-relaxed text-white/50">
                    Join our VIP list to get a Free Shipping Pass applied to your next DreamPlay One reservation (saves $150+).
                </p>
                <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row sm:gap-0 border border-white/20 p-1 sm:p-1.5 bg-white/5">
                    <input
                        type="email"
                        placeholder="Enter your email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 rounded-none border border-white/20 bg-transparent px-4 py-4 font-sans text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none focus:ring-0 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="min-w-[160px] flex items-center justify-center gap-2 rounded-none bg-white px-6 py-4 font-sans text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-white/90 disabled:opacity-70 cursor-pointer whitespace-nowrap"
                    >
                        {status === "loading" ? "Processing..." : "Get VIP Pass"}
                        {status !== "loading" && <ArrowRight className="h-4 w-4" />}
                    </button>
                </form>
                {status === "error" && (
                    <div className="mt-4 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-sans text-center max-w-md mx-auto">
                        Failed to subscribe. Please try again.
                    </div>
                )}
                <p className="text-[10px] text-white/30 uppercase tracking-widest mt-6">
                    No spam. Unsubscribe anytime.
                </p>
            </div>
        </section>
    );
}
