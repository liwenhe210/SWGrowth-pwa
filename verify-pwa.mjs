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
const verifyDelay = Number(process.env.VERIFY_DELAY || 1400);
const verifyTab = process.env.VERIFY_TAB || "";
const seedDemo = process.env.VERIFY_SEED === "1";
const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const profile = join(root, `.chrome-profile-cdp-${port}-${viewportWidth}x${viewportHeight}`);
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
  await delay(verifyDelay);
  if (seedDemo) {
    await client.send("Runtime.evaluate", {
      expression: `(() => {
        const keyFromDate = (date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const d = String(date.getDate()).padStart(2, "0");
          return y + "-" + m + "-" + d;
        };
        const addDays = (date, days) => {
          const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          copy.setDate(copy.getDate() + days);
          return copy;
        };
        const today = new Date();
        const records = {};
        [-4, -3, -2, -1, 0].forEach((offset, index) => {
          const date = keyFromDate(addDays(today, offset));
          records[date] = {
            date,
            entries: {
              health_sleep: index > 1 ? "done" : "partial",
              health_food: "partial",
              health_move: index % 2 ? "done" : "none",
              mind_awareness: "done",
              mind_recovery: index > 2 ? "done" : "partial",
              mind_support: index === 2 ? "done" : "partial",
              study_focus: "done",
              study_input: index < 3 ? "done" : "partial",
              study_output: index > 1 ? "done" : "partial"
            },
            isProtectionDay: false,
            reflection: index === 2 ? "有点内耗，但还是写完了实验记录" : "今天完成了一段可见输出",
            satisfaction: Math.min(5, 2 + index),
            tags: ["论文", index > 1 ? "输出" : "文献"],
            settledAt: new Date().toISOString()
          };
        });
        localStorage.setItem("sanwei-growth-pwa:v1", JSON.stringify({
          records,
          rewards: [],
          weeklyFocus: "提高可见输出",
          weeklyGoal: 21,
          cooldownUntil: null,
          lastPenaltyWeekKey: null,
          repairCompletions: []
        }));
        location.reload();
      })()`
    });
    await delay(900);
  }
  if (verifyTab) {
    await client.send("Runtime.evaluate", {
      expression: `document.querySelector('[data-tab="${verifyTab}"]')?.click()`
    });
    await delay(400);
  }

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
        activeTab: document.querySelector(".tab-btn.is-active")?.textContent.trim() || "",
        topHTML: document.querySelector(".top-actions")?.innerHTML || "",
        scripts: [...document.scripts].map((script) => script.src || "inline"),
        topActions: [...document.querySelectorAll(".top-actions button")].map((button) => button.textContent.trim()),
        charts: document.querySelectorAll(".chart-card").length,
        historyItems: document.querySelectorAll(".record-item").length,
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
