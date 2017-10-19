# QiNiu-based storage adapter for KeystoneJS

This adapter is designed to implement file field in KeystoneJS using the new storage API.

Compatible with Node.js 0.12+

## Usage

Configure the storage adapter:

```js
var storage = new keystone.Storage({
  adapter: require('keystone-storage-adapter-qiniu'),
  qiniu: {
   	accessKey: "Your_accessKey",
	  secretKey: "Your_secretKey",
	  bucket: "Your_bucket",
	  domain: "Your_domain",
    region: 'Zone_z0', // optional; defaults to Zone_z0, or if that's not specified, 
    path: '/youuploadpath',    
  }
});
```

Then use it as the storage provider for a File field:

```js
File.add({
  name: { type: String },
  file: { type: Types.File, storage: storage },
});
```

# License

Licensed under the standard MIT license. See [LICENSE](license).
