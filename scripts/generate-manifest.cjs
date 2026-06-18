/**
 * Scans public/properties/* folders and builds public/properties/manifest.json
 * mapping each property ID to every image and video file inside its folder.
 *
 * This runs automatically on every deploy (see netlify.toml / vercel.json), so
 * when you drop new photos/videos into a property's folder they appear on the
 * site with no code changes. Each listing's folder is matched by its unique ID.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "public", "properties");
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];
function rank(name) {
  // Surface exterior/elevation shots first so they become the cover image.
  const n = name.toLowerCase();
  if (n.includes("exterior") || n.includes("elevation")) return 0;
  if (n.includes("standard") || n.includes("front")) return 1;
  return 2;
}
function build() {
  const manifest = {};
  if (!fs.existsSync(ROOT)) {
    console.log("[manifest] no properties directory found at", ROOT);
    return manifest;
  }
  const ids = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const id of ids) {
    const dir = path.join(ROOT, id);
    const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
    const images = files
      .filter((f) => IMAGE_EXT.includes(path.extname(f).toLowerCase()))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    const videos = files
      .filter((f) => VIDEO_EXT.includes(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
    const enc = (f) => "/public/properties/" + id + "/" + encodeURIComponent(f);
    manifest[id] = {
      images: images.map(enc),
      videos: videos.map(enc),
      cover: images.length ? enc(images[0]) : "",
    };
  }
  return manifest;
}
const manifest = build();
if (!fs.existsSync(ROOT)) {
  console.log("[manifest] skipping write — properties directory does not exist yet");
  process.exit(0);
}
const out = path.join(ROOT, "manifest.json");
fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(
  "[manifest] wrote",
  out,
  "with",
  Object.keys(manifest).length,
  "properties"
);
