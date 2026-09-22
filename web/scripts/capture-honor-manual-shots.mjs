/**
 * Capture Honor lineup manual screenshots for nl, en, and fr.
 * Requires: npm run dev (localhost:3000) and playwright.
 *
 * Usage: node scripts/capture-honor-manual-shots.mjs
 */
import { chromium } from "playwright";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manualsDir = path.resolve(__dirname, "../public/manuals");

const LOCALES = ["nl", "en", "fr"];
const SHOTS = [
  "open-match",
  "phase-rules",
  "fill-seats",
  "substitutes",
  "lock-lineup",
  "after-lock",
];

async function main() {
  for (const locale of LOCALES) {
    await mkdir(path.join(manualsDir, locale), { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 480, height: 1200 },
    deviceScaleFactor: 2,
  });

  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-next-mark],
      [data-nextjs-toast],
      #__next-build-watcher {
        display: none !important;
      }
    `,
  }).catch(() => {});

  for (const locale of LOCALES) {
    await page.goto(
      `http://localhost:3000/dev/honor-manual-shots?locale=${locale}`,
      { waitUntil: "networkidle" },
    );
    await page.addStyleTag({
      content: `
        nextjs-portal,
        [data-next-mark],
        [data-nextjs-toast],
        #__next-build-watcher {
          display: none !important;
        }
      `,
    });

    for (const id of SHOTS) {
      const el = page.locator(`#shot-${id}`);
      await el.scrollIntoViewIfNeeded();
      const file = path.join(
        manualsDir,
        locale,
        `honor-lineup-${id}.png`,
      );
      await el.screenshot({ path: file, type: "png" });
      console.log("wrote", file);
    }
  }

  // Remove legacy unscoped honor shots if present.
  for (const id of SHOTS) {
    const legacy = path.join(manualsDir, `honor-lineup-${id}.png`);
    try {
      await unlink(legacy);
      console.log("removed legacy", legacy);
    } catch {
      // ignore
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
