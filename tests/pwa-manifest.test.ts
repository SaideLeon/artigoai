import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifest from "../app/manifest";

describe("PWA Manifest & Assets", () => {
  it("defines valid standalone PWA metadata and required icon sizes", () => {
    const data = manifest();

    assert.equal(data.id, "/");
    assert.equal(data.scope, "/");
    assert.equal(data.start_url, "/studio");
    assert.equal(data.display, "standalone");
    assert.ok(data.short_name && data.short_name.length <= 12);
    assert.equal(data.theme_color, "#5B4AF4");
    assert.equal(data.background_color, "#F4F6FB");

    const icons = data.icons ?? [];
    assert.ok(
      icons.some(
        (i) =>
          i.src === "/pwa-192x192.png" &&
          i.sizes === "192x192" &&
          i.type === "image/png" &&
          i.purpose === "any"
      )
    );
    assert.ok(
      icons.some(
        (i) =>
          i.src === "/pwa-512x512.png" &&
          i.sizes === "512x512" &&
          i.type === "image/png" &&
          i.purpose === "any"
      )
    );
    assert.ok(
      icons.some(
        (i) =>
          i.src === "/pwa-maskable-512x512.png" &&
          i.sizes === "512x512" &&
          i.type === "image/png" &&
          i.purpose === "maskable"
      )
    );
  });

  it("includes generated PNG icons and service worker in public/", () => {
    const root = process.cwd();
    const requiredFiles = [
      "public/pwa-192x192.png",
      "public/pwa-512x512.png",
      "public/pwa-maskable-512x512.png",
      "public/apple-touch-icon.png",
      "public/sw.js",
    ];
    for (const rel of requiredFiles) {
      const full = path.join(root, rel);
      assert.ok(fs.existsSync(full), `Missing ${rel}`);
      assert.ok(fs.statSync(full).size > 0, `Empty ${rel}`);
    }
  });
});
