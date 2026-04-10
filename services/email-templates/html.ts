import sanitizeHtml from "sanitize-html";

const SAFE_STYLE_VALUE_PATTERN = /^(?!.*(?:expression|javascript:|data:))[#(),.%\w\s\-/:;'"!]+$/i;
const TEMPLATE_VARIABLE_PATTERN = /{{\s*[a-zA-Z0-9_]+\s*}}/;

const EMAIL_TEMPLATE_ALLOWED_TAGS = [
  "html",
  "head",
  "body",
  "meta",
  "title",
  "div",
  "span",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "blockquote",
  "code",
  "pre",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "colgroup",
  "col",
  "a",
  "img",
] as const;

const EMAIL_TEMPLATE_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": ["style", "align"],
  a: ["href", "name", "target", "rel", "title", "style"],
  img: ["src", "alt", "title", "width", "height", "border", "style"],
  table: ["width", "height", "border", "cellpadding", "cellspacing", "role", "style"],
  td: ["colspan", "rowspan", "width", "height", "valign", "align", "style"],
  th: ["colspan", "rowspan", "width", "height", "valign", "align", "style"],
  col: ["span", "width", "style"],
  meta: ["charset", "http-equiv", "content", "name"],
};

const EMAIL_TEMPLATE_ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    background: [SAFE_STYLE_VALUE_PATTERN],
    "background-color": [SAFE_STYLE_VALUE_PATTERN],
    border: [SAFE_STYLE_VALUE_PATTERN],
    "border-bottom": [SAFE_STYLE_VALUE_PATTERN],
    "border-left": [SAFE_STYLE_VALUE_PATTERN],
    "border-radius": [SAFE_STYLE_VALUE_PATTERN],
    "border-right": [SAFE_STYLE_VALUE_PATTERN],
    "border-top": [SAFE_STYLE_VALUE_PATTERN],
    "border-collapse": [SAFE_STYLE_VALUE_PATTERN],
    "border-spacing": [SAFE_STYLE_VALUE_PATTERN],
    color: [SAFE_STYLE_VALUE_PATTERN],
    display: [SAFE_STYLE_VALUE_PATTERN],
    "font-family": [SAFE_STYLE_VALUE_PATTERN],
    "font-size": [SAFE_STYLE_VALUE_PATTERN],
    "font-style": [SAFE_STYLE_VALUE_PATTERN],
    "font-weight": [SAFE_STYLE_VALUE_PATTERN],
    height: [SAFE_STYLE_VALUE_PATTERN],
    "letter-spacing": [SAFE_STYLE_VALUE_PATTERN],
    "line-height": [SAFE_STYLE_VALUE_PATTERN],
    margin: [SAFE_STYLE_VALUE_PATTERN],
    "margin-bottom": [SAFE_STYLE_VALUE_PATTERN],
    "margin-left": [SAFE_STYLE_VALUE_PATTERN],
    "margin-right": [SAFE_STYLE_VALUE_PATTERN],
    "margin-top": [SAFE_STYLE_VALUE_PATTERN],
    "max-height": [SAFE_STYLE_VALUE_PATTERN],
    "max-width": [SAFE_STYLE_VALUE_PATTERN],
    "min-height": [SAFE_STYLE_VALUE_PATTERN],
    "min-width": [SAFE_STYLE_VALUE_PATTERN],
    outline: [SAFE_STYLE_VALUE_PATTERN],
    overflow: [SAFE_STYLE_VALUE_PATTERN],
    padding: [SAFE_STYLE_VALUE_PATTERN],
    "padding-bottom": [SAFE_STYLE_VALUE_PATTERN],
    "padding-left": [SAFE_STYLE_VALUE_PATTERN],
    "padding-right": [SAFE_STYLE_VALUE_PATTERN],
    "padding-top": [SAFE_STYLE_VALUE_PATTERN],
    "table-layout": [SAFE_STYLE_VALUE_PATTERN],
    "text-align": [SAFE_STYLE_VALUE_PATTERN],
    "text-decoration": [SAFE_STYLE_VALUE_PATTERN],
    "text-transform": [SAFE_STYLE_VALUE_PATTERN],
    "vertical-align": [SAFE_STYLE_VALUE_PATTERN],
    "white-space": [SAFE_STYLE_VALUE_PATTERN],
    width: [SAFE_STYLE_VALUE_PATTERN],
    "word-break": [SAFE_STYLE_VALUE_PATTERN],
  },
};

function normalizeLinkAttributes(attribs: sanitizeHtml.Attributes): sanitizeHtml.Attributes {
  const href = String(attribs.href ?? "").trim();
  if (!href) {
    return attribs;
  }

  if (/^(https?:)?\/\//i.test(href)) {
    return {
      ...attribs,
      target: "_blank",
      rel: attribs.rel?.trim() || "noopener noreferrer nofollow",
    };
  }

  const normalized = { ...attribs };

  delete normalized.target;

  const rel = attribs.rel?.trim();
  if (rel) {
    normalized.rel = rel;
  } else {
    delete normalized.rel;
  }

  return normalized;
}

function isSafeAnchorHref(value: string) {
  return TEMPLATE_VARIABLE_PATTERN.test(value) || /^(https?:|mailto:|tel:)/i.test(value);
}

function isSafeImageSrc(value: string) {
  return TEMPLATE_VARIABLE_PATTERN.test(value) || /^https?:/i.test(value);
}

export function sanitizeEmailTemplateHtml(source: string) {
  const sanitized = sanitizeHtml(source.trim(), {
    allowedTags: [...EMAIL_TEMPLATE_ALLOWED_TAGS],
    allowedAttributes: EMAIL_TEMPLATE_ALLOWED_ATTRIBUTES,
    allowedStyles: EMAIL_TEMPLATE_ALLOWED_STYLES,
    allowedSchemesAppliedToAttributes: [],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: (() => {
          const normalized = normalizeLinkAttributes(attribs);
          const href = String(normalized.href ?? "").trim();

          if (href && !isSafeAnchorHref(href)) {
            const { href: _href, target: _target, rel: _rel, ...rest } = normalized;
            return rest;
          }

          return normalized;
        })(),
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: (() => {
          const src = String(attribs.src ?? "").trim();
          if (src && !isSafeImageSrc(src)) {
            const { src: _src, ...rest } = attribs;
            return rest;
          }

          return attribs;
        })(),
      }),
    },
  }).trim();

  if (!sanitized) {
    throw new Error("HTML body must contain supported email markup.");
  }

  return sanitized;
}