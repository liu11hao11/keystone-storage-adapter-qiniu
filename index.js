/*
TODO
- Check whether files exist before uploading (will always overwrite as-is)
- Support multiple retry attempts if a file exists (see FS Adapter)
*/

// Mirroring keystone 0.4's support of node 0.12.
var assign = require("object-assign");
var debug = require("debug")("qiniu");
var ensureCallback = require("keystone-storage-namefunctions/ensureCallback");
var qiniu = require("qiniu");
var nameFunctions = require("keystone-storage-namefunctions");
var pathlib = require("path");

var DEFAULT_OPTIONS = {
	accessKey: process.env.accessKey,
	secretKey: process.env.accessKey,
	bucket: process.env.bucket,
	domain: process.env.domain,
	region: "Zone_z0",
	generateFilename: nameFunctions.randomFilename,
};

function uptoken (qiniuOptions) {
	var mac = new qiniu.auth.digest.Mac(
		qiniuOptions.accessKey,
		qiniuOptions.secretKey
	);
	var options = {
		scope: qiniuOptions.bucket,
	};
	var putPolicy = new qiniu.rs.PutPolicy(options);
	var uploadToken = putPolicy.uploadToken(mac);
	return uploadToken;
}
function checkZone (region) {
	switch (region) {
		case "Zone_z0":
			return qiniu.zone.Zone_z0;
		case "Zone_z1":
			return qiniu.zone.Zone_z1;
		case "Zone_z2":
			return qiniu.zone.Zone_z2;
		case "Zone_na0":
			return qiniu.zone.Zone_na0;
		default:
			return qiniu.zone.Zone_z0;
	}
}

function QiniuAdapter (options, schema) {
	this.options = assign({}, DEFAULT_OPTIONS, options.qiniu);

	// If path is specified it must be absolute.
	if (options.path != null && !pathlib.isAbsolute(options.path)) {
		throw Error("Configuration error: qiniu path must be absolute");
	}

	// Ensure the generateFilename option takes a callback
	this.options.generateFilename = ensureCallback(this.options.generateFilename);
}

QiniuAdapter.compatibilityLevel = 1;

// All the extra schema fields supported by this adapter.
QiniuAdapter.SCHEMA_TYPES = {
	filename: String,
	bucket: String,
	path: String,
	url: String,
};

QiniuAdapter.SCHEMA_FIELD_DEFAULTS = {
	filename: true,
	bucket: false,
	path: true,
	url: true,
};

// Get the full, absolute path name for the specified file.
QiniuAdapter.prototype._resolveFilename = function (file) {
	var path = file.path || this.options.path || "/";
	return pathlib.posix.join(path, file.filename);
};

QiniuAdapter.prototype.uploadFile = function (file, callback) {
	var self = this;
	this.options.generateFilename(file, 0, function (err, filename) {
		if (err) return callback(err);

		// The expanded path of the file on the filesystem.
		var localpath = file.path;

		// The destination path inside the S3 bucket.
		file.path = self.options.path;
		file.filename = filename;
		var destpath = self._resolveFilename(file);
		var config = new qiniu.conf.Config();
		// 空间对应的机房

		config.zone = checkZone(self.options.region);
		var formUploader = new qiniu.form_up.FormUploader(config);
		var putExtra = new qiniu.form_up.PutExtra();
		debug("Uploading file %s", filename);
		console.log(localpath, destpath, self.options);
		// 文件上传
		formUploader.putFile(
			uptoken(self.options),
			destpath,
			localpath,
			putExtra,
			function (respErr, respBody, respInfo) {
				if (respErr) {
					throw respErr;
				}
				if (respInfo.statusCode === 200) {
					console.log(respBody);
					file.filename = filename;
					file.path = self.options.path;
					file.bucket = self.options.bucket;
					file.url = pathlib.join(
						self.options.domain,
						self.options.path,
						filename
					);
					debug("file upload successful");
					callback(null, file);
				} else {
					return callback(
						new Error("Amazon returned status code: " + respInfo.statusCode)
					);
				}
			}
		);
	});
};

QiniuAdapter.prototype.getFileURL = function (file) {
	return pathlib.posix.join(this.options.domain, this._resolveFilename(file));
};

QiniuAdapter.prototype.removeFile = function (file, callback) {
	var self = this;
	var fullpath = this._resolveFilename(file);
	var mac = new qiniu.auth.digest.Mac(
		self.options.accessKey,
		self.options.secretKey
	);
	var config = new qiniu.conf.Config();
	// config.useHttpsDomain = true;
	config.zone = qiniu.zone.Zone_z0;
	var bucketManager = new qiniu.rs.BucketManager(mac, config);

	bucketManager.delete(self.options.bucket, fullpath, function (
		err,
		respBody,
		respInfo
	) {
		if (err) return callback(err);
		if (respInfo.statusCode !== 200 && respInfo.statusCode !== 204) {
			return callback(
				Error("Qiniu returned status code " + respInfo.statusCode)
			);
		}
		respInfo.resume(); // Discard the body
		callback();
	});
};

// Check if a file with the specified filename already exists. Callback called
// with the file headers if the file exists, null otherwise.
QiniuAdapter.prototype.fileExists = function (filename, callback) {
	var self = this;
	var fullpath = this._resolveFilename({ filename });
	var mac = new qiniu.auth.digest.Mac(
		self.options.accessKey,
		self.options.secretKey
	);
	var config = new qiniu.conf.Config();
	// config.useHttpsDomain = true;
	config.zone = qiniu.zone.Zone_z0;
	var bucketManager = new qiniu.rs.BucketManager(mac, config);

	bucketManager.stat(self.options.bucket, fullpath, function (
		err,
		respBody,
		respInfo
	) {
		if (err) return callback(err);

		if (respInfo.statusCode === 404) return callback(); // File does not exist
		callback(null, respInfo.fsize);
	});
};

module.exports = QiniuAdapter;
