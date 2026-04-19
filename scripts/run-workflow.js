#!/usr/bin/env node

const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout, env } = require("node:process");
const { spawn } = require("node:child_process");

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

async function askWithDefault(rl, label, fallback) {
  const answer = await rl.question(`${label} [${fallback}]: `);
  return answer.trim() || fallback;
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

    const qualityText = await askWithDefault(rl, "JPEG quality (recommended 82-90)", "85");
    const suffix = sanitizeValue(await askWithDefault(rl, "Filename suffix", "FriendsMeet"));
    const prefix = sanitizeValue(await askWithDefault(rl, "OSS folder/prefix", "FriendsMeet"));
    const inputDir = sanitizeValue(await askWithDefault(rl, "Local input folder", "input"));
    const outputDir = sanitizeValue(await askWithDefault(rl, "Local output folder", "output"));
    const stripGps = normalizeYesNo(await askWithDefault(rl, "Remove GPS metadata from output? (y/n)", "y"), true);
    const uploadNow = normalizeYesNo(await askWithDefault(rl, "Upload to OSS now? (y/n)", "y"), true);
    const publicDomain = uploadNow
      ? (await askWithDefault(
          rl,
          "Public domain for returned links (blank to skip)",
          env.OSS_PUBLIC_DOMAIN || "picture.nevergpdzy.cn"
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
