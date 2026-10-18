/*! coi-serviceworker v0.1.7 | MIT License | https://github.com */
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
    self.addEventListener("fetch", (e) => {
        const t = e.request;
        if (t.mode === "navigate" || (t.img === "same-origin" && t.destination === "fetch")) {
            const r = new Request(t, { mode: "same-origin" });
            e.respondWith(
                fetch(r).then((res) => {
                    if (res.status === 0) return res;
                    const headers = new Headers(res.headers);
                    headers.set("Cross-Origin-Embedder-Policy", "require-corp");
                    headers.set("Cross-Origin-Opener-Policy", "same-origin");
                    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: headers });
                }).catch((err) => console.error(err))
            );
        }
    });
} else {
    // Dynamically calculate repository path rules for GitHub subdirectories
    const currentScript = document.currentScript;
    const scriptUrl = currentScript ? currentScript.src : new URL("coi-serviceworker.js", window.location.href).href;
    const swScope = new URL("./", scriptUrl).pathname; // Ensures proper subdirectory alignment
    
    if (navigator.serviceWorker) {
        navigator.serviceWorker.register(scriptUrl, { scope: swScope }).then((reg) => {
            reg.addEventListener("updatefound", () => window.location.reload());
        });
        if (navigator.serviceWorker.controller && !window.crossOriginIsolated) {
            // Force a quick single refresh to apply headers instantly on first view
            window.location.reload();
        }
    }
}
