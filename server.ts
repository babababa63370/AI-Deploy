import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import http from "http";
import { spawn, ChildProcess } from "child_process";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import httpProxy from "http-proxy";

const runningProcesses = new Map<string, ChildProcess>();
const proxy = httpProxy.createProxyServer({});

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.set("trust proxy", 1);
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Database Setup
  const db = new Database("deployments.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, cf_token TEXT, cf_zone TEXT);
    INSERT OR IGNORE INTO settings (id, cf_token, cf_zone) VALUES ('default', '', '');
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY, name TEXT, source TEXT, status TEXT,
      installCommand TEXT, buildCommand TEXT, startCommand TEXT,
      domain TEXT, logs TEXT, port INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // API Routes
  app.get("/api/settings", (req, res) => {
    const settings = db
      .prepare("SELECT * FROM settings WHERE id = ?")
      .get("default");
    res.json(settings);
  });

  // Recover running processes
  const recoverProcesses = () => {
    const deployments = db
      .prepare("SELECT * FROM deployments WHERE status = 'Running'")
      .all() as any[];
    for (const dep of deployments) {
      if (dep.startCommand && dep.port > 0) {
        console.log(`[System] Recovering deployment: ${dep.id} on port ${dep.port}`);
        const workDir = path.join(process.cwd(), "deployments", dep.id);
        if (fs.existsSync(workDir)) {
          const proc = spawn(dep.startCommand, [], {
            cwd: workDir,
            shell: true,
            env: { ...process.env, PORT: dep.port.toString() },
          });
          runningProcesses.set(dep.id, proc);
          proc.on("error", (err) => {
            console.error(`[System] Failed to recover ${dep.id}:`, err);
            db.prepare("UPDATE deployments SET status = 'Failed' WHERE id = ?").run(dep.id);
          });
          proc.on("close", (code) => {
            if (code !== 0 && code !== null) {
              console.log(`[System] Recovered process ${dep.id} exited with code ${code}`);
            }
            runningProcesses.delete(dep.id);
          });
        }
      }
    }
  };
  recoverProcesses();

  app.post("/api/settings", (req, res) => {
    const { cf_token, cf_zone } = req.body;
    db.prepare(
      "UPDATE settings SET cf_token = ?, cf_zone = ? WHERE id = ?",
    ).run(cf_token || "", cf_zone || "", "default");
    res.json({ success: true });
  });

  app.get("/api/deployments/:id", (req, res) => {
    try {
      const deployment = db
        .prepare("SELECT * FROM deployments WHERE id = ?")
        .get(req.params.id) as any;
      if (deployment) {
        res.json({
          ...deployment,
          logs: deployment.logs ? JSON.parse(deployment.logs) : [],
        });
      } else {
        res.status(404).json({ error: "Not found" });
      }
    } catch (e) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/deployments/:id", (req, res) => {
    const { installCommand, buildCommand, startCommand, status, domain } =
      req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (installCommand !== undefined) {
      updates.push("installCommand = ?");
      params.push(installCommand);
    }
    if (buildCommand !== undefined) {
      updates.push("buildCommand = ?");
      params.push(buildCommand);
    }
    if (startCommand !== undefined) {
      updates.push("startCommand = ?");
      params.push(startCommand);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (domain !== undefined) {
      updates.push("domain = ?");
      params.push(domain);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      db.prepare(
        `UPDATE deployments SET ${updates.join(", ")} WHERE id = ?`,
      ).run(...params);
    }
    res.json({ success: true });
  });

  app.delete("/api/deployments/:id", (req, res) => {
    try {
      const id = req.params.id;
      // 1. Kill running process if any
      const proc = runningProcesses.get(id);
      if (proc) {
        proc.kill();
        runningProcesses.delete(id);
      }

      // 2. Delete from DB
      db.prepare("DELETE FROM deployments WHERE id = ?").run(id);

      // 3. Delete files
      const workDir = path.join(process.cwd(), "deployments", id);
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }

      res.json({ success: true });
    } catch (e) {
      console.error("Failed to delete deployment", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/deployments", (req, res) => {
    try {
      const deployments = db
        .prepare("SELECT * FROM deployments ORDER BY createdAt DESC")
        .all();
      res.json(
        deployments.map((d: any) => ({
          ...d,
          logs: d.logs ? JSON.parse(d.logs) : [],
        })),
      );
    } catch (e) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/deployments", (req, res) => {
    const {
      id,
      name,
      source,
      installCommand,
      buildCommand,
      startCommand,
      domain,
    } = req.body;
    db.prepare(
      `
      INSERT INTO deployments (id, name, source, status, installCommand, buildCommand, startCommand, domain, logs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id,
      name,
      source,
      "Deploying",
      installCommand,
      buildCommand,
      startCommand,
      domain,
      "[]",
    );
    res.json({ success: true });
  });

  app.post("/api/cloudflare/dns", async (req, res) => {
    const { domain, target, type = "CNAME", proxied = true } = req.body;
    const settings = db
      .prepare("SELECT * FROM settings WHERE id = ?")
      .get("default") as any;

    if (!settings.cf_token || !settings.cf_zone) {
      return res
        .status(400)
        .json({ error: "Cloudflare credentials not configured" });
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${settings.cf_zone}/dns_records`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.cf_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            name: domain,
            content: target,
            proxied,
          }),
        },
      );
      const data = await response.json();
      if (data.success) {
        res.json({ success: true, data: data.result });
      } else {
        res.status(400).json({
          error: data.errors[0]?.message || "Failed to create DNS record",
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cloudflare/dns", async (req, res) => {
    const settings = db
      .prepare("SELECT * FROM settings WHERE id = ?")
      .get("default") as any;

    if (!settings.cf_token || !settings.cf_zone) {
      return res
        .status(400)
        .json({ error: "Cloudflare credentials not configured" });
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${settings.cf_zone}/dns_records?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${settings.cf_token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        res.json({ success: true, records: data.result });
      } else {
        res.status(400).json({
          error: data.errors[0]?.message || "Failed to fetch DNS records",
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/cloudflare/dns/:id", async (req, res) => {
    const settings = db
      .prepare("SELECT * FROM settings WHERE id = ?")
      .get("default") as any;

    if (!settings.cf_token || !settings.cf_zone) {
      return res
        .status(400)
        .json({ error: "Cloudflare credentials not configured" });
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${settings.cf_zone}/dns_records/${req.params.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${settings.cf_token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({
          error: data.errors[0]?.message || "Failed to delete DNS record",
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // WebSocket for Terminal and Deployment Logs
  wss.on("connection", (ws) => {
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "execute") {
          const { command, cwd } = data.payload;
          const proc = spawn(command, [], {
            cwd: cwd || process.cwd(),
            shell: true,
          });

          proc.stdout.on("data", (d) =>
            ws.send(JSON.stringify({ type: "log", data: d.toString() })),
          );
          proc.stderr.on("data", (d) =>
            ws.send(JSON.stringify({ type: "log", data: d.toString() })),
          );
          proc.on("close", (code) =>
            ws.send(JSON.stringify({ type: "exit", code })),
          );
        }

        if (data.type === "deploy") {
          const { id, source, installCommand, buildCommand, startCommand } =
            data.payload;

          // Clear existing logs
          db.prepare("UPDATE deployments SET logs = ? WHERE id = ?").run(
            "[]",
            id,
          );

          const sendLog = (log: string) => {
            ws.send(JSON.stringify({ type: "deploy_log", id, log }));
            // Persist log to DB
            try {
              const current = db
                .prepare("SELECT logs FROM deployments WHERE id = ?")
                .get(id) as any;
              const logs = JSON.parse(current.logs || "[]");
              logs.push(log);
              db.prepare("UPDATE deployments SET logs = ? WHERE id = ?").run(
                JSON.stringify(logs),
                id,
              );
            } catch (e) {
              console.error("Failed to persist log", e);
            }
          };

          const workDir = path.join(process.cwd(), "deployments", id);
          fs.mkdirSync(workDir, { recursive: true });

          // Assign a port (simple increment for now)
          const lastPort = db
            .prepare("SELECT MAX(port) as maxPort FROM deployments")
            .get() as any;
          const nextPort = Math.max(4000, (lastPort?.maxPort || 3999) + 1);
          db.prepare("UPDATE deployments SET port = ? WHERE id = ?").run(
            nextPort,
            id,
          );

          const runCmd = (cmd: string, isStart = false) =>
            new Promise<void>((resolve, reject) => {
              if (!cmd) return resolve();
              sendLog(`\n> ${cmd}\n`);

              // Kill existing process if re-deploying
              if (isStart) {
                const oldProc = runningProcesses.get(id);
                if (oldProc) {
                  oldProc.kill();
                  runningProcesses.delete(id);
                }
              }

              const proc = spawn(cmd, [], {
                cwd: workDir,
                shell: true,
                env: { ...process.env, PORT: nextPort.toString() },
              });

              if (isStart) {
                runningProcesses.set(id, proc);
                // For start command, we don't wait for it to close
                // We just wait a bit to see if it crashes immediately
                let crashed = false;
                const timeout = setTimeout(() => {
                  if (!crashed) resolve();
                }, 2000);

                proc.on("error", (err) => {
                  crashed = true;
                  clearTimeout(timeout);
                  reject(err);
                });

                proc.on("close", (code) => {
                  crashed = true;
                  clearTimeout(timeout);
                  if (code !== 0 && code !== null) {
                    sendLog(`\n[Process Exit] Command exited with code ${code}\n`);
                  }
                });

                proc.stdout.on("data", (d) => sendLog(d.toString()));
                proc.stderr.on("data", (d) => sendLog(d.toString()));
                return;
              }

              proc.stdout.on("data", (d) => sendLog(d.toString()));
              proc.stderr.on("data", (d) => sendLog(d.toString()));
              proc.on("close", (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Command failed with code ${code}`));
              });
            });

          try {
            if (source.startsWith("http")) {
              await runCmd(`git clone ${source} .`);
            } else {
              sendLog(`> Using local path ${source}\n`);
            }

            await runCmd(installCommand);
            await runCmd(buildCommand);

            sendLog(`\n> Starting application on port ${nextPort}...\n`);
            await runCmd(startCommand, true);

            sendLog(`\n[System] App is now running on port ${nextPort}.\n`);

            db.prepare("UPDATE deployments SET status = ? WHERE id = ?").run(
              "Running",
              id,
            );
            ws.send(
              JSON.stringify({ type: "deploy_status", id, status: "Running" }),
            );
          } catch (err: any) {
            sendLog(`\n[Error] ${err.message}\n`);
            db.prepare("UPDATE deployments SET status = ? WHERE id = ?").run(
              "Failed",
              id,
            );
            ws.send(
              JSON.stringify({ type: "deploy_status", id, status: "Failed" }),
            );
          }
        }
      } catch (e) {
        console.error("WebSocket message error", e);
      }
    });
  });

  // Virtual Host Middleware
  app.use((req, res, next) => {
    const host = req.hostname.toLowerCase();
    // Skip for API and default dashboard
    if (
      host.includes("run.app") ||
      host === "localhost" ||
      req.path.startsWith("/api")
    ) {
      return next();
    }

    // Try matching the domain, including handling www.
    const possibleDomains = [host];
    if (host.startsWith("www.")) {
      possibleDomains.push(host.substring(4));
    } else {
      possibleDomains.push(`www.${host}`);
    }

    let deployment = null;
    for (const domain of possibleDomains) {
      deployment = db
        .prepare(
          "SELECT * FROM deployments WHERE domain = ? AND status = 'Running'",
        )
        .get(domain) as any;
      if (deployment) break;
    }

    if (deployment) {
      console.log(
        `[VHost] Serving domain: ${host} for deployment: ${deployment.id}`,
      );
      const deployDir = path.join(process.cwd(), "deployments", deployment.id);

      // Try to find the build output directory
      const buildDirs = [
        "dist/public",
        "dist",
        "build",
        "public",
        "out",
        "client/dist",
        "client/build",
        ".",
      ];

      let staticDir = deployDir;
      for (const dir of buildDirs) {
        const fullPath = path.join(deployDir, dir);
        if (
          fs.existsSync(fullPath) &&
          fs.statSync(fullPath).isDirectory() &&
          fs.readdirSync(fullPath).length > 0
        ) {
          // Check if it contains an index.html or at least some files
          if (dir !== ".") {
            staticDir = fullPath;
            break;
          }
        }
      }

      console.log(`[VHost] Static directory resolved to: ${staticDir}`);

      // Try to proxy to the app's port if it has one
      if (deployment.port > 0) {
        return proxy.web(
          req,
          res,
          { target: `http://localhost:${deployment.port}` },
          (err) => {
            // If proxy fails, fallback to static files
            console.log(
              `[VHost] Proxy to port ${deployment.port} failed, falling back to static: ${err.message}`,
            );
            serveStatic();
          },
        );
      }

      function serveStatic() {
        // Serve static files
        return express.static(staticDir, {
          fallthrough: true,
          index: "index.html",
        })(req, res, (err) => {
          if (err) {
            console.error(`[VHost] Error serving static files: ${err}`);
            return next();
          }

          // Fallback to index.html for SPA support
          const indexPath = path.join(staticDir, "index.html");
          if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
          }

          // If no index.html and static failed, we might want to show a custom 404
          res.status(404).send(`
          <html>
            <body style="background: #09090b; color: #fafafa; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
              <div style="text-align: center; border: 1px solid #27272a; padding: 2rem; rounded: 1rem; background: #18181b;">
                <h1 style="color: #ef4444;">404 - Not Found</h1>
                <p style="color: #a1a1aa;">The deployment was found, but no content could be served.</p>
                <p style="font-size: 0.8rem; color: #71717a;">Deployment ID: ${deployment.id}</p>
              </div>
            </body>
          </html>
        `);
        });
      }

      serveStatic();
      return;
    }

    // If no deployment found for this domain
    if (!host.includes("run.app") && host !== "localhost") {
      return res.status(404).send(`
        <html>
          <body style="background: #09090b; color: #fafafa; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center; border: 1px solid #27272a; padding: 2rem; rounded: 1rem; background: #18181b;">
              <h1 style="color: #f59e0b;">Domain Not Configured</h1>
              <p style="color: #a1a1aa;">The domain <strong>${host}</strong> is not associated with any running deployment.</p>
              <p style="font-size: 0.8rem; color: #71717a;">Please check your dashboard settings.</p>
            </div>
          </body>
        </html>
      `);
    }

    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
