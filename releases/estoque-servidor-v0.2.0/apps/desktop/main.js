const { app, BrowserWindow, dialog } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const WEB_PORT = 5173;
const API_HEALTH_URL = "http://127.0.0.1:3000/api/health";
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};
let webServer;

function resourcePath(...parts) {
  return path.join(process.resourcesPath, ...parts);
}

function userServerPath() {
  return path.join(app.getPath("userData"), "server");
}

function ensureServerFiles() {
  const source = resourcePath("server");
  const target = userServerPath();
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
  const envPath = path.join(target, ".env");
  if (!fs.existsSync(envPath)) {
    const secret = `${Date.now()}-${Math.random().toString(36).slice(2)}-estoque`;
    fs.writeFileSync(envPath, [
      "NODE_ENV=production",
      "PORT=3000",
      "JWT_SECRET=" + secret,
      "POSTGRES_USER=estoque",
      "POSTGRES_PASSWORD=estoque",
      "POSTGRES_DB=estoque",
      "POSTGRES_PORT=55432",
      "WEB_ORIGIN=http://localhost:5173,http://127.0.0.1:5173"
    ].join("\n"), "utf8");
  } else {
    const env = fs.readFileSync(envPath, "utf8");
    if (env.includes("POSTGRES_PORT=5433")) {
      fs.writeFileSync(envPath, env.replace("POSTGRES_PORT=5433", "POSTGRES_PORT=55432"), "utf8");
    }
  }
  return target;
}

function runDocker(serverPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["compose", "--project-name", "estoque-desktop", "--project-directory", serverPath, "up", "-d", "--build"], {
      cwd: serverPath,
      windowsHide: true
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", () => reject(new Error("Docker Desktop não está instalado ou não está aberto.")));
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(output.slice(-2000) || "Falha ao iniciar o servidor Docker.")));
  });
}

function waitForApi() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const request = http.get(API_HEALTH_URL, (response) => {
        response.resume();
        if (response.statusCode === 200) return resolve();
        retry();
      });
      request.on("error", retry);
      request.setTimeout(3000, () => { request.destroy(); retry(); });
    };
    const retry = () => {
      attempts += 1;
      if (attempts >= 45) return reject(new Error("A API não respondeu após iniciar o servidor."));
      setTimeout(check, 2000);
    };
    check();
  });
}

function isApiAvailable() {
  return new Promise((resolve) => {
    const request = http.get(API_HEALTH_URL, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function startWebServer() {
  const webRoot = resourcePath("web");
  webServer = http.createServer((request, response) => {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]);
    const relative = requested === "/" ? "index.html" : requested.replace(/^[/\\]+/, "");
    const file = path.resolve(webRoot, relative);
    if (!file.startsWith(path.resolve(webRoot))) {
      response.writeHead(403).end();
      return;
    }
    fs.stat(file, (error, stats) => {
      const actual = !error && stats.isFile() ? file : path.join(webRoot, "index.html");
      fs.readFile(actual, (readError, content) => {
        if (readError) response.writeHead(404).end();
        else {
          response.writeHead(200, {
            "Content-Type": MIME_TYPES[path.extname(actual).toLowerCase()] || "application/octet-stream"
          });
          response.end(content);
        }
      });
    });
  });
  return new Promise((resolve) => webServer.listen(WEB_PORT, "127.0.0.1", resolve));
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: "Estoque"
  });
  window.once("ready-to-show", () => window.show());
  try {
    const serverPath = ensureServerFiles();
    if (!(await isApiAvailable())) {
      await runDocker(serverPath);
      await waitForApi();
    }
    await startWebServer();
    window.webContents.on("did-fail-load", (_event, code, description) => {
      dialog.showMessageBox(window, {
        type: "error",
        title: "Falha ao carregar o Estoque",
        message: `${description} (${code})`,
        detail: "O painel web não conseguiu carregar dentro do aplicativo."
      });
    });
    await window.loadURL(`http://127.0.0.1:${WEB_PORT}`);
  } catch (error) {
    await dialog.showMessageBox(window, {
      type: "error",
      title: "Não foi possível iniciar o Estoque",
      message: error instanceof Error ? error.message : "Erro desconhecido.",
      detail: "Abra o Docker Desktop e tente novamente."
    });
    window.destroy();
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  if (webServer) webServer.close();
});
