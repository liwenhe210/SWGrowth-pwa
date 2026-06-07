import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const appURL = process.argv[2] || "http://127.0.0.1:5173/";
const port = Number(process.env.CDP_PORT || 9223);
const viewportWidth = Number(process.env.VERIFY_WIDTH || 390);
const viewportHeight = Number(process.env.VERIFY_HEIGHT || 844);
const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const profile = join(root, ".chrome-profile-cdp");
const screenshotPath = join(root, `pwa-cdp-${viewportWidth}x${viewportHeight}.png`);

mkdirSync(profile, { recursive: true });

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-crash-reporter",
  "--disable-crashpad",
  "--disable-breakpad",
  "--no-first-run",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank"
], { stdio: "ignore" });

try {
  const target = await waitForTarget();
  const client = await createCDPClient(target.webSocketDebuggerUrl);

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: 1,
    mobile: viewportWidth < 700
  });
  await client.send("Page.navigate", { url: appURL });
  await delay(1400);

  const metrics = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const firstSegment = [...document.querySelectorAll(".segmented button")].slice(0, 3);
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        title: document.querySelector(".brand-title")?.textContent || "",
        tabs: [...document.querySelectorAll(".tab-btn")].map((button) => button.textContent.trim()),
        firstSegment: firstSegment.map((button) => ({
          text: button.textContent.trim(),
          right: Math.round(button.getBoundingClientRect().right)
        }))
      };
    })()`
  });

  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));

  await client.close();
  console.log(JSON.stringify({ ...metrics.result.value, screenshotPath }, null, 2));
} finally {
  chrome.kill();
}

function waitForTarget() {
  return retry(async () => {
    const list = await httpJSON(`http://127.0.0.1:${port}/json/list`);
    const target = list.find((item) => item.type === "page");
    if (!target?.webSocketDebuggerUrl) throw new Error("No page target yet");
    return target;
  }, 40, 150);
}

function httpJSON(url) {
  return new Promise((resolveJSON, reject) => {
    get(url, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        try {
          resolveJSON(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function createCDPClient(url) {
  return new Promise((resolveClient, reject) => {
    const socket = new WebSocket(url);
    let sequence = 0;
    const pending = new Map();

    socket.addEventListener("open", () => {
      resolveClient({
        send(method, params = {}) {
          const id = ++sequence;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCommand, rejectCommand) => {
            pending.set(id, { resolveCommand, rejectCommand });
          });
        },
        close() {
          socket.close();
        }
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const callbacks = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callbacks.rejectCommand(new Error(message.error.message));
      else callbacks.resolveCommand(message.result || {});
    });

    socket.addEventListener("error", reject);
  });
}

async function retry(task, attempts, waitMS) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await delay(waitMS);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
