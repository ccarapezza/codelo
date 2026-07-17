import sanitizeHtml from "sanitize-html";

// Allowlist for CMS-authored Markdown rendered through marked. Generic
// container tags (div, span) are intentionally excluded — Markdown never
// needs them and removing them shrinks the XSS attack surface.
export function sanitizeCmsHtml(dirtyHtml: string): string {
  return sanitizeHtml(dirtyHtml, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "blockquote",
      "pre",
      "code",
      "strong",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
      pre: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const isExternal = href.startsWith("http://") || href.startsWith("https://");
        return {
          tagName,
          attribs: {
            ...attribs,
            // Always neutralize tab-nabbing on external links, regardless of
            // what the CMS authored.
            ...(isExternal ? { rel: "noopener noreferrer", target: "_blank" } : {}),
          },
        };
      },
    },
  });
}
