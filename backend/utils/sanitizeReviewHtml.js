import sanitizeHtml from "sanitize-html";

const ALLOWED_REVIEW_TAGS = ["p", "br", "b", "strong", "i", "em", "u"];

function normalizeWhitespace(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeReviewHtml(rawValue = "") {
  const dirty = typeof rawValue === "string" ? rawValue : "";

  let html = sanitizeHtml(dirty, {
    allowedTags: ALLOWED_REVIEW_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    transformTags: {
      div: "p",
      span: (tagName, attribs) => ({
        tagName: "span",
        attribs: {}
      })
    }
  });

  html = html
    .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  const plainText = normalizeWhitespace(
    sanitizeHtml(html, {
      allowedTags: [],
      allowedAttributes: {}
    })
  );

  return {
    html,
    plainText
  };
}