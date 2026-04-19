#!/usr/bin/env node

const dns = require("node:dns/promises");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const OSS = require("ali-oss");
const convert = require("heic-convert");
const { exiftoolPath } = require("exiftool-vendored");

const execFileAsync = promisify(execFile);

const DEFAULT_SUFFIX = "converted";
const DEFAULT_INPUT_DIR = "input";
const DEFAULT_OUTPUT_DIR = "output";
const DEFAULT_QUALITY = 90;
const INPUT_EXTENSIONS = new Set([".heic", ".heif"]);
const RIGHT_ANGLE_ORIENTATIONS = new Set([5, 6, 7, 8]);

function parseArgs(argv) {
  const options = {
    dryRun: false,
    inputDir: DEFAULT_INPUT_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    quality: DEFAULT_QUALITY,
    suffix: DEFAULT_SUFFIX,
    stripGps: false,
    uploadOnly: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--upload-only") {
      options.uploadOnly = true;
      continue;
    }

    if (arg === "--strip-gps") {
      options.stripGps = true;
      continue;
    }

    if (arg.startsWith("--quality=")) {
      options.quality = Number(arg.slice("--quality=".length));
      continue;
    }

    if (arg.startsWith("--input-dir=")) {
      options.inputDir = arg.slice("--input-dir=".length).trim() || DEFAULT_INPUT_DIR;
      continue;
    }

    if (arg.startsWith("--suffix=")) {
      options.suffix = sanitizeSuffix(arg.slice("--suffix=".length));
      continue;
    }

    if (arg.startsWith("--output-dir=")) {
      options.outputDir = arg.slice("--output-dir=".length).trim() || DEFAULT_OUTPUT_DIR;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100) {
    throw new Error("quality must be a number between 1 and 100");
  }

  if (!options.suffix) {
    throw new Error("suffix cannot be empty");
  }

  return options;
}

function sanitizeSuffix(value) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sanitizeBaseName(value) {
  return value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "photo";
}

function formatOutputName(inputFileName, suffix) {
  const parsed = path.parse(inputFileName);
  const match = /^IMG_(\d+)$/i.exec(parsed.name);
  const stem = match ? `IMG_${match[1]}` : sanitizeBaseName(parsed.name);
  return `${stem}_${suffix}.jpg`;
}

function normalizePrefix(prefix) {
  return (prefix || "").trim().replace(/^\/+|\/+$/g, "");
}

function normalizeRegion(region) {
  const trimmed = String(region || "").trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^oss-/i.test(trimmed)) {
    return trimmed;
  }

  if (/^cn-/i.test(trimmed)) {
    return `oss-${trimmed}`;
  }

  return trimmed;
}

function extractHostName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname;
    } catch (error) {
      return "";
    }
  }

  return trimmed.replace(/^\/+|\/+$/g, "").split("/")[0];
}

function parseOssBindingHost(hostName) {
  const match = /^([^.]+)\.(oss-[^.]+)\.aliyuncs\.com\.?$/i.exec(String(hostName || "").trim());
  if (!match) {
    return null;
  }

  return {
    bucket: match[1],
    region: match[2],
  };
}

async function inferOssBindingFromPublicDomain(publicDomain) {
  const hostName = extractHostName(publicDomain);
  if (!hostName) {
    return {};
  }

  try {
    const records = await dns.resolveCname(hostName);

    for (const record of records) {
      const binding = parseOssBindingHost(record);
      if (binding) {
        return {
          ...binding,
          sourceHost: hostName,
        };
      }
    }
  } catch (error) {
    return {};
  }

  return {};
}

async function listInputFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && INPUT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

async function listOutputFiles(outputDir) {
  try {
    const entries = await fs.readdir(outputDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".jpg")
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "en"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function runExifTool(args) {
  const binary = await exiftoolPath();
  const { stdout, stderr } = await execFileAsync(
    binary,
    ["-charset", "filename=utf8", ...args],
    { windowsHide: true }
  );

  if (stderr && stderr.trim()) {
    process.stderr.write(stderr);
  }

  return stdout;
}

async function readMetadata(filePath) {
  const stdout = await runExifTool([
    "-j",
    "-n",
    "-Orientation#",
    "-ImageWidth#",
    "-ImageHeight#",
    "-DateTimeOriginal",
    "-CreateDate",
    "-Make",
    "-Model",
    "-GPSLatitude#",
    "-GPSLongitude#",
    filePath,
  ]);
  const rows = JSON.parse(stdout);
  return rows[0] || {};
}

async function copyMetadata(sourcePath, outputPath) {
  await runExifTool([
    "-overwrite_original",
    "-TagsFromFile",
    sourcePath,
    "-all:all",
    "-unsafe",
    "-icc_profile",
    outputPath,
  ]);
}

async function setOrientation(outputPath, orientation) {
  await runExifTool([
    "-overwrite_original",
    `-Orientation#=${orientation}`,
    outputPath,
  ]);
}

async function stripGpsMetadata(outputPath) {
  await runExifTool([
    "-overwrite_original",
    "-gps:all=",
    outputPath,
  ]);
}

async function maybeNormalizeOrientation(sourceMeta, outputPath) {
  const sourceOrientation = Number(sourceMeta.Orientation || 1);
  if (!RIGHT_ANGLE_ORIENTATIONS.has(sourceOrientation)) {
    return false;
  }

  const sourceWidth = Number(sourceMeta.ImageWidth || 0);
  const sourceHeight = Number(sourceMeta.ImageHeight || 0);
  const outputMeta = await readMetadata(outputPath);
  const outputWidth = Number(outputMeta.ImageWidth || 0);
  const outputHeight = Number(outputMeta.ImageHeight || 0);

  const pixelsAlreadyRotated =
    sourceWidth > 0 &&
    sourceHeight > 0 &&
    outputWidth === sourceHeight &&
    outputHeight === sourceWidth;

  if (!pixelsAlreadyRotated) {
    return false;
  }

  await setOrientation(outputPath, 1);
  return true;
}

async function convertFile(sourcePath, outputPath, quality) {
  const sourceBuffer = await fs.readFile(sourcePath);
  const outputBuffer = await convert({
    buffer: sourceBuffer,
    format: "JPEG",
    quality: quality / 100,
  });

  await fs.writeFile(outputPath, outputBuffer);
}

async function getUploadConfig() {
  const {
    OSS_ACCESS_KEY_ID,
    OSS_ACCESS_KEY_SECRET,
    OSS_BUCKET,
    OSS_REGION,
    OSS_ENDPOINT,
    OSS_PREFIX,
    OSS_PUBLIC_DOMAIN,
    OSS_STS_TOKEN,
  } = process.env;

  const normalizedRegion = normalizeRegion(OSS_REGION);
  const inferredBinding =
    (!OSS_BUCKET || (!normalizedRegion && !OSS_ENDPOINT)) && OSS_PUBLIC_DOMAIN
      ? await inferOssBindingFromPublicDomain(OSS_PUBLIC_DOMAIN)
      : {};
  const resolvedBucket = OSS_BUCKET || inferredBinding.bucket;
  const resolvedRegion = OSS_ENDPOINT ? undefined : normalizedRegion || inferredBinding.region;
  const missing = [];
  if (!OSS_ACCESS_KEY_ID) missing.push("OSS_ACCESS_KEY_ID");
  if (!OSS_ACCESS_KEY_SECRET) missing.push("OSS_ACCESS_KEY_SECRET");
  if (!resolvedBucket) missing.push("OSS_BUCKET");
  if (!resolvedRegion && !OSS_ENDPOINT) missing.push("OSS_REGION or OSS_ENDPOINT");

  if (missing.length > 0) {
    return { enabled: false, missing };
  }

  return {
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    bucket: resolvedBucket,
    enabled: true,
    endpoint: OSS_ENDPOINT || undefined,
    prefix: normalizePrefix(OSS_PREFIX),
    publicDomain: OSS_PUBLIC_DOMAIN || undefined,
    region: resolvedRegion,
    stsToken: OSS_STS_TOKEN || undefined,
    inferredFromDomain: !OSS_BUCKET || !normalizedRegion ? inferredBinding.sourceHost : undefined,
  };
}

function buildPublicUrl(publicDomain, objectKey) {
  if (!publicDomain) {
    return null;
  }

  const trimmed = publicDomain.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return `${withProtocol.replace(/\/+$/g, "")}/${objectKey.replace(/^\/+/g, "")}`;
}

function createOssClient(config) {
  const options = {
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    secure: true,
  };

  if (config.endpoint) {
    options.endpoint = config.endpoint;
  } else {
    options.region = config.region;
  }

  if (config.stsToken) {
    options.stsToken = config.stsToken;
  }

  return new OSS(options);
}

async function uploadFiles(config, outputDir, fileNames) {
  const client = createOssClient(config);
  const uploaded = [];

  for (const fileName of fileNames) {
    const localPath = path.join(outputDir, fileName);
    const objectKey = config.prefix ? `${config.prefix}/${fileName}` : fileName;

    const result = await client.put(objectKey, localPath, {
      headers: {
        "Content-Type": "image/jpeg",
      },
    });

    uploaded.push({
      fileName,
      objectKey,
      publicUrl: buildPublicUrl(config.publicDomain, objectKey),
      url: result.url || client.signatureUrl(objectKey, { expires: 60 }),
    });
    console.log(`uploaded ${fileName} -> oss://${config.bucket}/${objectKey}`);
    if (uploaded[uploaded.length - 1].publicUrl) {
      console.log(`public ${uploaded[uploaded.length - 1].publicUrl}`);
    }
  }

  return uploaded;
}

async function buildPlan(inputDir, outputDir, suffix, uploadOnly) {
  if (uploadOnly) {
    const outputFiles = await listOutputFiles(outputDir);
    if (outputFiles.length === 0) {
      throw new Error(`No JPG files found in ${outputDir}. Run conversion first or remove --upload-only.`);
    }

    return outputFiles.map((fileName) => ({
      fileName,
      outputPath: path.join(outputDir, fileName),
      sourcePath: null,
      sourceFileName: null,
    }));
  }

  const inputFiles = await listInputFiles(inputDir);
  if (inputFiles.length === 0) {
    throw new Error(`No .HEIC or .HEIF files were found in ${inputDir}.`);
  }

  return inputFiles.map((fileName) => ({
    fileName: formatOutputName(fileName, suffix),
    outputPath: path.join(outputDir, formatOutputName(fileName, suffix)),
    sourcePath: path.join(inputDir, fileName),
    sourceFileName: fileName,
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const inputDir = path.resolve(rootDir, options.inputDir);
  const outputDir = path.resolve(rootDir, options.outputDir);
  const plan = await buildPlan(inputDir, outputDir, options.suffix, options.uploadOnly);

  console.log(`quality=${options.quality}, suffix=${options.suffix}, inputDir=${inputDir}, outputDir=${outputDir}`);
  for (const item of plan) {
    if (item.sourceFileName) {
      console.log(`${item.sourceFileName} -> ${item.fileName}`);
    } else {
      console.log(`ready to upload ${item.fileName}`);
    }
  }

  if (options.dryRun) {
    return;
  }

  if (!options.uploadOnly) {
    await fs.mkdir(outputDir, { recursive: true });

    for (const item of plan) {
      const sourceMeta = await readMetadata(item.sourcePath);

      await convertFile(item.sourcePath, item.outputPath, options.quality);
      await copyMetadata(item.sourcePath, item.outputPath);

      const orientationNormalized = await maybeNormalizeOrientation(sourceMeta, item.outputPath);
      if (options.stripGps) {
        await stripGpsMetadata(item.outputPath);
      }
      const outputMeta = await readMetadata(item.outputPath);
      console.log(
        `created ${item.fileName} (${outputMeta.ImageWidth}x${outputMeta.ImageHeight}, orientation=${outputMeta.Orientation || 1}${orientationNormalized ? ", normalized" : ""})`
      );
    }
  }

  const uploadConfig = await getUploadConfig();
  if (!uploadConfig.enabled) {
    console.log(`OSS upload skipped. Missing: ${uploadConfig.missing.join(", ")}`);
    return;
  }

  if (uploadConfig.inferredFromDomain) {
    console.log(
      `resolved OSS binding from ${uploadConfig.inferredFromDomain}: bucket=${uploadConfig.bucket}, region=${uploadConfig.region}`
    );
  }

  await uploadFiles(
    uploadConfig,
    outputDir,
    plan.map((item) => item.fileName)
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
