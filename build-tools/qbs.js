#!/usr/bin/env node
const fs = require("fs");
const https = require("https");
const url = require("url");
const path = require("path");
const net = require("net");

const fport = (port) =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(port, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
const clients = [];
const mimes = Object.entries(require("./types.json")).reduce(
  (all, [type, exts]) =>
    Object.assign(all, ...exts.map((ext) => ({ [ext]: type }))),
  {}
);
const watchScript = `
    <script>
        const watch = new EventSource("/watch");
        const reload = () => location.reload(true);
        watch.onmessage = e => {
        if (e.data === "reload") {
            console.log('reloading')
            location.reload(true);
        }
        console.log(e);
        };
        watch.onerror = e => console.log(e);
        console.log("Ready, listening to file changes");
    </script>
`;

const open =
  process.platform == "darwin"
    ? "open"
    : process.platform == "win32"
    ? "start"
    : "xdg-open";
const watch =
  process.platform === "linux"
    ? (path, cb) => {
        if (fs.statSync(path).isDirectory()) {
          fs.watch(path, cb);
          fs.readdirSync(path).forEach((entry) =>
            watch(`${path}/${entry}`, cb)
          );
        }
      }
    : (path, cb) => fs.watch(path, { recursive: true }, cb);
(async () => {
  const args = process.argv.slice(2);
  const root = args[0];
  const link = args[1];
  port = await fport(443);

  const options = {
    key: fs.readFileSync("./build-tools/key.pem"),
    cert: fs.readFileSync("./build-tools/cert.pem"),
  };
  const server = (cb) => https.createServer(options, cb);
  const sendError = (res, status) => {
    res.writeHead(status);
    res.end();
  };
  const sendMessage = (res, channel, data) => {
    res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`);
    res.write("\n\n");
  };
  const sendFile = (res, file, ext) => {
    res.writeHead(200, {
      "Content-Type": mimes[ext] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });
    // add doctype and charset since some chars might otherwise not work
    if (ext === "html")
      file = `<!DOCTYPE html><meta charset="UTF-8"/>${watchScript}${file}`;
    res.write(file, "binary");
    res.end();
  };

  server((req, res) => {
    // if just a root folder, try the index.html
    const requestUrl = req.url.match(/\./) ? req.url : req.url + "/index.html";
    const pathname = url.parse(requestUrl).pathname;
    if (pathname.match(/watch/)) {
      res.writeHead(200, {
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });
      sendMessage(res, "connected", "ready");
      setInterval(sendMessage, 60000, res, "ping", "waiting");
      clients.push(res);
    } else {
      const uri = path.join(root, decodeURI(pathname));
      const ext = uri.replace(/^.*[\.\/\\]/, "").toLowerCase();
      fs.stat(uri, (err) => {
        if (err) return sendError(res, 404);
        fs.readFile(uri, "binary", (err, file) => {
          if (err) return sendError(res, 500);
          sendFile(res, file, ext);
        });
      });
    }
  }).listen(parseInt(port, 10));

  watch(root, () => {
    while (clients.length > 0) sendMessage(clients.pop(), "message", "reload");
  });
  process.on("SIGINT", () => {
    while (clients.length > 0) clients.pop().end();
    process.exit();
  });
  console.log(`
    Let's Go!
    Serving from: ${root}
    Opening:  ${link}`);
  require("child_process").execSync(`${open} ${link}`);
})();
