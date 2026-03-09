'use client'

import { useEffect, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function AnalyticsTrackerContent() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const analyticsTrackUrl = process.env.NEXT_PUBLIC_ANALYTICS_TRACK_URL || 'https://data.dreamplaypianos.com/api/track'

    const startTime = useRef(Date.now())
    const currentPath = useRef('')
    const hasSentLeave = useRef(false)

    useEffect(() => {
        if (!pathname) return;

        let url = pathname
        if (searchParams && searchParams.toString()) {
            url = url + `?${searchParams.toString()}`
        }

        const metadata: Record<string, string> = {};

        // --- RESOLVE EMAIL FROM SID (server-side, replaces ?em= which was spoofable) ---
        const sid = searchParams?.get('sid');
        const cid = searchParams?.get('cid');
        if (sid && typeof window !== 'undefined' && !sessionStorage.getItem('dp_sid_resolved')) {
            sessionStorage.setItem('dp_sid_resolved', '1');
            fetch(`https://email.dreamplaypianos.com/api/resolve-subscriber?sid=${sid}${cid ? `&cid=${cid}` : ''}`)
                .then(r => r.json())
                .then(data => {
                    if (data.email) {
                        localStorage.setItem('dp_user_email', data.email);
                    }
                })
                .catch(() => { });
        }

        if (typeof window !== 'undefined') {
            const savedEmail = localStorage.getItem('dp_user_email');
            if (savedEmail) metadata.email = savedEmail;

            // --- CAPTURE UTM PARAMETERS ---
            const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
            utms.forEach(utm => {
                const val = searchParams?.get(utm);
                if (val) sessionStorage.setItem(`dp_${utm}`, val);

                const storedVal = sessionStorage.getItem(`dp_${utm}`);
                if (storedVal) metadata[utm] = storedVal;
            });

            // --- CAPTURE ORGANIC REFERRER ---
            const currentReferrer = document.referrer;

            if (currentReferrer && !currentReferrer.includes(window.location.hostname) && !currentReferrer.includes('localhost')) {
                if (!sessionStorage.getItem('dp_initial_referrer')) {
                    sessionStorage.setItem('dp_initial_referrer', currentReferrer);
                }
            }

            const initialReferrer = sessionStorage.getItem('dp_initial_referrer');
            if (initialReferrer) metadata.referrer = initialReferrer;
        }

        // 1. Fire the leave event for the OLD page when navigating internally
        if (currentPath.current && currentPath.current !== url && !hasSentLeave.current) {
            const duration = Math.round((Date.now() - startTime.current) / 1000);
            if (duration > 1) {
                fetch(analyticsTrackUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventName: 'page_leave',
                        path: currentPath.current,
                        metadata: { ...metadata, duration_seconds: duration }
                    }),
                    keepalive: true
                }).catch(() => { });
            }
        }

        // 2. Setup for the NEW page
        currentPath.current = url;
        startTime.current = Date.now();
        hasSentLeave.current = false;

        // 3. Send the pageview event via direct fetch (cross-origin — no server action)
        fetch(analyticsTrackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventName: 'pageview',
                path: url,
                metadata
            }),
            keepalive: true
        }).catch(() => { });

    }, [pathname, searchParams])

    // 4. Track physical exits (tab close, browser minimize, phone lock)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && !hasSentLeave.current && currentPath.current) {
                const duration = Math.round((Date.now() - startTime.current) / 1000);
                if (duration > 1) {
                    const savedEmail = typeof window !== 'undefined' ? localStorage.getItem('dp_user_email') : null;
                    const metadata: any = { duration_seconds: duration };
                    if (savedEmail) metadata.email = savedEmail;

                    fetch(analyticsTrackUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            eventName: 'page_leave',
                            path: currentPath.current,
                            metadata: metadata
                        }),
                        keepalive: true
                    }).catch(() => { });

                    hasSentLeave.current = true;
                }
            } else if (document.visibilityState === 'visible') {
                startTime.current = Date.now();
                hasSentLeave.current = false;
            }
        };

        const handlePageHide = () => {
            if (!hasSentLeave.current && currentPath.current) {
                const duration = Math.round((Date.now() - startTime.current) / 1000);
                if (duration > 1) {
                    fetch(analyticsTrackUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            eventName: 'page_leave',
                            path: currentPath.current,
                            metadata: { duration_seconds: duration }
                        }),
                        keepalive: true
                    }).catch(() => { });
                    hasSentLeave.current = true;
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, []);

    return null
}

export function AnalyticsTracker() {
    return (
        <Suspense fallback={null}>
            <AnalyticsTrackerContent />
        </Suspense>
    )
}
