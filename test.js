/* eslint-env node, mocha */

// Pull in qiniu key, qiniu secret and qiniu bucket from .env
require("dotenv").config();

const assert = require("assert");
const QiniuAdapter = require("./index");
const fs = require("fs");

describe("qiniu file field", function () {
	beforeEach(function () {
		this.timeout(10000);
	});

	require("keystone/test/fileadapter")(
		QiniuAdapter,
		{
			qiniu: {
				accessKey: process.env.accessKey,
				secretKey: process.env.secretKey,
				bucket: process.env.bucket,
				domain: process.env.domain,
			},
		},
		{
			filename: true,
			size: true,
			mimetype: true,
			path: true,
			originalname: true,
			url: true,
		}
	)();

	it("304s when you request the file using the returned etag");
	it("the returned etag doesnt contain enclosing quotes");

	describe("fileExists", () => {
		it("returns an options object if you ask about a file that does exist", function (
			done
		) {
			// Piggybacking off the file that gets created as part of the keystone tests.
			// This should probably just be exposed as a helper method.
			var adapter = this.adapter;
			adapter.uploadFile(
				{
					name: "abcde.txt",
					mimetype: "text/plain",
					originalname: "originalname.txt",
					path: this.pathname,
					size: fs.statSync(this.pathname).size,
				},
				function (err, file) {
					if (err) throw err;

					adapter.fileExists(file.filename, function (err, result) {
						if (err) throw err;
						assert.ok(result);

						adapter.removeFile(file, done);
					});
				}
			);
		});

		it("returns falsy when you ask if fileExists for a nonexistant file", function (
			done
		) {
			this.adapter.fileExists("filethatdoesnotexist.txt", function (
				err,
				result
			) {
				if (err) throw err;
				assert(!result);
				done();
			});
		});
	});
});
