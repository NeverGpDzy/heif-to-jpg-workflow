const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  buildPlan,
  buildReplacementPlan,
  formatOutputName,
  parseArgs,
  shouldUpload,
} = require("../scripts/process-photos");

async function withTempDir(run) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "heif-to-jpg-"));

  try {
    return await run(tempDir);
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

test("parseArgs defaults to local conversion without upload", () => {
  const options = parseArgs([]);

  assert.equal(options.upload, false);
  assert.equal(options.uploadOnly, false);
  assert.equal(shouldUpload(options), false);
});

test("parseArgs enables explicit batch upload with --upload", () => {
  const options = parseArgs(["--upload", "--suffix=旅行"]);

  assert.equal(options.upload, true);
  assert.equal(options.suffix, "旅行");
  assert.equal(shouldUpload(options), true);
});

test("formatOutputName preserves Unicode file names and suffixes", () => {
  assert.equal(formatOutputName("海边日落.HEIC", "旅行"), "海边日落_旅行.jpg");
  assert.equal(formatOutputName("聚会-01.HEIC", "2026春"), "聚会-01_2026春.jpg");
});

test("buildPlan keeps readable Unicode output names", async () => {
  await withTempDir(async (tempDir) => {
    const inputDir = path.join(tempDir, "input");
    const outputDir = path.join(tempDir, "output");

    await fs.mkdir(inputDir, { recursive: true });
    await fs.writeFile(path.join(inputDir, "海边日落.HEIC"), "");
    await fs.writeFile(path.join(inputDir, "DSC 0001.JPG"), "");

    const plan = await buildPlan(inputDir, outputDir, "旅行", false);
    const fileNames = plan.map((item) => item.fileName).sort();

    assert.deepEqual(fileNames, ["DSC_0001_旅行.jpg", "海边日落_旅行.jpg"]);
  });
});

test("buildReplacementPlan matches replacement URLs against Unicode output names", async () => {
  await withTempDir(async (tempDir) => {
    const inputDir = path.join(tempDir, "input");
    const outputDir = path.join(tempDir, "output");
    const replaceFromPath = path.join(tempDir, "replace-urls.txt");
    const expectedFileName = "海边日落_旅行.jpg";
    const replacementUrl = `https://img.example.com/trips/${encodeURIComponent(expectedFileName)}`;

    await fs.mkdir(inputDir, { recursive: true });
    await fs.writeFile(path.join(inputDir, "海边日落.HEIC"), "");
    await fs.writeFile(replaceFromPath, `${replacementUrl}\n`, "utf8");

    const plan = await buildReplacementPlan(inputDir, outputDir, "旅行", replaceFromPath);

    assert.equal(plan.length, 1);
    assert.equal(plan[0].fileName, expectedFileName);
    assert.equal(plan[0].objectKey, `trips/${expectedFileName}`);
    assert.equal(path.basename(plan[0].outputPath), expectedFileName);
  });
});

test("shouldUpload stays true for explicit upload modes", () => {
  assert.equal(shouldUpload(parseArgs(["--upload-only"])), true);
  assert.equal(shouldUpload(parseArgs(["--replace-from=replace-urls.txt"])), true);
});
