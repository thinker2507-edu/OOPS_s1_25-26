"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("../tools/vendor/typescript/typescript.cjs");
const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("Frontend build does not follow symbolic links.");
    }
    return entry.isDirectory() ? walk(filename) : [filename];
  });
}
function buildFrontend() {
  const destination = path.join(FRONTEND, "dist");
  const realFrontend = fs.realpathSync(FRONTEND);
  const realProject = fs.realpathSync(ROOT);
  if (!realFrontend.startsWith(realProject + path.sep)) {
    throw new Error("Frontend directory is outside this project.");
  }
  if (fs.existsSync(destination)) {
    const realDestination = fs.realpathSync(destination);
    if (fs.lstatSync(destination).isSymbolicLink() || !realDestination.startsWith(realFrontend + path.sep)) {
      throw new Error("Refusing to replace an external or linked build directory.");
    }
    fs.rmSync(destination, {
      recursive: true,
      force: true
    });
  }
  fs.mkdirSync(destination, { recursive: true });
  const manifest = {};
  const appearance = fs.readFileSync(path.join(FRONTEND, "src", "lib", "accessibility.js"), "utf8");
  const appearanceSource = ts.createSourceFile("accessibility.js", appearance, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const bootstrap = ts.factory.updateSourceFile(appearanceSource, appearanceSource.statements.filter((node) => !ts.isExportDeclaration(node)));
  const bootstrapContents = Buffer.from("(() => {\n" + ts.createPrinter().printFile(bootstrap) +
    "\napplyPreferences(document, readPreferences(), systemPreferences());\n})();\n");
  fs.writeFileSync(path.join(destination, "appearance-bootstrap.js"), bootstrapContents);
  manifest["/appearance-bootstrap.js"] = {
    file: "appearance-bootstrap.js",
    contentType: "text/javascript",
    sha256: crypto.createHash("sha256").update(bootstrapContents).digest("hex")
  };
  const sources = [
    ...walk(path.join(FRONTEND, "src")),
    ...walk(path.join(FRONTEND, "public")),
    ...walk(path.join(FRONTEND, "styles")),
    path.join(FRONTEND, "index.html"),
  ];
  for (const source of sources) {
    const basename = path.basename(source).toLowerCase();
    if (basename === ".env" || basename.startsWith(".env.") || basename === "credentials.json" ||
      /^client_secret.*\.json$/.test(basename)) {
      throw new Error("Private configuration must not be placed in frontend source or public assets.");
    }
    let relative = path.relative(FRONTEND, source).replaceAll("\\", "/");
    if (relative.startsWith("public/")) {
      relative = relative.slice("public/".length);
    }
    let contents = fs.readFileSync(source);
    if (source.endsWith(".jsx")) {
      const compiled = ts.transpileModule(contents.toString("utf8"), {
        fileName: source,
        reportDiagnostics: true,
        compilerOptions: {
          jsx: ts.JsxEmit.React,
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
          newLine: ts.NewLineKind.LineFeed
        }
      });
      const errors = compiled.diagnostics.filter((entry) => entry.category === ts.DiagnosticCategory.Error);
      if (errors.length) {
        throw new Error("JSX build failed: " + relative);
      }
      relative = relative.replace(/\.jsx$/, ".js");
      contents = Buffer.from(compiled.outputText);
    }
    const output = path.resolve(destination, relative);
    if (!output.startsWith(destination + path.sep)) {
      throw new Error("Invalid build output path.");
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, contents);
    const extensions = {
      ".js": "text/javascript",
      ".css": "text/css",
      ".html": "text/html",
      ".svg": "image/svg+xml",
      ".txt": "text/plain"
    };
    manifest["/" + relative] = {
      file: relative,
      contentType: extensions[path.extname(relative)] || "application/octet-stream",
      sha256: crypto.createHash("sha256").update(contents).digest("hex")
    };
  }
  fs.writeFileSync(path.join(destination, "asset-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("Built " + Object.keys(manifest).length + " frontend assets.");
  return manifest;
}
if (require.main === module) {
  buildFrontend();
}
module.exports = { buildFrontend };
