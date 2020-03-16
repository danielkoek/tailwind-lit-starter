#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const url = require('url');
const path = require('path');
const net = require('net');

const fport = port =>
    new Promise((resolve, reject) => {
        const s = net.createServer();
        s.on('error', reject);
        s.listen(port, () => {
            const { port } = s.address();
            s.close(() => resolve(port));
        });
    });

const mimes = Object.entries(require('./types.json')).reduce(
    (all, [type, exts]) =>
        Object.assign(all, ...exts.map(ext => ({ [ext]: type }))),
    {}
);

const open =
    process.platform == 'darwin'
        ? 'open'
        : process.platform == 'win32'
        ? 'start'
        : 'xdg-open';

(async () => {
    const args = process.argv.slice(2);
    const root = args[0];
    const link = args[1];
    port = await fport(443);

    const options = {
        key: fs.readFileSync('./build-tools/key.pem'),
        cert: fs.readFileSync('./build-tools/cert.pem')
    };
    const server = cb => https.createServer(options, cb);
    const sendError = (res, status) => {
        res.writeHead(status);
        res.end();
    };
    const sendFile = (res, file, ext) => {
        res.writeHead(200, {
            'Content-Type': mimes[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
        });
        // add doctype and charset since some chars might otherwise not work
        if (ext === 'html')
            file = `<!DOCTYPE html><meta charset="UTF-8"/>${file}`;
        res.write(file, 'binary');
        res.end();
    };

    server((req, res) => {
        // if just a root folder, try the index.html
        const requestUrl = req.url.match(/\./)
            ? req.url
            : req.url + '/index.html';
        const pathname = url.parse(requestUrl).pathname;
        const uri = path.join(root, decodeURI(pathname));
        const ext = uri.replace(/^.*[\.\/\\]/, '').toLowerCase();
        fs.stat(uri, err => {
            if (err) return sendError(res, 404);
            fs.readFile(uri, 'binary', (err, file) => {
                if (err) return sendError(res, 500);
                sendFile(res, file, ext);
            });
        });
    }).listen(parseInt(port, 10));
    console.log(`
    Let's Go!
    Serving from: ${root}
    Opening:  ${link}`);
    require('child_process').execSync(`${open} ${link}`);
})();
