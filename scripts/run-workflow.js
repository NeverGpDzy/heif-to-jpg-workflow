#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout, env } = require("node:process");
const { spawn } = require("node:child_process");

const DEFAULT_CONFIG_SOURCE = "key.txt";
const DEFAULT_QUALITY = "90";
const DEFAULT_SUFFIX = "FriendsMeet";
const DEFAULT_PREFIX = "FriendsMeet";
const DEFAULT_INPUT_DIR = "input";
const DEFAULT_OUTPUT_DIR = "output";
const DEFAULT_PUBLIC_DOMAIN = "picture.nevergpdzy.cn";
const DEFAULT_OSS_BUCKET = "nevergpdzy-picture";
const DEFAULT_OSS_REGION = "oss-cn-chengdu";

function createPrompt() {
  return readline.createInterface({
    input: stdin,
    output: stdout,
  });
}

function normalizeYesNo(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return fallback;
  if (["y", "yes", "1", "true"].includes(text)) return true;
  if (["n", "no", "0", "false"].includes(text)) return false;
  return fallback;
}

function sanitizeValue(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9/_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeDomain(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch (error) {
    return trimmed.toLowerCase().replace(/^\/+|\/+$/g, "").split("/")[0];
  }
}

function applyDefaultBinding(sourceEnv) {
  const resolvedEnv = { ...sourceEnv };
  const publicDomain = resolvedEnv.OSS_PUBLIC_DOMAIN || DEFAULT_PUBLIC_DOMAIN;

  if (normalizeDomain(publicDomain) === DEFAULT_PUBLIC_DOMAIN) {
    resolvedEnv.OSS_PUBLIC_DOMAIN = publicDomain;
    resolvedEnv.OSS_BUCKET = resolvedEnv.OSS_BUCKET || DEFAULT_OSS_BUCKET;
    resolvedEnv.OSS_REGION = resolvedEnv.OSS_REGION || DEFAULT_OSS_REGION;
  }

  return resolvedEnv;
}

async function askWithDefault(rl, label, fallback) {
  const answer = await rl.question(`${label} [${fallback}]: `);
  return answer.trim() || fallback;
}

function mapConfigKey(rawKey) {
  const normalized = String(rawKey || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  switch (normalized) {
    case "accesskeyid":
    case "ossaccesskeyid":
      return "OSS_ACCESS_KEY_ID";
    case "accesskeysecret":
    case "ossaccesskeysecret":
      return "OSS_ACCESS_KEY_SECRET";
    case "bucket":
    case "ossbucket":
      return "OSS_BUCKET";
    case "region":
    case "ossregion":
      return "OSS_REGION";
    case "endpoint":
    case "ossendpoint":
      return "OSS_ENDPOINT";
    case "prefix":
    case "ossprefix":
      return "OSS_PREFIX";
    case "publicdomain":
    case "domain":
    case "osspublicdomain":
      return "OSS_PUBLIC_DOMAIN";
    case "ststoken":
    case "ossststoken":
      return "OSS_STS_TOKEN";
    default:
      return null;
  }
}

function parseConfigLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = /^([^=\s:]+)\s*(?:=|:|\s)\s*(.+)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const envKey = mapConfigKey(match[1]);
  if (!envKey) {
    return null;
  }

  return [envKey, match[2].trim()];
}

async function loadConfigFile(configPath) {
  const resolvedPath = path.resolve(process.cwd(), configPath);
  const content = await fs.readFile(resolvedPath, "utf8");
  const fileEnv = {};

  for (const line of content.split(/\r?\n/)) {
    const entry = parseConfigLine(line);
    if (!entry) {
      continue;
    }

    const [key, value] = entry;
    fileEnv[key] = value;
  }

  return {
    env: fileEnv,
    label: path.relative(process.cwd(), resolvedPath) || resolvedPath,
  };
}

async function resolveConfigSource(selection) {
  const trimmed = String(selection || "").trim();
  const normalized = trimmed.toLowerCase();

  if (!trimmed || normalized === "default" || normalized === DEFAULT_CONFIG_SOURCE.toLowerCase()) {
    return loadConfigFile(DEFAULT_CONFIG_SOURCE);
  }

  if (["env", "environment"].includes(normalized)) {
    return {
      env: {},
      label: "environment",
    };
  }

  if (["none", "skip", "off"].includes(normalized)) {
    return {
      env: {},
      label: "none",
    };
  }

  return loadConfigFile(trimmed);
}

async function runNodeScript(scriptPath, args, extraEnv) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: { ...env, ...extraEnv },
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`workflow exited with code ${code}`));
    });
  });
}

async function main() {
  const rl = createPrompt();

  try {
    console.log("This workflow will scan the current directory for HEIC/HEIF photos.");
    console.log("Choose a config source first. Press Enter to load key.txt.");

    const configSource = await askWithDefault(
      rl,
      "Config source (key.txt, env, none, or custom file path)",
      DEFAULT_CONFIG_SOURCE
    );
    const config = await resolveConfigSource(configSource);
    const resolvedEnv = applyDefaultBinding({ ...env, ...config.env });

    const qualityText = await askWithDefault(rl, "JPEG quality (recommended 82-90)", DEFAULT_QUALITY);
    const suffix = sanitizeValue(await askWithDefault(rl, "Filename suffix", DEFAULT_SUFFIX));
    const prefix = sanitizeValue(await askWithDefault(rl, "OSS folder/prefix", resolvedEnv.OSS_PREFIX || DEFAULT_PREFIX));
    const inputDir = sanitizeValue(await askWithDefault(rl, "Local input folder", DEFAULT_INPUT_DIR));
    const outputDir = sanitizeValue(await askWithDefault(rl, "Local output folder", DEFAULT_OUTPUT_DIR));
    const stripGps = normalizeYesNo(await askWithDefault(rl, "Remove GPS metadata from output? (y/n)", "y"), true);
    const uploadDefault = resolvedEnv.OSS_ACCESS_KEY_ID && resolvedEnv.OSS_ACCESS_KEY_SECRET ? "y" : "n";
    const uploadNow = normalizeYesNo(await askWithDefault(rl, "Upload to OSS now? (y/n)", uploadDefault), uploadDefault === "y");
    const publicDomain = uploadNow
      ? (await askWithDefault(
          rl,
          "Public domain for returned links (blank to skip)",
          resolvedEnv.OSS_PUBLIC_DOMAIN || DEFAULT_PUBLIC_DOMAIN
        )).trim()
      : "";

    const quality = Number(qualityText);
    if (!Number.isFinite(quality) || quality < 1 || quality > 100) {
      throw new Error("JPEG quality must be between 1 and 100.");
    }

    if (!suffix) {
      throw new Error("Suffix cannot be empty.");
    }

    if (!outputDir) {
      throw new Error("Output folder cannot be empty.");
    }

    if (!inputDir) {
      throw new Error("Input folder cannot be empty.");
    }

    const processScript = path.join(process.cwd(), "scripts", "process-photos.js");
    const processArgs = [
      `--quality=${quality}`,
      `--suffix=${suffix}`,
      `--input-dir=${inputDir}`,
      `--output-dir=${outputDir}`,
    ];

    if (stripGps) {
      processArgs.push("--strip-gps");
    }

    const extraEnv = {
      ...resolvedEnv,
      OSS_PREFIX: "",
      OSS_PUBLIC_DOMAIN: "",
    };
    if (uploadNow) {
      if (!prefix) {
        throw new Error("OSS folder/prefix cannot be empty when upload is enabled.");
      }

      extraEnv.OSS_PREFIX = prefix;
      if (publicDomain) {
        extraEnv.OSS_PUBLIC_DOMAIN = publicDomain;
      }
    } else {
      extraEnv.OSS_ACCESS_KEY_ID = "";
      extraEnv.OSS_ACCESS_KEY_SECRET = "";
      extraEnv.OSS_BUCKET = "";
      extraEnv.OSS_REGION = "";
      extraEnv.OSS_ENDPOINT = "";
      extraEnv.OSS_STS_TOKEN = "";
    }

    console.log("");
    console.log("Running conversion with:");
    console.log(`- config=${config.label}`);
    console.log(`- quality=${quality}`);
    console.log(`- suffix=${suffix}`);
    console.log(`- inputDir=${inputDir}`);
    console.log(`- outputDir=${outputDir}`);
    console.log(`- stripGps=${stripGps}`);
    console.log(`- uploadNow=${uploadNow}`);
    if (uploadNow) {
      console.log(`- ossPrefix=${prefix}`);
      if (publicDomain) {
        console.log(`- publicDomain=${publicDomain}`);
      }
      if (resolvedEnv.OSS_BUCKET) {
        console.log(`- ossBucket=${resolvedEnv.OSS_BUCKET}`);
      }
      if (resolvedEnv.OSS_REGION) {
        console.log(`- ossRegion=${resolvedEnv.OSS_REGION}`);
      }
    }
    console.log("");

    await runNodeScript(processScript, processArgs, extraEnv);
  } finally {
    await rl.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
