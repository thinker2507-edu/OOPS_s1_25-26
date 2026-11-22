"use strict";
const fs = require("node:fs");
const path = require("node:path");
class FrontendAssets {
  constructor(projectRoot) {
    this.directory = path.join(projectRoot, "frontend", "dist");
    const manifest = path.join(this.directory, "asset-manifest.json");
    this.assets = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")) : {};
  }
  find(pathname, page = false) {
    const key = page ? "/index.html" : pathname === "/" ? "/index.html" : pathname;
    if (!Object.hasOwn(this.assets, key)) {
      return null;
    }
    const asset = this.assets[key];
    const filename = path.resolve(this.directory, asset.file);
    if (!filename.startsWith(this.directory + path.sep) || !fs.existsSync(filename)) {
      return null;
    }
    return {
      filename,
      contentType: asset.contentType
    };
  }
}
module.exports = { FrontendAssets };
