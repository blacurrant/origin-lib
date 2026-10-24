import * as React from "react"
import { addPropertyControls, ControlType } from "./framer-shim"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"

/**
 * ImageViewer: a row of thumbnails that opens a full-screen viewer. Inside the
 * viewer, arrow keys change image, click or the zoom button toggles zoom,
 * Escape closes, and focus stays inside and returns to the thumbnail you
 * opened. Leave `images` empty to use the built-in artwork.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 130
 */

type Theme = "dark" | "light"

interface ImageItem {
    src: string
    alt: string
}

interface ImageViewerProps {
    images: ImageItem[]
    accent: string
    theme: Theme
    radius: number
}

/** Generated artwork so the component works with no network and no assets. */
function art(hue: number, shape: number): string {
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="hsl(${hue},70%,52%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},68%,22%)"/></linearGradient></defs>` +
        `<rect width="800" height="600" fill="url(#g)"/>` +
        (shape === 0
            ? `<circle cx="560" cy="210" r="120" fill="rgba(255,255,255,0.22)"/><path d="M0 470 C 200 380 380 520 800 400 L800 600 L0 600Z" fill="rgba(0,0,0,0.28)"/>`
            : shape === 1
              ? `<rect x="150" y="130" width="320" height="320" rx="36" fill="rgba(255,255,255,0.2)" transform="rotate(14 310 290)"/><circle cx="560" cy="380" r="86" fill="rgba(0,0,0,0.25)"/>`
              : `<path d="M0 360 L240 160 L420 330 L560 230 L800 420 L800 600 L0 600Z" fill="rgba(0,0,0,0.3)"/><circle cx="640" cy="150" r="64" fill="rgba(255,255,255,0.3)"/>`) +
        `</svg>`
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const DEFAULTS: ImageItem[] = [
    { src: art(24, 0), alt: "Warm gradient with a sun over rolling hills" },
    { src: art(262, 1), alt: "Violet gradient with a tilted square and a circle" },
    { src: art(190, 2), alt: "Teal gradient with a mountain range and a moon" },
]

const FOCUSABLE = "button:not([disabled])"

export default function ImageViewer({
    images = [],
    accent = "#fa7319",
    theme = "dark",
    radius = 10,
}: Partial<ImageViewerProps>) {
    const dark = theme !== "light"
    const list = (images.length ? images : DEFAULTS).map((im, i) => ({
        src: im.src || DEFAULTS[i % DEFAULTS.length].src,
        alt: im.alt || `Image ${i + 1}`,
    }))
    const [open, setOpen] = React.useState<number | null>(null)
    const [zoom, setZoom] = React.useState(false)
    const [focused, setFocused] = React.useState<string | null>(null)
    const returnTo = React.useRef<HTMLElement | null>(null)
    const dialog = React.useRef<HTMLDivElement | null>(null)
    const closeBtn = React.useRef<HTMLButtonElement | null>(null)
    const isOpen = open !== null
    const openRef = React.useRef<number | null>(null)
    openRef.current = open
    const count = list.length

    const show = (n: number) => {
        setZoom(false)
        setOpen((n + count) % count)
    }
    const close = () => {
        setOpen(null)
        setZoom(false)
    }

    React.useEffect(() => {
        if (typeof window === "undefined" || !isOpen) return
        const previous = document.body.style.overflow
        document.body.style.overflow = "hidden"
        closeBtn.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                close()
            } else if (e.key === "ArrowRight") show((openRef.current ?? 0) + 1)
            else if (e.key === "ArrowLeft") show((openRef.current ?? 0) - 1)
            else if (e.key === "Tab" && dialog.current) {
                const items = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE))
                const first = items[0]
                const last = items[items.length - 1]
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }
        window.addEventListener("keydown", onKey, true)
        return () => {
            window.removeEventListener("keydown", onKey, true)
            document.body.style.overflow = previous
            returnTo.current?.focus?.()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    const ring = (k: string): React.CSSProperties => (focused === k ? { outline: `2px solid ${accent}`, outlineOffset: 2 } : {})
    const bind = (k: string) => ({
        onFocus: (e: React.FocusEvent<HTMLElement>) => setFocused(e.currentTarget.matches(":focus-visible") ? k : null),
        onBlur: () => setFocused(null),
    })
    const tool: React.CSSProperties = {
        width: 40,
        height: 40,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.22)",
        background: "rgba(255,255,255,0.1)",
        color: "#ffffff",
        cursor: "pointer",
    }

    const current = open !== null ? list[open] : null

    return (
        <MotionConfig reducedMotion="user">
            <div style={{ display: "flex", gap: 10, width: "100%", fontFamily: "inherit" }}>
                {list.map((im, i) => (
                    <button
                        key={i}
                        type="button"
                        aria-label={`Open image ${i + 1} of ${list.length}: ${im.alt}`}
                        aria-haspopup="dialog"
                        onClick={(e) => {
                            returnTo.current = e.currentTarget
                            show(i)
                        }}
                        {...bind(`thumb-${i}`)}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            aspectRatio: "4 / 3",
                            padding: 0,
                            borderRadius: radius,
                            border: `1px solid ${dark ? "#2d2d2f" : "#e4e1db"}`,
                            overflow: "hidden",
                            background: dark ? "#1b1c1d" : "#f1efeb",
                            cursor: "zoom-in",
                            position: "relative",
                            ...ring(`thumb-${i}`),
                        }}
                    >
                        <img src={im.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        <span aria-hidden style={{ position: "absolute", right: 8, bottom: 8, width: 24, height: 24, borderRadius: "50%", background: accent, color: "#141413", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="13" height="13" viewBox="0 0 16 16">
                                <circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
                                <path d="m10.4 10.4 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                            </svg>
                        </span>
                    </button>
                ))}
            </div>

            <AnimatePresence>
                {current && (
                    <motion.div
                        key="viewer"
                        ref={dialog}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Image viewer, ${(open ?? 0) + 1} of ${list.length}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.16 }}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 1000,
                            background: "rgba(6,6,8,0.92)",
                            display: "flex",
                            flexDirection: "column",
                            fontFamily: "inherit",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", color: "#ffffff" }}>
                            <span aria-live="polite" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                                {(open ?? 0) + 1} / {list.length}
                            </span>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" aria-label={zoom ? "Zoom out" : "Zoom in"} aria-pressed={zoom} onClick={() => setZoom((z) => !z)} {...bind("zoom")} style={{ ...tool, ...ring("zoom") }}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                                        <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                        <path d={zoom ? "M5 7h4" : "M5 7h4M7 5v4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </button>
                                <button ref={closeBtn} type="button" aria-label="Close viewer" onClick={close} {...bind("close")} style={{ ...tool, ...ring("close") }}>
                                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                                        <path d="M3.2 3.2l7.6 7.6M10.8 3.2l-7.6 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: "0 64px 24px" }}>
                            <motion.img
                                key={open}
                                src={current.src}
                                alt={current.alt}
                                onClick={() => setZoom((z) => !z)}
                                draggable={false}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: zoom ? 1.7 : 1 }}
                                transition={{ duration: 0.18 }}
                                style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, cursor: zoom ? "zoom-out" : "zoom-in", transformOrigin: "center" }}
                            />
                            {list.length > 1 && (
                                <>
                                    <button type="button" aria-label="Previous image" onClick={() => show((open ?? 0) - 1)} {...bind("prev")} style={{ ...tool, position: "absolute", left: 14, top: "50%", marginTop: -20, ...ring("prev") }}>
                                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                                            <path d="M8.6 3 4.6 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                    <button type="button" aria-label="Next image" onClick={() => show((open ?? 0) + 1)} {...bind("next")} style={{ ...tool, position: "absolute", right: 14, top: "50%", marginTop: -20, ...ring("next") }}>
                                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                                            <path d="M5.4 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </MotionConfig>
    )
}

addPropertyControls(ImageViewer, {
    images: {
        type: ControlType.Array,
        title: "Images",
        control: {
            type: ControlType.Object,
            controls: {
                src: { type: ControlType.Image, title: "Image" },
                alt: { type: ControlType.String, title: "Alt text", defaultValue: "" },
            },
        },
        defaultValue: [],
    },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#fa7319" },
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 10, min: 0, max: 24 },
})
