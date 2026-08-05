import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const IMAGE_ROOT = path.resolve(process.cwd(), "public", "images");
const CONVERTIBLE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

const summary = {
  converted: 0,
  skipped: 0,
  failed: 0,
  originalBytes: 0,
  webpBytes: 0,
};

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function displayPath(filePath) {
  return path.relative(process.cwd(), filePath) || filePath;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function convertImage(sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();

  if (!CONVERTIBLE_EXTENSIONS.has(extension)) {
    summary.skipped += 1;
    return;
  }

  const outputPath = path.join(
    path.dirname(sourcePath),
    `${path.basename(sourcePath, path.extname(sourcePath))}.webp`,
  );

  try {
    const originalStats = await stat(sourcePath);

    await sharp(sourcePath)
      .rotate()
      .resize({
        width: 1200,
        withoutEnlargement: true,
      })
      .webp({ quality: 78, effort: 4 })
      .toFile(outputPath);

    const webpStats = await stat(outputPath);

    summary.converted += 1;
    summary.originalBytes += originalStats.size;
    summary.webpBytes += webpStats.size;

    console.log(`Original: ${displayPath(sourcePath)}`);
    console.log(`WebP:    ${displayPath(outputPath)}`);
    console.log(`Size:    ${formatBytes(originalStats.size)} -> ${formatBytes(webpStats.size)}`);
    console.log("");
  } catch (error) {
    summary.failed += 1;
    console.error(`Failed to convert: ${displayPath(sourcePath)}`, error);
  }
}

async function main() {
  const files = (await collectFiles(IMAGE_ROOT)).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const filePath of files) {
    await convertImage(filePath);
  }

  const savedBytes = summary.originalBytes - summary.webpBytes;
  const savedPercentage =
    summary.originalBytes > 0
      ? (savedBytes / summary.originalBytes) * 100
      : 0;

  console.log("Image optimization summary");
  console.log(`Converted: ${summary.converted}`);
  console.log(`Skipped:   ${summary.skipped}`);
  console.log(`Failed:    ${summary.failed}`);
  console.log(`Original total: ${formatBytes(summary.originalBytes)}`);
  console.log(`WebP total:     ${formatBytes(summary.webpBytes)}`);
  console.log(`Saved:          ${savedPercentage.toFixed(2)}%`);
}

main().catch((error) => {
  console.error(`Unable to scan image directory: ${displayPath(IMAGE_ROOT)}`, error);
  process.exitCode = 1;
});
