/**
 * Normalizes FastAPI / Pydantic validation payloads into user-facing text.
 * Never exposes raw `loc` tuples, field paths, or internal error structures.
 */

type ValidationItem = {
  msg?: unknown;
  message?: unknown;
  loc?: unknown;
};

/** Strip backend prefixes from a single validation message string. */
export function cleanValidationMessage(raw: string): string {
  let msg = raw.trim();
  if (!msg) return "";

  // ('body', 'password'): Value error, Password must contain...
  const tuplePrefix = msg.match(/^\([^)]+\)\s*:\s*(.+)$/s);
  if (tuplePrefix?.[1]) {
    msg = tuplePrefix[1].trim();
  }

  // body.password: or query.email:
  msg = msg.replace(
    /^(?:body|query|path|header|cookie)\.[\w[\]*.]+:\s*/i,
    ""
  );

  // Pydantic value_error prefix
  msg = msg.replace(/^Value error,?\s*/i, "");

  // Pydantic v2 phrasing
  msg = msg.replace(/^Input should be /i, "Please enter ");

  // Remaining field label prefix, e.g. "password: Must be..."
  msg = msg.replace(/^[\w.]+\s*:\s*/i, "");

  return msg.trim();
}

function formatValidationItem(item: unknown): string {
  if (typeof item === "string") {
    return cleanValidationMessage(item);
  }
  if (!item || typeof item !== "object") {
    return "";
  }
  const record = item as ValidationItem;
  if (typeof record.msg === "string") {
    return cleanValidationMessage(record.msg);
  }
  if (typeof record.message === "string") {
    return cleanValidationMessage(record.message);
  }
  return "";
}

/** Parse FastAPI `detail` (string, array, or object) into readable text. */
export function parseApiValidationDetail(detail: unknown): string {
  if (detail == null) return "";

  if (typeof detail === "string") {
    return cleanValidationMessage(detail);
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map(formatValidationItem)
      .filter((line) => line.length > 0);
    return [...new Set(messages)].join("\n");
  }

  if (typeof detail === "object") {
    return formatValidationItem(detail);
  }

  return "";
}

/** Build a display message from a failed API JSON body. */
export function parseApiErrorResponse(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;

    const fromDetail = parseApiValidationDetail(body.detail);
    if (fromDetail) return fromDetail;

    if (typeof body.message === "string" && body.message.trim()) {
      return cleanValidationMessage(body.message);
    }

    if (typeof body.error === "string" && body.error.trim()) {
      return cleanValidationMessage(body.error);
    }
  }

  return `Request failed (${status})`;
}

/** Clean an already-serialized error string (legacy / defensive). */
export function formatApiErrorForDisplay(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .split("\n")
    .map((line) => cleanValidationMessage(line))
    .filter(Boolean)
    .join("\n");
}
