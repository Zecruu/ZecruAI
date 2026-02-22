import { v4 as uuidv4 } from "uuid";
import { UIElement, UIComponentTemplate, UIElementType } from "@/types";

export const ELEMENT_TEMPLATES: UIComponentTemplate[] = [
  {
    type: "navbar",
    label: "Navbar",
    icon: "Menu",
    defaultStyle: {
      x: 0, y: 0, width: 800, height: 64,
      backgroundColor: "#1e1e1e",
      display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: 16,
    },
    defaultContent: "My Site",
  },
  {
    type: "hero",
    label: "Hero Section",
    icon: "Sparkles",
    defaultStyle: {
      x: 0, y: 0, width: 800, height: 400,
      backgroundColor: "#141414",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 16, padding: 32,
    },
    defaultContent: "Welcome to My Site",
  },
  {
    type: "section",
    label: "Section",
    icon: "LayoutGrid",
    defaultStyle: {
      x: 0, y: 0, width: 800, height: 300,
      backgroundColor: "#141414",
      padding: 24, display: "flex", flexDirection: "column", gap: 12,
    },
  },
  {
    type: "card",
    label: "Card",
    icon: "CreditCard",
    defaultStyle: {
      x: 0, y: 0, width: 300, height: 200,
      backgroundColor: "#1e1e1e",
      borderRadius: 12, borderWidth: 1, borderColor: "#262626",
      padding: 16, display: "flex", flexDirection: "column", gap: 8,
    },
  },
  {
    type: "container",
    label: "Container",
    icon: "SquareDashed",
    defaultStyle: {
      x: 0, y: 0, width: 600, height: 200,
      display: "flex", flexDirection: "row", gap: 12, padding: 16,
      borderWidth: 1, borderColor: "#262626", borderRadius: 8,
    },
  },
  {
    type: "button",
    label: "Button",
    icon: "MousePointerClick",
    defaultStyle: {
      x: 0, y: 0, width: 140, height: 44,
      backgroundColor: "#6366f1",
      borderRadius: 8, fontSize: 14, fontWeight: "600", textColor: "#ffffff",
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    defaultContent: "Click me",
  },
  {
    type: "heading",
    label: "Heading",
    icon: "Type",
    defaultStyle: {
      x: 0, y: 0, width: 400, height: 48,
      fontSize: 32, fontWeight: "700", textColor: "#ededed",
    },
    defaultContent: "Heading",
  },
  {
    type: "text",
    label: "Text",
    icon: "AlignLeft",
    defaultStyle: {
      x: 0, y: 0, width: 400, height: 32,
      fontSize: 14, textColor: "#737373",
    },
    defaultContent: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  },
  {
    type: "image",
    label: "Image",
    icon: "ImageIcon",
    defaultStyle: {
      x: 0, y: 0, width: 400, height: 250,
      backgroundColor: "#262626", borderRadius: 8,
    },
  },
  {
    type: "input",
    label: "Input",
    icon: "TextCursorInput",
    defaultStyle: {
      x: 0, y: 0, width: 300, height: 44,
      backgroundColor: "#141414",
      borderRadius: 8, borderWidth: 1, borderColor: "#262626",
      padding: 12, fontSize: 14, textColor: "#ededed",
    },
    defaultContent: "Enter text...",
  },
  {
    type: "form",
    label: "Form",
    icon: "ClipboardList",
    defaultStyle: {
      x: 0, y: 0, width: 400, height: 300,
      backgroundColor: "#1e1e1e",
      borderRadius: 12, padding: 24,
      display: "flex", flexDirection: "column", gap: 16,
      borderWidth: 1, borderColor: "#262626",
    },
  },
  {
    type: "divider",
    label: "Divider",
    icon: "Minus",
    defaultStyle: {
      x: 0, y: 0, width: 800, height: 2,
      backgroundColor: "#262626",
    },
  },
  {
    type: "footer",
    label: "Footer",
    icon: "PanelBottom",
    defaultStyle: {
      x: 0, y: 0, width: 800, height: 80,
      backgroundColor: "#141414",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    },
    defaultContent: "\u00a9 2026 My Site. All rights reserved.",
  },
];

export function createElementFromTemplate(
  template: UIComponentTemplate,
  dropX: number,
  dropY: number
): UIElement {
  return {
    id: uuidv4(),
    type: template.type,
    name: template.label,
    content: template.defaultContent,
    placeholder: template.type === "input" ? "Enter text..." : undefined,
    style: { ...template.defaultStyle, x: dropX, y: dropY },
    children: [],
  };
}
