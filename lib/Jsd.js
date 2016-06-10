/*
 * Copyright (c) 2016 Austin Lehman.
 * Distributed under the BSD 3-Clause License.
 * (See accompanying file LICENSE or copy at https://github.com/rsv-code/jsd)
 */

/**
 * Jsd.js
 * Implements JSON Service Definition.
 */
include("io/file.js");
include("lib/tv4.js");
include("lib/JsdService.js");

/**
 * Object manages JSON definitions (JSD) and JSON schemas.
 */
function Jsd() {
  BaseObj.call(this);

  this.rootJsdPath = "";

  // Service definitions.
  this.services = {};

  // Schema definitions.
  this.schemas = {};
}
Jsd.prototype = new BaseObj();

/**
 * Sets the JSD path and loads all definitions and schema
 * within the path.
 * @param JsdPath is a string with the relative path to load definitions.
 */
Jsd.prototype.load = function (JsdPath) {
  this.rootJsdPath = JsdPath;
  this.loadPath("");

  // Validate JSD references.
  this.validateJsdReferences();
};

/**
 * Loads all service and schema definitions within the provided
 * path. This is called by the load function.
 * @param JsdPath is a string with the relative path to load definition.
 */
Jsd.prototype.loadPath = function (JsdPath) {
  var files = file.listDir(this.rootJsdPath + JsdPath);
  for (var i = 0; i < files.length; i += 1) {
    var fname = files[i];
    var lpath = JsdPath + "/" + fname;
    var fpath = this.rootJsdPath + lpath;
    console.info(fpath);
    if (file.isDir(fpath)) {
      this.loadPath(lpath);
    } else if (fname.toLowerCase().endsWith(".jsd")) {
      var jdef = this.loadJsd(lpath);
      var jsdServ = new JsdService(jdef);
      var servPath = lpath.substring(0, lpath.length - 4);
      console.info("Added service '" + servPath + "'.")
      this.services[servPath] = jsdServ;
    } else if (fname.toLowerCase().endsWith(".json")) {
      this.loadJsonSchema(lpath);
    } else {
      console.warn("Jsd.loadPath(): Unidentified file '" + fpath + "' found. Skipping file.");
    }
  }

  // Check for missing schema.
  if (tv4.missing.length > 0) {
    throw ("Jsd.loadPath(): Missing schema files: " + tv4.missing + ". Exiting.");
  }
};

/**
 * Loads a service definition file with the provided file name.
 * @param JsdFile is a string with relative file name of the .jsd file to load.
 */
Jsd.prototype.loadJsd = function (JsdFile) {
  try {
    var dlobj = JSON.parse(file.read(this.rootJsdPath + JsdFile));
  } catch (e) {
    throw ("Jsd.loadJsd(): JSON parse exception in file '" + this.rootJsdPath + JsdFile + "'.\n" + e);
  }
  try {
    this.validateJsdSyntax(dlobj);
    return dlobj;
  } catch (e) {
    throw ("Jsd.loadJsd(): JSD validation exception in file '" + this.rootJsdPath + JsdFile + "'.\n" + e);
  }
};

/**
 * Validates a service definition syntax.
 * @param jlobj is a JS object with the service definition to validate.
 */
Jsd.prototype.validateJsdSyntax = function (dlobj) {
  if (!isDef(dlobj.name) || !isString(dlobj.name) || dlobj.name.trim() === "") {
    throw ("Jsd.validateJsd(): JSD definition name attribute is missing, not a string or blank.");
  }
  if (!isDef(dlobj.title) || !isString(dlobj.title) || dlobj.title.trim() === "") {
    throw ("Jsd.validateJsd(): JSD definition title attribute is missing, not a string or blank.");
  }
  if (!isDef(dlobj.description) || !isString(dlobj.description) || dlobj.description.trim() === "") {
    throw ("Jsd.validateJsd(): JSD definition description attribute is missing, not a string or blank.");
  }

  // Vaidate defined types.
  if (isDef(dlobj.types)) {
    if (!isObj(dlobj.types)) {
      throw ("Jsd.validateJsd(): JSD definition types is expected to be an object.");
    }
    for (var key in dlobj.types) {
      if (!isString(dlobj.types[key]) || !dlobj.types[key].toLowerCase().endsWith(".json")) {
        throw ("Jsd.validateJsd(): JSD definition type attribute '" + key + "' should be a string ending in .json.");
      }
    }
  }

  if (isDef(dlobj.methods)) {
    if (!isObj(dlobj.methods)) {
      throw ("Jsd.validateJsd(): JSD definition methods is expected to be an object.");
    }
    for (var meth in dlobj.methods) {
      var mprops = dlobj.methods[meth];

      if (!isDef(mprops.title) || !isString(mprops.title) || mprops.title.trim() === "") {
        throw ("Jsd.validateJsd(): JSD definition methods." + meth + ".title attribute is missing, not a string or is blank.");
      }
      if (!isDef(mprops.description) || !isString(mprops.description) || mprops.description.trim() === "") {
        throw ("Jsd.validateJsd(): JSD definition methods." + meth + ".description attribute is missing, not a string or is blank.");
      }
      if (!isDef(mprops.param) || ((mprops.param !== null) && !isString(mprops.param)) || (isString(mprops.param) && mprops.param.trim() === "")) {
        throw ("Jsd.validateJsd(): JSD definition methods." + meth + ".param attribute is missing, not a string/null or is blank.");
      }
      if (!isDef(mprops.result) || ((mprops.result !== null) && !isString(mprops.result)) || (isString(mprops.result) && mprops.result.trim() === "")) {
        throw ("Jsd.validateJsd(): JSD definition methods." + meth + ".result attribute is missing, not a string/null or is blank.");
      }

      if (isDef(mprops.errors)) {
        if (!isArr(mprops.errors)) {
          throw ("Jsd.validateJsd(): JSD definition methods." + meth + ".errors is expected to be an array.");
        }

        for (var i = 0; i < mprops.errors.length; i += 1) {
          if (!isString(mprops.errors[i]) || mprops.errors[i].trim() === "") {
            throw ("Jsd.validateJsd(): JSD definition methods." + meth + ".errors[" + i + "] attribute is not a string or is blank.");
          }
        }
      }
    }
  }
};

/**
 * Loads the JSON schema with the provided SchemaFile and stores the
 * file path and schema object in schemas map.
 * @param SchemaFile is a string with the relative path of the schema file to load.
 */
Jsd.prototype.loadJsonSchema = function (SchemaFile) {
  try {
    var sobj = JSON.parse(file.read(this.rootJsdPath + SchemaFile));
  } catch (e) {
    throw ("Jsd.loadJsonSchema(): JSON parse exception in file '" + this.rootJsdPath + SchemaFile + "'.\n" + e);
  }
  tv4.addSchema(SchemaFile, sobj);
  this.schemas[SchemaFile] = sobj;
  console.info("Added schema '" + this.rootJsdPath + SchemaFile + "'.");
};

/**
 * Ensures that types refer to valid schemas and that method
 * type references exist.
 */
Jsd.prototype.validateJsdReferences = function () {
  for (var key in this.services) {
    var sdobj = this.services[key];
    var types = sdobj.types;

    // Check types for valid schema references.
    for (var tname in sdobj.types) {
      if (!this.schemas.contains(sdobj.types[tname])) {
        throw ("Jsd.validateJsdReferences(): Type '" + tname + "' referencing schema '" + sdobj.types[tname] + "' was not found.");
      }
    }

    // Check methods to ensure param and result types exist.
    for (var mname in sdobj.methods) {
      var meth = sdobj.methods[mname];

      // Check method param reference.
      if (isString(meth.param)) {
        if (!types.contains(meth.param)) {
          throw ("Jsd.validateJsdReferences(): Param type '" + meth.param + "' not found in method '" + mname + "'.");
        }
      }

      // Check method result reference.
      if (isString(meth.result)) {
        if (!types.contains(meth.result)) {
          throw ("Jsd.validateJsdReferences(): Result type '" + meth.result + "' not found in method '" + mname + "'.");
        }
      }

      // Check errors references.
      for (var i = 0; i < meth.errors.length; i += 1) {
        if (!types.contains(meth.errors[i])) {
          throw ("Jsd.validateJsdReferences(): Error type '" + meth.errors[i] + "' not found in method '" + mname + "'.");
        }
      }
    }
  }
};

/**
 * Makes a call to the service for the provided endpoint with the
 * request JSON content as a string.
 * @param Endpoint is a string with the relative path to the JSD service.
 * @param ReqContent is a string with the JSON request content.
 * @param Data is an optional argument that is passed through to the handler.
 */
Jsd.prototype.callService = function (Endpoint, ReqContent, Data) {
  // Return object.
  var robj = { jsonrpc: "2.0" };

  // Attempt to parse the provided content.
  try {
    var jobj = JSON.parse(ReqContent);
  } catch (e) {
    // Standard JSON-RPC 2.0 Parse Error
    robj.error = { code: -32700, message: "Parse error", data: "Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text. " + e };
    return robj;
  }

  // Validate request.
  try {
    this.validateServiceRequest(Endpoint, jobj);
  } catch (e) {
    robj.error = { code: -32600, message: "Invalid Request", data: "" + e };
    return robj;
  }

  // Validate method.
  try {
    this.validateServiceRequestMethod(Endpoint, jobj);
  } catch (e) {
    robj.error = { code: -32601, message: "Method not found", data: "" + e };
    return robj;
  }

  // Validate param.
  try {
    this.validateServiceRequestArgument(Endpoint, jobj);
  } catch (e) {
    robj.error = { code: -32602, message: "Invalid params", data: "" + e };
    return robj;
  }

  // If we've made it here, let's attempt to run the method.
  try {
    var param = null;
    if (isDef(jobj.params) && jobj.params.length === 1) { param = jobj.params[0]; }
    robj.result = this.services[Endpoint].callHandler(jobj.method, param, Data);
    robj.id = jobj.id;
    return robj;
  } catch (e) {
    robj.error = { code: -32603, message: "Internal error", data: "" + e };
    return robj;
  }
};

/**
 * Validates the service request to ensure it meets JSON-PRC 2.0 specification
 * and JSD specification.
 * @param Endpoint is a string with the relative service path.
 * @param ReqObj is a JS object with the full request.
 */
Jsd.prototype.validateServiceRequest = function (Endpoint, ReqObj) {
  if (!isDef(ReqObj.id) || (isString(ReqObj.id) && ReqObj.id.trim() === "")) { throw ("Missing or blank id attribute in request."); }
  if (!isDef(ReqObj.jsonrpc)) { throw ("Missing jsonrpc attribute in request."); }
  if (ReqObj.jsonrpc !== "2.0") { throw ("Only JSON-RPC version 2.0 supported."); }
  if (!isDef(ReqObj["method"])) { throw ("Missing method attribute in request."); }
  if (ReqObj.method.trim() === "") { throw ("JSON-RPC attribute method cannot be a blank string."); }
};

/**
 * Validates the service request method. Ensures that the service definition
 * contains the provided method.
 * @param Endpoint is a string with the relative service path.
 * @param ReqObj is a JS object with the full request.
 */
Jsd.prototype.validateServiceRequestMethod = function (Endpoint, ReqObj) {
  if (!this.services[Endpoint].definition.methods.contains(ReqObj.method)) {
    throw ("Method '" + ReqObj.method + "' not found in service definition.");
  }
};

/**
 * Validates the service request argument that was passed. This method also
 * ensures that the argument is valid according to the schema.
 * @param Endpoint is a string with the relative service path.
 * @param ReqObj is a JS object with the full request.
 */
Jsd.prototype.validateServiceRequestArgument = function (Endpoint, ReqObj) {
  if (isDef(ReqObj.params)) {
    if (!isArr(ReqObj.params)) { throw ("JSON-RPC attribute params is expected to be an array with 1 object."); }
    if (ReqObj.params.length > 1) { throw ("JSON-RPC attribute params is expected to be an array with 1 object."); }
  }

  // Check if param is required.
  if (this.services[Endpoint].definition.methods[ReqObj.method].param !== null && (!isDef(ReqObj.params) || ReqObj.params.length === 0)) {
    throw ("Method '" + ReqObj.method + "' expects a parameter but none provided.");
  }

  // Check if param isn't expected.
  if (isDef(ReqObj.params) && ReqObj.params.length === 1 && this.services[Endpoint].definition.methods[ReqObj.method].param === null) {
    throw ("Method '" + ReqObj.method + "' expects no parameters but one was provided.");
  }

  // Validate param if we've made it this far.
  if (isDef(ReqObj.params) && ReqObj.params.length === 1) {
    var sdef = this.services[Endpoint].definition;
    var sdefName = sdef.methods[ReqObj.method].param;
    var schemaRef = sdef.types[sdefName];
    var valid = tv4.validate(ReqObj.params[0], tv4.getSchema(schemaRef));
    if (!valid) {
      throw ("Schema validation error on param. { message: '" + tv4.error.message + "', dataPath: '" + tv4.error.dataPath + "', schemaPath: '" + tv4.error.schemaPath + "' }");
    }
  }
};

/**
 * Registers a handler for the endpoint. This requires a JS object and it's
 * method name that handles the call.
 * @param Endpoint is a string with the relative service path.
 * @param CallMethodName is a string with the method name to handle requests for.
 * @param JsObj is a JS object that contains the handler method.
 * @param MethName is a string with the method of the JsObj to call to handle.
 */
Jsd.prototype.registerHandler = function (Endpoint, CallMethodName, JsObj, MethName) {
  if (!this.services.contains(Endpoint)) {
    throw ("Jsd.registerHandler(): Couldn't find endpoint '" + Endpoint + "' to register handler.");
  }
  this.services[Endpoint].setOnCall(CallMethodName, JsObj, MethName);
};

Jsd.prototype.constructor = Jsd;
