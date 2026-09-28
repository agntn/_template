import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { resolveAppPaths, version } from "../src/index.ts";

describe("template-ts", () => {
  it("exports version", () => {
    expect(version).toBe("0.0.0");
  });
});

describe("resolveAppPaths", () => {
  it("resolves paths for app name", () => {
    const paths = resolveAppPaths("test-app");

    expect(paths.config).toContain("test-app");
    expect(paths.data).toContain("test-app");
    expect(paths.cache).toContain("test-app");
  });

  it("uses XDG_CONFIG_HOME when set", () => {
    const original = process.env["XDG_CONFIG_HOME"];
    process.env["XDG_CONFIG_HOME"] = "/tmp/xdg-config";

    try {
      const paths = resolveAppPaths("myapp");
      if (process.platform !== "darwin" && process.platform !== "win32") {
        expect(paths.config).toBe(join("/tmp/xdg-config", "myapp"));
      }
    } finally {
      if (original === undefined) {
        delete process.env["XDG_CONFIG_HOME"];
      } else {
        process.env["XDG_CONFIG_HOME"] = original;
      }
    }
  });

  it("respects env override", () => {
    process.env["MYAPP_DATA_DIR"] = "/custom/data";

    try {
      const paths = resolveAppPaths("myapp");
      expect(paths.data).toBe("/custom/data");
    } finally {
      delete process.env["MYAPP_DATA_DIR"];
    }
  });

  it("falls back to home directory defaults", () => {
    const paths = resolveAppPaths("fallback-app");
    const home = homedir();

    expect(paths.config.startsWith(home)).toBe(true);
    expect(paths.data.startsWith(home)).toBe(true);
    expect(paths.cache.startsWith(home)).toBe(true);
  });
});
