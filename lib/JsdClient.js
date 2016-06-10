/*
 * Copyright (c) 2016 Austin Lehman.
 * Distributed under the BSD 3-Clause License.
 * (See accompanying file LICENSE or copy at https://github.com/rsv-code/jsd)
 */

/**
 * JsdClient.js
 * Implements JSD client.
 */
include("net/HttpClient.js");
include("lib/JsdService.js");
include("lib/tv4.js");

/**
 * Object manages JSON definitions (JSD), JSON schemas and remote calls.
 */
function JsdClient(RemoteServerPath, TimeoutMills) {
  BaseObj.call(this);

  // JSON-RPC id. Incremented with each call.
  this.id = 0;

  this.rootJsdPath = "";
  if (isDef(RemoteServerPath)) {
    this.rootJsdPath = RemoteServerPath;
  }

  // Default timeout in milliseconds used for remote calls.
  this.timeoutMills = 3000;
  if (isDef(TimeoutMills)) {
    this.timeoutMills = TimeoutMills;
  }

  // Service definitions.
  this.services = {};

  // Schema definitions.
  this.schemas = {};
}
JsdClient.prototype = new BaseObj();

/**
 * Makes a remote JSD call with the provided service enpoint, method, and
 * argument.
 * @param Endpoint is a string with the relative service path.
 * @param Method is a string with the service method name to call.
 * @param Arg is a JS object with the argument for the call or null if applicable.
 * @param ValidateResult is a boolean with true to validate the result object
 * against it's schema and false to skip validation. (Optional, default is true.)
 */
JsdClient.prototype.callMethod = function (Endpoint, Method, Arg, ValidateResult) {
  if (!isDef(ValidateResult)) { ValidateResult = true; }

  // If we don't alerady have the endpoint loaded, load it.
  if (!this.services.contains(Endpoint)) {
    this.loadJsd(Endpoint);
  }

  if (!this.services[Endpoint].definition.methods.contains(Method)) {
    throw ("JsdClient.callMethod(): Method '" + Method + "' not found in endpoint '" + Endpoint + "'.");
  }

  var reqObj = { id: this.getNewId(), jsonrpc: "2.0", method: Method };
  if (isDef(Arg) && Arg !== null) {
    if (!isObj(Arg)) { throw ("JsdClient.callMethod(): Expecting Arg parameter to be a JS object."); }

    // Will throw exception if invalid.
    this.validateParam(Endpoint, Method, Arg);

    reqObj.params = [ Arg ];
  }

  var rcontent = this.postJson(Endpoint, reqObj.toString());
  var jobj = JSON.parse(rcontent);

  this.validateRpcResult(Endpoint, Method, jobj);

  if (jobj.contains("error")) {
    throw ("JsdClient.callMethod(): Returned object contains error. { code: " + jobj.error.code + ", message: '" + jobj.error.message + "', data: " + jobj.error.data.toString(false) + " }");
  }

  // Validate return object here ...
  if (ValidateResult) {
    this.validateResult(Endpoint, Method, jobj.result);
  }

  return jobj.result;
};

/**
 * Loads a service definition with the provided endpoint and caches it.
 * @param Endpoint is a string with the relative service path.
 * @return A JS object with the service definition.
 */
JsdClient.prototype.loadJsd = function (Endpoint) {
  try {
    var dlobj = JSON.parse(this.loadRemoteFile(Endpoint));
  } catch (e) {
    throw ("JsdClient.loadJsd(): JSON parse exception in file '" + Endpoint + "'.\n" + e);
  }
  try {
    this.validateJsdSyntax(dlobj);
    this.services[Endpoint] = new JsdService(dlobj);
    return dlobj;
  } catch (e) {
    throw ("JsdClient.loadJsd(): JSD validation exception in file '" + Endpoint + "'.\n" + e);
  }
};

/**
 * Validates a service definition syntax.
 * @param dlobj is a JSD JS object to validate it's syntax.
 */
JsdClient.prototype.validateJsdSyntax = function (dlobj) {
  if (!isDef(dlobj.name) || !isString(dlobj.name) || dlobj.name.trim() === "") {
    throw ("JsdClient.validateJsd(): JSD definition name attribute is missing, not a string or blank.");
  }
  if (!isDef(dlobj.title) || !isString(dlobj.title) || dlobj.title.trim() === "") {
    throw ("JsdClient.validateJsd(): JSD definition title attribute is missing, not a string or blank.");
  }
  if (!isDef(dlobj.description) || !isString(dlobj.description) || dlobj.description.trim() === "") {
    throw ("JsdClient.validateJsd(): JSD definition description attribute is missing, not a string or blank.");
  }

  // Vaidate defined types.
  if (isDef(dlobj.types)) {
    if (!isObj(dlobj.types)) {
      throw ("JsdClient.validateJsd(): JSD definition types is expected to be an object.");
    }
    for (var key in dlobj.types) {
      if (!isString(dlobj.types[key]) || !dlobj.types[key].toLowerCase().endsWith(".json")) {
        throw ("JsdClient.validateJsd(): JSD definition type attribute '" + key + "' should be a string ending in .json.");
      }
    }
  }

  if (isDef(dlobj.methods)) {
    if (!isObj(dlobj.methods)) {
      throw ("JsdClient.validateJsd(): JSD definition methods is expected to be an object.");
    }
    for (var meth in dlobj.methods) {
      var mprops = dlobj.methods[meth];

      if (!isDef(mprops.title) || !isString(mprops.title) || mprops.title.trim() === "") {
        throw ("JsdClient.validateJsd(): JSD definition methods." + meth + ".title attribute is missing, not a string or is blank.");
      }
      if (!isDef(mprops.description) || !isString(mprops.description) || mprops.description.trim() === "") {
        throw ("JsdClient.validateJsd(): JSD definition methods." + meth + ".description attribute is missing, not a string or is blank.");
      }
      if (!isDef(mprops.param) || ((mprops.param !== null) && !isString(mprops.param)) || (isString(mprops.param) && mprops.param.trim() === "")) {
        throw ("JsdClient.validateJsd(): JSD definition methods." + meth + ".param attribute is missing, not a string/null or is blank.");
      }
      if (!isDef(mprops.result) || ((mprops.result !== null) && !isString(mprops.result)) || (isString(mprops.result) && mprops.result.trim() === "")) {
        throw ("JsdClient.validateJsd(): JSD definition methods." + meth + ".result attribute is missing, not a string/null or is blank.");
      }

      if (isDef(mprops.errors)) {
        if (!isArr(mprops.errors)) {
          throw ("JJsdClientsd.validateJsd(): JSD definition methods." + meth + ".errors is expected to be an array.");
        }

        for (var i = 0; i < mprops.errors.length; i += 1) {
          if (!isString(mprops.errors[i]) || mprops.errors[i].trim() === "") {
            throw ("JsdClient.validateJsd(): JSD definition methods." + meth + ".errors[" + i + "] attribute is not a string or is blank.");
          }
        }
      }
    }
  }
};

/**
 * Loads the JSON schema with the provided SchemaFile and stores the
 * file path and schema object in schemas map.
 * @param Endpoint is a string with the relative service path.
 * @return A JS object with the schema.
 */
JsdClient.prototype.loadJsonSchema = function (Endpoint) {
  try {
    var sobj = JSON.parse(this.loadRemoteFile(Endpoint));
  } catch (e) {
    throw ("JsdClient.loadJsonSchema(): JSON parse exception in file '" + Endpoint + "'.\n" + e);
  }
  tv4.addSchema(Endpoint, sobj);
  this.schemas[Endpoint] = sobj;
  console.info("Added schema '" + Endpoint + "'.");
  return sobj;
};

/**
 * Validates the provided param.
 * @param Endpoint is a string with the relative service path.
 * @param Method is a string with the service method name.
 * @param ParamObj is a JS object to validate against the schema.
 */
JsdClient.prototype.validateParam = function(Endpoint, Method, ParamObj) {
  var sdef = this.services[Endpoint].definition;
  var sdefName = sdef.methods[Method].param;
  var schemaRef = sdef.types[sdefName];

  if (!this.schemas.contains(schemaRef)) {
    this.loadJsonSchema(schemaRef);
  }

  var valid = tv4.validate(ParamObj, tv4.getSchema(schemaRef));
  if (!valid) {
    throw ("JsdClient.validateParam(): Schema validation error on param. { message: '" + tv4.error.message + "', dataPath: '" + tv4.error.dataPath + "', schemaPath: '" + tv4.error.schemaPath + "' }");
  }
};

/**
 * Validates the result object to ensure it meets JSON-RPC 2.0 specification.
 * @param Endpoint is a string with the relative service path.
 * @param Method is a string with the service method name.
 * @param ReturnObj is a JS object to validate.
 */
JsdClient.prototype.validateRpcResult = function (Endpoint, Method, ReturnObj) {
  if (!isDef(ReturnObj.id) || (isString(ReturnObj.id) && ReturnObj.id.trim() === "")) { throw ("JsdClient.validateRpcResult(): Missing or blank id attribute in response."); }
  if (!isDef(ReturnObj.jsonrpc)) { throw ("JsdClient.validateRpcResult(): Missing jsonrpc attribute in response."); }
  if (ReturnObj.jsonrpc !== "2.0") { throw ("JsdClient.validateRpcResult(): Only JSON-RPC version 2.0 supported."); }
  if (isDef(ReturnObj.result) && isDef(ReturnObj.error)) { throw ("JsdClient.validateRpcResult(): JSON-RPC object should have result or error but not both."); }
};

/**
 * Validates the result against the result schema and ensures it meets
 * the requirements in the JSD.
 * @param Endpoint is a string with the relative service path.
 * @param Method is a string with the service method name.
 * @param Result is a JS object to validate.
 */
JsdClient.prototype.validateResult = function (Endpoint, Method, Result) {
  if (!isDef(Result) || Result === null) {
    if (this.services[Endpoint].definition.methods[Method].result !== null) {
      throw ("JsdClient.validateResult(): Result is missing or null but definition expects return object of type '" + this.services[Endpoint].definition.methods[Method].result + "'.");
    }
  }

  var sdef = this.services[Endpoint].definition;
  var sdefName = sdef.methods[Method].result;
  if (sdefName === null && (isDef(Result) && Result !== null)) {
    throw ("JsdClient.validateResult(): Schema definition expects result to be missing or null but found this: " + Result.toString());
  }

  if (isDef(sdefName) && sdefName !== null) {
    var schemaRef = sdef.types[sdefName];

    if (!this.schemas.contains(schemaRef)) {
      this.loadJsonSchema(schemaRef);
    }

    var valid = tv4.validate(Result, tv4.getSchema(schemaRef));
    if (!valid) {
      throw ("JsdClient.validateResult(): Schema validation error on result. { message: '" + tv4.error.message + "', dataPath: '" + tv4.error.dataPath + "', schemaPath: '" + tv4.error.schemaPath + "' }");
    }
  }
};

/**
 * Helper function that loads content from a HTTP endpoint.
 * @param Endpoint is a string with the URL to get content from.
 * @return A string with the content from the request.
 */
JsdClient.prototype.loadRemoteFile = function (Endpoint) {
  var cli = new HttpClient(this.rootJsdPath + Endpoint);
  cli.setConnectionRequestTimeout(this.timeoutMills);
  cli.setConnectTimeout(this.timeoutMills);
  cli.setSocketTimeout(this.timeoutMills);
  cli.setAllowSelfSigned(true);
  var resp = cli.getString();
  if (resp.statusCode === 200) {
    return resp.content;
  } else {
    throw ("JsdClient.loadRemoteFile(): Server responded with status code " + resp.statusCode + ". Content: " + resp.content);
  }
};

/**
 * Helper function that makes a HTTP post request to the provided URL
 * with the provided content. This call uses content-type application/json.
 * @param Endpoint is a string with the URL.
 * @param Content is a string with the content to post.
 * @return A string with the content from the request.
 */
JsdClient.prototype.postJson = function (Endpoint, Content) {
  var cli = new HttpClient(this.rootJsdPath + Endpoint);
  cli.setConnectionRequestTimeout(this.timeoutMills);
  cli.setConnectTimeout(this.timeoutMills);
  cli.setSocketTimeout(this.timeoutMills);
  cli.setAllowSelfSigned(true);
  var resp = cli.postString(postType.custom, Content, 'application/json');
  if (resp.statusCode === 200) {
    return resp.content;
  } else {
    throw ("JsdClient.postJson(): Server responded with status code " + resp.statusCode + ". Content: " + resp.content);
  }
};

/**
 * Helper that checks to see if the ID is greater than 1,000,000. If so it
 * resets the ID to 0 and then increments.
 * @return An integer with the next ID.
 */
JsdClient.prototype.getNewId = function() {
  if (this.id >= 1000000) {
    this.id = 0;
  }
  this.id += 1;
  return this.id;
};

JsdClient.prototype.constructor = JsdClient;
