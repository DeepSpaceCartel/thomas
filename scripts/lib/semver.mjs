const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function parse(version) {
  const match = VERSION_RE.exec(version);
  if (!match) {
    throw new Error(`Not a plain MAJOR.MINOR.PATCH version: "${version}"`);
  }
  const [, major, minor, patch] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

export function format({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

export function bumpPatch(version) {
  const v = parse(version);
  return format({ ...v, patch: v.patch + 1 });
}

export function bumpMinorResetPatch(version) {
  const v = parse(version);
  return format({ major: v.major, minor: v.minor + 1, patch: 0 });
}

export function compare(a, b) {
  const va = parse(a);
  const vb = parse(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}
