/**
 * Capture location-change manual screenshots for nl, en, and fr.
 * Requires: npm run dev (localhost:3000) and playwright.
 *
 * Usage: node scripts/capture-location-change-manual-shots.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manualsDir = path.resolve(__dirname, "../public/manuals");

const LOCALES = ["nl", "en", "fr"];
const SHOTS = [
  { id: "open-change", file: "captain-location-01-open-change.png" },
  { id: "propose-change", file: "captain-location-02-propose-change.png" },
  { id: "approve-change", file: "captain-location-03-approve-change.png" },
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

  await page
    .addStyleTag({
      content: `
      nextjs-portal,
      [data-next-mark],
      [data-nextjs-toast],
      #__next-build-watcher {
        display: none !important;
      }
    `,
    })
    .catch(() => {});

  for (const locale of LOCALES) {
    await page.goto(
      `http://localhost:3000/dev/location-change-manual-shots?locale=${locale}`,
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

    for (const shot of SHOTS) {
      const el = page.locator(`#shot-${shot.id}`);
      await el.scrollIntoViewIfNeeded();
      const file = path.join(manualsDir, locale, shot.file);
      await el.screenshot({ path: file, type: "png" });
      console.log("wrote", file);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
