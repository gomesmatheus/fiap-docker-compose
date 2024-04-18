import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

const PORT = 80;

const MIME_TYPES = {
	default: "application/octet-stream",
	html: "text/html; charset=UTF-8",
	js: "application/javascript",
	css: "text/css",
	png: "image/png",
	jpg: "image/jpg",
	gif: "image/gif",
	ico: "image/x-icon",
	svg: "image/svg+xml",
};

const STATIC_PATH = path.join(process.cwd(), "./static");

const toBool = [() => true, () => false];

const prepareFile = async (url) => {
	const paths = [STATIC_PATH, url];
	if (url.endsWith("/")) paths.push("index.html");
	const filePath = path.join(...paths);
	const pathTraversal = !filePath.startsWith(STATIC_PATH);
	const exists = await fs.promises.access(filePath).then(...toBool);
	const found = !pathTraversal && exists;
	const streamPath = found ? filePath : STATIC_PATH + "/404.html";
	const ext = path.extname(streamPath).substring(1).toLowerCase();
	const stream = fs.createReadStream(streamPath);
	return { found, ext, stream };
};

const options = {
  hostname: 'go-app',
  port: 3333,
  path: '/person',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

function insertPerson(formData) {
    options.method = 'POST';
    const req = http.request(options, (res) => {
        console.log(`Status code: ${res.statusCode}`);
        let responseData = ''
        res.on('data', (chunk) => {
            responseData += chunk;
        });

        res.on('end', () => {
            console.log('Response Body:', responseData);
        });
    });

    req.on('error', (error) => {
        console.error('Error:', error);
    });

    req.write(JSON.stringify(formData));
    req.end();
}

async function retrievePerson() {
    options.method = 'GET';
    let responseData = '';
    const req = http.request(options);

    const promise = new Promise((resolve, reject) => {
        req.on('response', (res) => {
            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                resolve({ statusCode: res.statusCode, headers: res.headers, body: responseData });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });
    });

    req.end();

    return promise;
}

http
	.createServer(async (req, res) => {
		console.log(`${req.method} ${req.url}`);

		if (req.url === "/submit" && req.method === "POST") {
			let body = '';
			req.on('data', (chunk) => {
				body += chunk.toString();
			});

			req.on('end', () => {
				if (body) {
					const decodedBody = decodeURIComponent(body).replace(/\+/g, " ").split("&");
					const formData = {};

					for (const param of decodedBody) {
						const [key, value] = param.split("=");
						formData[key] = value;
					}
					console.log(formData);
                    insertPerson(formData);
				}
			});

			res.writeHead(200, { "Content-Type": "text/plain" });
			res.write(Buffer.from("Inserido!"));
			res.end();
			return;
		}

		if (req.url === "/list" && req.method === "GET") {
            const response = await retrievePerson();
            const persons = JSON.parse(response.body);
            console.log('persons', persons);
            console.log('example', persons[0].name);
            
            let html = ''

            for (const p of persons) {
                html += `<p>${p.id} - ${p.name} - ${p.email}</p>`
            }

            console.log('html', html);

			res.writeHead(200, { "Content-Type": "text/html" });
			res.write(Buffer.from(html));
			res.end();
			return;
        }

		const file = await prepareFile(req.url);
		const statusCode = file.found ? 200 : 404;
		const mimeType = MIME_TYPES[file.ext] || MIME_TYPES.default;
		res.writeHead(statusCode, { "Content-Type": mimeType });
		file.stream.pipe(res);
	})
	.listen(PORT);

console.log(`Server running at http://127.0.0.1:${PORT}/`);
