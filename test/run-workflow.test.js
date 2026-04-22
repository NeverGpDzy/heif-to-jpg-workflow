const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildProcessInvocation,
  normalizePathInput,
  normalizePrefixInput,
  sanitizeOutputToken,
} = require("../scripts/run-workflow");

test("normalizePathInput preserves spaces and dots in local directories", () => {
  assert.equal(normalizePathInput("  My Photos\\April 2026  "), "My Photos\\April 2026");
  assert.equal(normalizePathInput(" output.v2 "), "output.v2");
});

test("normalizePrefixInput converts Windows separators without stripping Unicode", () => {
  assert.equal(normalizePrefixInput(" Travel\\青岛\\album/ "), "Travel/青岛/album");
});

test("sanitizeOutputToken keeps Unicode suffixes readable", () => {
  assert.equal(sanitizeOutputToken("  旅行 2026  "), "旅行_2026");
  assert.equal(sanitizeOutputToken("朋友聚会!"), "朋友聚会");
});

test("buildProcessInvocation preserves local-only runs without upload flags", () => {
  const invocation = buildProcessInvocation({
    inputDir: "My Photos\\April 2026",
    outputDir: "output.v2",
    prefix: "Travel/青岛",
    publicDomain: "",
    quality: 90,
    resolvedEnv: {
      OSS_ACCESS_KEY_ID: "ak",
      OSS_ACCESS_KEY_SECRET: "sk",
    },
    stripGps: false,
    suffix: "旅行",
    uploadNow: false,
    usesQuality: true,
  });

  assert.deepEqual(invocation.processArgs, [
    "--quality=90",
    "--suffix=旅行",
    "--input-dir=My Photos\\April 2026",
    "--output-dir=output.v2",
  ]);
  assert.equal(invocation.extraEnv.OSS_PREFIX, undefined);
});

test("buildProcessInvocation adds --upload only when explicitly requested", () => {
  const invocation = buildProcessInvocation({
    inputDir: "input",
    outputDir: "output",
    prefix: "Travel/青岛",
    publicDomain: "img.example.com",
    quality: 90,
    resolvedEnv: {
      OSS_ACCESS_KEY_ID: "ak",
      OSS_ACCESS_KEY_SECRET: "sk",
      OSS_PREFIX: "old-prefix",
      OSS_PUBLIC_DOMAIN: "old.example.com",
    },
    stripGps: true,
    suffix: "旅行",
    uploadNow: true,
    usesQuality: true,
  });

  assert.deepEqual(invocation.processArgs, [
    "--quality=90",
    "--suffix=旅行",
    "--input-dir=input",
    "--output-dir=output",
    "--strip-gps",
    "--upload",
  ]);
  assert.equal(invocation.extraEnv.OSS_PREFIX, "Travel/青岛");
  assert.equal(invocation.extraEnv.OSS_PUBLIC_DOMAIN, "img.example.com");
});

test("buildProcessInvocation requires a non-empty prefix when upload is enabled", () => {
  assert.throws(() => buildProcessInvocation({
    inputDir: "input",
    outputDir: "output",
    prefix: "",
    publicDomain: "",
    quality: 90,
    resolvedEnv: {},
    stripGps: false,
    suffix: "旅行",
    uploadNow: true,
    usesQuality: false,
  }), /OSS folder\/prefix cannot be empty/);
});
