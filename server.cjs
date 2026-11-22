"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { main } = require("./backend/src/server.cjs");
if (require.main === module) {
  try {
    const build = spawnSync(process.execPath, [path.join(__dirname, "scripts", "build-frontend.cjs")], {
      stdio: "inherit",
      windowsHide: true
    });
    if (build.error) {
      throw build.error;
    }
    if (build.status !== 0) {
      throw new Error("Frontend build failed. Check the message above.");
    }
    main().catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { main };
