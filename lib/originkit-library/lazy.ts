"use client"

import { useEffect, useState, type ComponentType } from "react"

/**
 * The same components as `index.ts`, but each one is its own chunk, fetched the first
 * time something asks for it. `index.ts` imports all of them up front, which puts the
 * whole library in every page's JS. When a component is added to `index.ts`, add it here.
 */
type Loader = () => Promise<{ default: ComponentType<any> }>

const loaders: Record<string, Loader> = {
  "accordionos": () => import("./accordionos"),
  "agent-status": () => import("./agent-status"),
  "alert": () => import("./alert"),
  "approval-card": () => import("./approval-card"),
  "app-icon-paddle-wheel": () => import("./app-icon-paddle-wheel"),
  "badge": () => import("./badge"),
  "bloom-wave-text": () => import("./bloom-wave-text"),
  "bookshelf-cover-flip": () => import("./bookshelf-cover-flip"),
  "bouncing-dot-tabs": () => import("./bouncing-dot-tabs"),
  "button": () => import("./button"),
  "button-morph-card": () => import("./button-morph-card"),
  "card": () => import("./card"),
  "crumple-paper-carousel": () => import("./crumple-paper-carousel"),
  "card-swap": () => import("./card-swap"),
  "carousel": () => import("./carousel"),
  "chat-thread": () => import("./chat-thread"),
  "checkbox": () => import("./checkbox"),
  "corner-video": () => import("./corner-video"),
  "coverflow-drag": () => import("./coverflow-drag"),
  "data-table": () => import("./data-table"),
  "dialog": () => import("./dialog"),
  "diff-review": () => import("./diff-review"),
  "distribution-chart": () => import("./distribution-chart"),
  "flip-invite-ticket": () => import("./flip-invite-ticket"),
  "peel-sticker": () => import("./peel-sticker"),
  "pixel-swarm-dropdown": () => import("./pixel-swarm-dropdown"),
  "dock": () => import("./dock"),
  "draggable-cloth-print": () => import("./draggable-cloth-print"),
  "dropdown-menu": () => import("./dropdown-menu"),
  "dynamic-grid-gallery": () => import("./dynamic-grid-gallery"),
  "garden-progress-slider": () => import("./garden-progress-slider"),
  "gooey-delete-confirm": () => import("./gooey-delete-confirm"),
  "glass-carousel": () => import("./glass-carousel"),
  "holo-card-dispenser": () => import("./holo-card-dispenser"),
  "holo-flip-badge": () => import("./holo-flip-badge"),
  "image-viewer": () => import("./image-viewer"),
  "infinite-grid": () => import("./infinite-grid"),
  "inline-edit": () => import("./inline-edit"),
  "label-input": () => import("./label-input"),
  "layered-stack": () => import("./layered-stack"),
  "letter-cascade": () => import("./letter-cascade"),
  "like": () => import("./like"),
  "liq-toggle": () => import("./liq-toggle"),
  "magnetic-dock": () => import("./magnetic-dock"),
  "liquid-glass-clock": () => import("./liquid-glass-clock"),
  "mirror-flip-carousel": () => import("./mirror-flip-carousel"),
  "message-bubble": () => import("./message-bubble"),
  "one-time-code": () => import("./one-time-code"),
  "orbit-card-stack": () => import("./orbit-card-stack"),
  "photo-card-globe": () => import("./photo-card-globe"),
  "radial-action-menu": () => import("./radial-action-menu"),
  "licorice-glide": () => import("./licorice-glide"),
  "periwinkle-fanfare": () => import("./periwinkle-fanfare"),
  "range-switch-stat-card": () => import("./range-switch-stat-card"),
  "status-dot-picker": () => import("./status-dot-picker"),
  "water-ripple-refraction": () => import("./water-ripple-refraction"),
  "page-flip-book": () => import("./page-flip-book"),
  "plan-list": () => import("./plan-list"),
  "photo-stack-lightbox": () => import("./photo-stack-lightbox"),
  "pricing-table": () => import("./pricing-table"),
  "prompt-composer": () => import("./prompt-composer"),
  "qr-code-assemble": () => import("./qr-code-assemble"),
  "reasoning-trace": () => import("./reasoning-trace"),
  "rolling-counter": () => import("./rolling-counter"),
  "scribble-loop-nav": () => import("./scribble-loop-nav"),
  "scroll-area": () => import("./scroll-area"),
  "scroll-progress-outline": () => import("./scroll-progress-outline"),
  "seek": () => import("./seek"),
  "segmented-control": () => import("./segmented-control"),
  "sign-in-form": () => import("./sign-in-form"),
  "signature": () => import("./signature"),
  "snap-carousel": () => import("./snap-carousel"),
  "spiral-3d-slider": () => import("./spiral-3d-slider"),
  "split-pane": () => import("./split-pane"),
  "streaming-text": () => import("./streaming-text"),
  "suggestion-chips": () => import("./suggestion-chips"),
  "swinging-lanyard-badge": () => import("./swinging-lanyard-badge"),
  "stretch-pill-toggle": () => import("./stretch-pill-toggle"),
  "switch": () => import("./switch"),
  "tabs": () => import("./tabs"),
  "terminal-output": () => import("./terminal-output"),
  "text-input": () => import("./text-input"),
  "text-repel": () => import("./text-repel"),
  "tilt": () => import("./tilt"),
  "toast": () => import("./toast"),
  "tool-call-card": () => import("./tool-call-card"),
  "tooltip": () => import("./tooltip"),
  "wake-slider": () => import("./wake-slider"),
}

const cache = new Map<string, ComponentType<any>>()

/**
 * The real component for `slug` (so statics such as `propertyControls` are intact),
 * or undefined while its chunk loads. Pass undefined to not load anything yet.
 */
export function useComponent(slug: string | undefined): ComponentType<any> | undefined {
  const [loaded, setLoaded] = useState<{ slug: string; Comp: ComponentType<any> } | null>(null)
  useEffect(() => {
    if (!slug || cache.has(slug)) return
    let live = true
    loaders[slug]?.()
      .then((m) => {
        cache.set(slug, m.default)
        if (live) setLoaded({ slug, Comp: m.default })
      })
      .catch(() => {
        /* chunk failed to load: the tile keeps its placeholder */
      })
    return () => {
      live = false
    }
  }, [slug])
  if (!slug) return undefined
  return cache.get(slug) ?? (loaded?.slug === slug ? loaded.Comp : undefined)
}
