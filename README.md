# JSD - JSON Service Definition

## What is it?
JSON service defintion is a specification for creating a web service definition
in JSON for use with JSON-RPC and JSON Schema specifications.

## The Specification

[To learn more see the specification here](JSD.md).


## The Code
There's also some code included in this repo. Apply it how you like. The
server and client use Ic9 environment based on Nashorn. There's also a JSD client library that can be used in the browser in the public_html folder.

Find the Ic9 server.js and client.js files in the root directory and required
libraries are in the lib directory.

### Try it out
Running the code requires Java 8 or later and an installation of [Ic9 environment](https://github.com/ic9/ic9).

Running the server:
```
$ ./server.js
[info] jsd/lighting
[info] jsd/lighting/lightSimple.jsd
[info] Added service '/lighting/lightSimple'.
[info] jsd/lighting/lightStatus.schema.json
[info] Added schema 'jsd/lighting/lightStatus.schema.json'.
[info] jsd/lighting/deviceFailure.schema.json
[info] Added schema 'jsd/lighting/deviceFailure.schema.json'.
```

Running the client:
```
$ ./client.js
Calling setLightStatus with status set to 'true'.
[info] Added schema '/lighting/lightStatus.schema.json'.
Calling getLightStatus:
[info] {
	"status":true
}
```

Once the server is live you can test from the browser by navigating to
http://localhost:8080.


## License
All of the code if not otherwise specified is released under the BSD 3-Clause
License.

### Other Code
Other source code is included within this repository and is licensed under
other licenses. The code may have an accompanying license file in the folder
it resides in and/or may have a notice at the top of the source code file.

 * tv4.js - Public Domain
 * Bootstrap - MIT License
 * jQuery - The jQuery License
 * JSON Editor - MIT License
 * jsenv.js - Apache 2 License
