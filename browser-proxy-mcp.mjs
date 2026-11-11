import { spawn } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

const pluginRoot = join(
  homedir(), ".codex", "plugins", "cache", "openai-bundled", "unified-computer-use"
);
const runtimeRoot = join(homedir(), "AppData", "Local", "OpenAI", "Codex", "runtimes", "cua_node");
const entrySuffix = join("@oai", "cua-repl", "bin", "cua-repl.mjs").toLowerCase();
const proxy = "http://127.0.0.1:7897";

async function findCurrentServer() {
  const versions = (await readdir(pluginRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  for (const version of versions) {
    try {
      const configPath = join(pluginRoot, version, ".mcp.json");
      const config = JSON.parse(await readFile(configPath, "utf8"));
      const server = config?.mcpServers?.cua_repl;
      if (typeof server?.command !== "string" || !Array.isArray(server.args) ||
          !server.args.every((arg) => typeof arg === "string") ||
          typeof server.env !== "object" ||
          server.env.BROWSER_USE_CODEX_APP_VERSION !== version) continue;

      const executable = resolve(server.command);
      const entryPointArg = server.args.find((arg) =>
        resolve(arg).toLowerCase().endsWith(entrySuffix)
      );
      if (!entryPointArg) continue;
      const entryPoint = resolve(entryPointArg);
      const runtimePrefix = resolve(runtimeRoot).toLowerCase() + sep;
      if (!executable.toLowerCase().startsWith(runtimePrefix) ||
          !entryPoint.toLowerCase().startsWith(runtimePrefix) ||
          !entryPoint.toLowerCase().endsWith(entrySuffix)) continue;
      await access(executable);
      await access(entryPoint);
      return { version, configPath, server, executable, entryPoint };
    } catch {
      // A version can be removed while Codex updates its plugin cache.
    }
  }
  throw new Error("No current Codex Browser MCP runtime was found");
}

try {
  const { version, configPath, server, executable, entryPoint } = await findCurrentServer();
  const allowed = new Set(
    (server.env.NODE_REPL_UNTRUSTED_ENV_ALLOWLIST ?? "")
      .split(",").map((name) => name.trim()).filter(Boolean)
  );
  for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "NODE_USE_ENV_PROXY"])
    allowed.add(name);

  const env = {
    ...process.env,
    ...server.env,
    HTTP_PROXY: proxy,
    HTTPS_PROXY: proxy,
    NO_PROXY: "localhost,127.0.0.1,::1",
    NODE_USE_ENV_PROXY: "1",
    NODE_REPL_UNTRUSTED_ENV_ALLOWLIST: [...allowed].join(",")
  };

  if (process.argv.includes("--self-test")) {
    process.stdout.write(JSON.stringify({
      version,
      configPath,
      executable,
      entryPoint,
      proxy,
      allowlist: env.NODE_REPL_UNTRUSTED_ENV_ALLOWLIST
    }) + "\n");
  } else {
    const child = spawn(executable, server.args, { env, stdio: "inherit", windowsHide: true });
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
      process.on(signal, () => child.kill(signal));
    child.once("error", (error) => {
      process.stderr.write(`Browser proxy MCP could not start: ${error.message}\n`);
      process.exitCode = 1;
    });
    child.once("close", (code) => {
      process.exitCode = code === 0 ? 0 : 1;
    });
  }
} catch (error) {
  process.stderr.write(`Browser proxy MCP setup failed: ${error.message}\n`);
  process.exitCode = 1;
}
