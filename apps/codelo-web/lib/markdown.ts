import { marked } from "marked";
import { sanitizeCmsHtml } from "./sanitize";

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function markdownToSafeHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return sanitizeCmsHtml(rawHtml);
}

// Flatten markdown to plain text (for excerpts/subtitles and SEO descriptions),
// so raw marks like **bold**, _italic_, `code`, [links](url) or # headings don't
// leak into places that render text, not HTML. Renders via marked, then strips
// tags + decodes the few entities it emits.
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return "";
  const html = marked.parse(markdown, { async: false }) as string;
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalize a heading/title for comparison: strip tags, markdown marks and
// entities, collapse whitespace, lowercase.
function normalizeHeading(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>]/g, "")
    .replace(/&[#a-z0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// AI-generated posts sometimes open the content with the article title as an H1
// (markdown `# Title` or HTML `<h1>Title</h1>`). The page already renders the
// `title` field separately, so that leading heading shows up twice. Drop it when
// it matches the title.
export function stripLeadingTitle(content: string, title: string): string {
  if (!content || !title) return content;
  const target = normalizeHeading(title);
  if (!target) return content;

  const trimmed = content.replace(/^[﻿\s]+/, "");
  // Markdown heading (#, ##, ###) on the first line.
  const md = trimmed.match(/^(#{1,3})[ \t]+([^\n]+)\n+/);
  if (md && normalizeHeading(md[2]) === target) {
    return trimmed.slice(md[0].length);
  }
  // HTML heading <h1>/<h2> at the start.
  const html = trimmed.match(/^<h([12])\b[^>]*>([\s\S]*?)<\/h\1>\s*/i);
  if (html && normalizeHeading(html[2]) === target) {
    return trimmed.slice(html[0].length);
  }
  return content;
}

const WORDS_PER_MINUTE = 225;

export function readingTimeMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
