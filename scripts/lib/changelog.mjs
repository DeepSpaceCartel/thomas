const HEADING_RE = /^## \[(.+?)\](?:\s*-\s*\d{4}-\d{2}-\d{2})?\s*$/;
const LINK_REF_RE = /^\[[^\]]+\]:\s*\S+/;

function isBoundary(line) {
  return HEADING_RE.test(line) || LINK_REF_RE.test(line);
}

// Returns every "## [name] - date" heading found, top to bottom, in
// document order — used to find the topmost *dated* (non-Unreleased)
// section.
export function listHeadings(text) {
  const lines = text.split('\n');
  const headings = [];
  lines.forEach((line, idx) => {
    const match = HEADING_RE.exec(line);
    if (match) {
      const dateMatch = /-\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(line);
      headings.push({ name: match[1], date: dateMatch ? dateMatch[1] : null, lineIdx: idx });
    }
  });
  return headings;
}

// Finds the "## [name] ..." heading and the body between it and the
// next heading/link-reference block/EOF. `name` is "Unreleased" or a
// plain version string like "0.2.0".
export function findSection(text, name) {
  const lines = text.split('\n');
  const startIdx = lines.findIndex((line) => {
    const match = HEADING_RE.exec(line);
    return match && match[1] === name;
  });
  if (startIdx === -1) {
    return null;
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    if (isBoundary(lines[i])) {
      endIdx = i;
      break;
    }
  }
  const body = lines.slice(startIdx + 1, endIdx).join('\n').trim();
  return { startIdx, endIdx, body, lines };
}
