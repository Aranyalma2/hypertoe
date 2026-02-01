const http = require("http");
const fs = require("fs");
const path = require("path");

function createHttpServer() {
	return http.createServer((req, res) => {
		let filePath = "./frontend" + req.url;
		if (filePath === "./frontend/") {
			filePath = "./frontend/index.html";
		}

		const extname = String(path.extname(filePath)).toLowerCase();
		const mimeTypes = {
			".html": "text/html",
			".js": "text/javascript",
			".css": "text/css",
		};

		const contentType = mimeTypes[extname] || "application/octet-stream";

		fs.readFile(filePath, (error, content) => {
			if (error) {
				if (error.code === "ENOENT") {
					res.writeHead(404);
					res.end("File not found");
				} else {
					res.writeHead(500);
					res.end("Server error: " + error.code);
				}
			} else {
				res.writeHead(200, { "Content-Type": contentType });
				res.end(content, "utf-8");
			}
		});
	});
}

module.exports = createHttpServer;
