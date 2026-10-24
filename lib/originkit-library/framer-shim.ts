/**
 * Browser/Node stand-in for Framer's built-in `framer` module.
 *
 * In Framer, `import { addPropertyControls, ControlType } from "framer"`
 * resolves to the real runtime. Outside Framer (the marketplace preview and
 * standalone tooling) we alias the bare specifier `"framer"` to this file via
 * the bundler so the exact same component source renders everywhere.
 */

export const ControlType = {
  Color: "color",
  Enum: "enum",
  SegmentedEnum: "segmentedenum",
  Boolean: "boolean",
  Number: "number",
  String: "string",
  RichText: "richtext",
  Object: "object",
  Array: "array",
  ComponentInstance: "componentinstance",
  Image: "image",
  ResponsiveImage: "responsiveimage",
  File: "file",
  Link: "link",
  Date: "date",
  Transition: "transition",
  FusedNumber: "fusednumber",
  EventHandler: "eventhandler",
  Font: "font",
  Slot: "slot",
  Padding: "padding",
  BorderRadius: "borderradius",
  Border: "border",
  BoxShadow: "boxshadow",
  Cursor: "cursor",
} as const;

/**
 * No-op outside Framer. Attaches the controls to the component for reference
 * so tooling can still introspect them, but does not affect rendering.
 */
export function addPropertyControls(
  component: unknown,
  controls: Record<string, unknown>
): void {
  if (typeof component === "function") {
    try {
      (component as { propertyControls?: unknown }).propertyControls = controls;
    } catch {
      /* frozen component — ignore */
    }
  }
}

export const RenderTarget = {
  current: () => "preview" as const,
  canvas: "canvas" as const,
  export: "export" as const,
  preview: "preview" as const,
  thumbnail: "thumbnail" as const,
};

/** Outside Framer, previews always run in the live (animated) path. */
export function useIsStaticRenderer(): boolean {
  return false;
}
