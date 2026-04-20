const { spawn } = require("child_process");
const os = require("os");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const proxyPort = process.env.LIMPAE_PROXY_PORT || "8787";
const proxyTarget = process.env.LIMPAE_PROXY_TARGET || "https://limpae-jcqa.onrender.com";

const getLanAddress = () => {
  const interfaces = os.networkInterfaces();

  for (const values of Object.values(interfaces)) {
    for (const entry of values || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return "127.0.0.1";
};

const lanAddress = getLanAddress();
const proxyUrl = `http://${lanAddress}:${proxyPort}`;
const isWindows = process.platform === "win32";
const extraExpoArgs = process.argv.slice(2);

console.log(`[limpae expo-proxy] backend: ${proxyTarget}`);
console.log(`[limpae expo-proxy] proxy:   ${proxyUrl}`);

const proxyProcess = spawn(
  process.execPath,
  [path.join(rootDir, "scripts", "api-proxy.js")],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      LIMPAE_PROXY_HOST: "0.0.0.0",
      LIMPAE_PROXY_PORT: proxyPort,
      LIMPAE_PROXY_TARGET: proxyTarget,
    },
  },
);

const expoEnv = {
  ...process.env,
  EXPO_PUBLIC_API_URL: proxyUrl,
};
const expoProcess = isWindows
  ? spawn(
      "cmd.exe",
      ["/d", "/s", "/c", `npx expo start${extraExpoArgs.length ? ` ${extraExpoArgs.join(" ")}` : ""}`],
      {
        cwd: rootDir,
        stdio: "inherit",
        env: expoEnv,
      },
    )
  : spawn(
      "npx",
      ["expo", "start", ...extraExpoArgs],
      {
        cwd: rootDir,
        stdio: "inherit",
        env: expoEnv,
      },
    );

const shutdown = () => {
  if (!proxyProcess.killed) {
    proxyProcess.kill();
  }
  if (!expoProcess.killed) {
    expoProcess.kill();
  }
};

proxyProcess.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`[limpae expo-proxy] proxy exited with code ${code}`);
  }
});

expoProcess.on("exit", (code) => {
  shutdown();
  process.exit(code || 0);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
