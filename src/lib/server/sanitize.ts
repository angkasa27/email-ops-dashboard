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

const SAFE_DATA_IMAGE_MIME = /^data:image\/(?:png|jpeg|jpg|gif|webp|bmp|svg\+xml);base64,[a-z0-9+/=\s]+$/i;
const MAX_DATA_IMAGE_LENGTH = 300_000;

function isSafeDataImage(value: string): boolean {
  return value.length <= MAX_DATA_IMAGE_LENGTH && SAFE_DATA_IMAGE_MIME.test(value);
}

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
        color: [/^(#[0-9a-f]{3,8}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\)|[a-z]+)$/i],
        "background-color": [/^(#[0-9a-f]{3,8}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\)|[a-z]+)$/i],
        "font-size": [/^\d+(?:\.\d+)?(px|em|rem|%)$/],
        "font-weight": [/^(normal|bold|bolder|lighter|[1-9]00)$/],
        "font-style": [/^(normal|italic|oblique)$/],
        "text-align": [/^(left|right|center|justify)$/],
        "text-decoration": [/^(none|underline|line-through|overline)$/],
        margin: [/^\d+(?:\.\d+)?(px|em|rem|%)$/],
        padding: [/^\d+(?:\.\d+)?(px|em|rem|%)$/],
        border: [/^[\w\s.#()%,-]+$/],
        width: [/^\d+(?:\.\d+)?(px|em|rem|%)$/],
        height: [/^\d+(?:\.\d+)?(px|em|rem|%)$/]
      }
    },
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target === "_blank") {
          return {
            tagName,
            attribs: {
              ...attribs,
              rel: "noopener noreferrer"
            }
          };
        }

        return { tagName, attribs };
      },
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        if (src.startsWith("data:") && !isSafeDataImage(src)) {
          const { src: _removed, ...rest } = attribs;
          return { tagName, attribs: rest };
        }

        return { tagName, attribs };
      }
    },
    disallowedTagsMode: "discard"
  });
}
