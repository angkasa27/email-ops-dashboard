import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
] as const;

export function sanitizeEmailHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["class", "style"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"]
    },
    allowedStyles: {
      "*": {
        color: [/^.+$/],
        "background-color": [/^.+$/],
        "font-size": [/^.+$/],
        "font-weight": [/^.+$/],
        "font-style": [/^.+$/],
        "text-align": [/^.+$/],
        "text-decoration": [/^.+$/],
        margin: [/^.+$/],
        padding: [/^.+$/],
        border: [/^.+$/],
        width: [/^.+$/],
        height: [/^.+$/]
      }
    },
    disallowedTagsMode: "discard"
  });
}
