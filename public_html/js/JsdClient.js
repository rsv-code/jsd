/*
 * Copyright (c) 2016 Austin Lehman.
 * Distributed under the BSD 3-Clause License.
 * (See accompanying file LICENSE or copy at https://github.com/rsv-code/jsd)
 */

/**
 * JsdClient.js
 * Implements JSD client for the browser.
 */

/**
 * JsdService manages the service definition for JsdClient.
 */
function JsdService(SchemaObj) {
   BaseObj.call(this);

   // The schema definition.
   this.definition = {};

   if (isDef(SchemaObj)) {
     this.definition = SchemaObj;
   }
}
JsdService.prototype = new BaseObj();
JsdService.prototype.constructor = JsdService;


/**
 * Object manages JSON definitions (JSD) and JSON schemas.
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
 * @param OnSuccess is a JS function reference to call on success.
 * @param OnError is a JS function reference to call on failure.
 * @param ValidateResult is a boolean with true to validate the result object
 * against it's schema and false to skip validation. (Optional, default is true.)
 */
JsdClient.prototype.callMethod = function (Endpoint, Method, Arg, OnSuccess, OnError, ValidateResult) {
  // Call object.
  var cobj = {
    action: "callMethod",
    endpoint: Endpoint,
    method: Method,
    arg: Arg,
    onSuccess: OnSuccess,
    onError: OnError,
    validateResult: ValidateResult
  };

  if (!isDef(cobj.validateResult)) { cobj.validateResult = true; }

  // If we don't alerady have the endpoint loaded, load it.
  if (!this.services.contains(cobj.endpoint)) {
    this.loadRemoteFile(cobj, cobj.endpoint, "onLoadJsd");
  } else {
    this.onServiceCall(cobj);
  }
};

/**
 * Loads and caches a JSD file for the provided endpoint.
 * @param Endpoint is a string with the relative service path.
 * @param OnSuccess is a JS function reference to call on success.
 * @param OnError is a JS function reference to call on failure.
 */
JsdClient.prototype.loadJsd = function (Endpoint, OnSuccess, OnError) {
  // If we don't alerady have the endpoint loaded, load it.
  if (!this.services.contains(Endpoint)) {
    var cobj = {
      action: "loadJsd",
      endpoint: Endpoint,
      onSuccess: OnSuccess,
      onError: OnError,
    };
    this.loadRemoteFile(cobj, Endpoint, "onLoadJsd");
  } else {
    OnSuccess(this.services[Endpoint]);
  }
};

/**
 * Loads and caches a schema file for the provided endpoint.
 * @param Endpoint is a string with the relative schema path.
 * @param OnSuccess is a JS function reference to call on success.
 * @param OnError is a JS function reference to call on failure.
 */
JsdClient.prototype.loadSchema = function (Endpoint, OnSuccess, OnError) {
  if (!this.schemas.contains(Endpoint)) {
    var cobj = {
      action: "loadSchema",
      endpoint: Endpoint,
      schemaRef: Endpoint,
      onSuccess: OnSuccess,
      onError: OnError,
    };
    this.loadRemoteFile(cobj, Endpoint, "onLoadSchema");
  } else {
    OnSuccess(this.schemas[Endpoint]);
  }
};

/**
 * This method is called on successful load of a remote JSD file.
 * @param cobj is a JS object with call object information. (See callMethod)
 * @param FileContents is a string with the JSD file contents.
 */
JsdClient.prototype.onLoadJsd = function (cobj, FileContents) {
  try {
    var dlobj = JSON.parse(FileContents);
  } catch (e) {
    cobj.onError ("JsdClient.onLoadJsd(): JSON parse exception in file '" + cobj.endpoint + "'.\n" + e);
    return;
  }

  try {
    this.validateJsdSyntax(dlobj);
  } catch (e) {
    cobj.onError ("JsdClient.onLoadJsd(): JSD validation exception in file '" + cobj.endpoint + "'.\n" + e);
    return;
  }

  this.services[cobj.endpoint] = new JsdService(dlobj);
  if (cobj.action === "loadJsd") {
    cobj.onSuccess(this.services[cobj.endpoint]);
  } else {
    this.onServiceCall(cobj);
  }
};

/**
 * This method is called with the call object to check that the service
 * definition contains the method. It also creates the JSON-RPC request
 * object. If the argument is defined and not null it will call validateParam,
 * otherwise it'll call postJson.
 * @param cobj is a JS object with call object information. (See callMethod)
 */
JsdClient.prototype.onServiceCall = function (cobj) {
  if (!this.services[cobj.endpoint].definition.methods.contains(cobj.method)) {
    cobj.onError ("JsdClient.onServiceCall(): Method '" + cobj.method + "' not found in endpoint '" + cobj.endpoint + "'.");
    return;
  }

  var reqObj = { id: this.getNewId(), jsonrpc: "2.0", method: cobj.method };
  cobj.reqObj = reqObj;
  if (isDef(cobj.arg) && cobj.arg !== null) {
    if (!isObj(cobj.arg)) { cobj.onError ("JsdClient.onServiceCall(): Expecting Arg parameter to be a JS object."); return; }

    cobj.reqObj.params = [ cobj.arg ];
    this.validateParam(cobj);
  } else {
    this.postJson(cobj, "onCallResult");
  }
};

/**
 * Validate param is called when the arg isn't null or missing. This
 * will look for the schema ref. If found it will call onValidateParam,
 * otherwise it'll call loadRemoteFile to get the schema definition first.
 * @param cobj is a JS object with call object information. (See callMethod)
 */
JsdClient.prototype.validateParam = function(cobj) {
  var sdef = this.services[cobj.endpoint].definition;
  var sdefName = sdef.methods[cobj.method].param;
  var schemaRef = sdef.types[sdefName];
  cobj.schemaRef = schemaRef;

  if (!this.schemas.contains(schemaRef)) {
    this.loadRemoteFile(cobj, schemaRef, "onLoadSchema");
  } else {
    this.onValidateParam(cobj);
  }
};

/**
 * This method is called once the schema definition has been loaded or is
 * cached. It validates the arg against the schema. If valid it will call
 * postJson to make the actual call.
 * @param cobj is a JS object with call object information. (See callMethod)
 */
JsdClient.prototype.onValidateParam = function (cobj) {
  var valid = tv4.validate(cobj.arg, tv4.getSchema(cobj.schemaRef));
  if (!valid) {
    cobj.onError ("JsdClient.v(): Schema validation error on param. { message: '" + tv4.error.message + "', dataPath: '" + tv4.error.dataPath + "', schemaPath: '" + tv4.error.schemaPath + "' }");
  }

  this.postJson(cobj, "onCallResult");
};

/**
 * This function is called once postJson has made the remote call. It parses
 * the JSON results and validates the JSON-RPC result message. Finally it will
 * call validateResult if the cobj.validateResult flag is true or onSuccess if
 * not.
 * @param cobj is a JS object with call object information. (See callMethod)
 * @param Content is a string with the results from the postJson call.
 */
JsdClient.prototype.onCallResult = function (cobj, Content) {
  try {
    cobj.result = JSON.parse(Content);
  } catch (e) {
    cobj.onError("JsdClient.onCallResult(): JSON parse error.");
    return;
  }

  this.validateRpcResult(cobj.endpoint, cobj.method, cobj.result);

  if (cobj.result.contains("error")) {
    cobj.onError ("JsdClient.onServiceCall(): Returned object contains error. { code: " + cobj.result.error.code + ", message: '" + cobj.result.error.message + "', data: " + cobj.result.error.data.toString(false) + " }");
    return;
  }

  // Validate return object here ...
  if (cobj.validateResult) {
    this.validateResult(cobj);
  } else {
    cobj.onSuccess(cobj.result);
  }
};

/**
 * This function is called to validate the result object from the
 * remote call. It validates the result against the JSD. If the definition
 * expects an object result it will check to see if the schema is cached. If
 * it is it will either call loadRemoteFile to load the schema or call
 * onValidateSchemaResult. If no result object needs to be validated
 * onSuccess is called.
 * @param cobj is a JS object with call object information. (See callMethod)
 */
JsdClient.prototype.validateResult = function (cobj) {
  var Result = cobj.result.result;

  if (!isDef(Result) || Result === null) {
    if (this.services[cobj.endpoint].definition.methods[cobj.method].result !== null) {
      cobj.onError ("JsdClient.validateResult(): Result is missing or null but definition expects return object of type '" + this.services[cobj.endpoint].definition.methods[cobj.method].result + "'.");
      return;
    }
  }

  var sdef = this.services[cobj.endpoint].definition;
  var sdefName = sdef.methods[cobj.method].result;
  if (sdefName === null && (isDef(Result) && Result !== null)) {
    cobj.onError ("JsdClient.validateResult(): Schema definition expects result to be missing or null but found this: " + Result.toString());
    return;
  }

  if (isDef(sdefName) && sdefName !== null) {
    cobj.resultSchemaRef = sdef.types[sdefName];

    if (!this.schemas.contains(cobj.resultSchemaRef)) {
      this.loadRemoteFile(cobj, cobj.resultSchemaRef, "onLoadResultSchema");
    } else {
      this.onValidateSchemaResult(cobj);
    }
  } else {
    // Nothing more to validate, send to onSuccess.
    cobj.onSuccess(cobj.result);
  }
};

/**
 * Validates the result object against the schema and then if valid
 * calls onSuccess.
 * @param cobj is a JS object with call object information. (See callMethod)
 */
JsdClient.prototype.onValidateSchemaResult = function (cobj) {
  var valid = tv4.validate(cobj.result.result, tv4.getSchema(cobj.resultSchemaRef));
  if (!valid) {
    cobj.onError ("JsdClient.onValidateSchemaResult(): Schema validation error on result. { message: '" + tv4.error.message + "', dataPath: '" + tv4.error.dataPath + "', schemaPath: '" + tv4.error.schemaPath + "' }");
    return;
  }
  cobj.onSuccess(cobj.result);
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
 * Parses the provided Content JSON and stores the
 * file path and schema object in schemas map.
 * @param cobj is a JS object with call object information. (See callMethod)
 * @param Content is a string with the schema file text.
 */
JsdClient.prototype.onLoadSchema = function (cobj, Content) {
  try {
    var sobj = JSON.parse(Content);
  } catch (e) {
    cobj.onError ("JsdClient.loadJsonSchema(): JSON parse exception in file '" + cobj.schemaRef + "'.\n" + e);
  }
  tv4.addSchema(cobj.schemaRef, sobj);
  this.schemas[cobj.schemaRef] = sobj;
  console.info("Added schema '" + cobj.schemaRef + "'.");

  if (cobj.action === "loadSchema") {
    cobj.onSuccess(this.schemas[cobj.schemaRef]);
  } else {
    this.onValidateParam(cobj);
  }
};

/**
 * Parses the provided result Content JSON and stores the
 * file path and schema object in schemas map.
 * @param cobj is a JS object with call object information. (See callMethod)
 * @param Content is a string with the schema file text.
 */
JsdClient.prototype.onLoadResultSchema = function (cobj, Content) {
  try {
    var sobj = JSON.parse(Content);
  } catch (e) {
    cobj.onError ("JsdClient.onLoadResultSchema(): JSON parse exception in file '" + cobj.endpoint + "'.\n" + e);
    return true;
  }
  tv4.addSchema(cobj.resultSchemaRef, sobj);
  this.schemas[cobj.resultSchemaRef] = sobj;
  console.info("Added schema '" + cobj.resultSchemaRef + "'.");

  this.onValidateSchemaResult(cobj);
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
 * Loads a remove file and then calls the provided member function.
 * @param cobj is a JS object with call object information. (See callMethod)
 * @param ToLoad is a URL with the remote content to load.
 * @param OnCompleteMember is a string with the member function to call with
 * the result text.
 */
JsdClient.prototype.loadRemoteFile = function (cobj, ToLoad, OnCompleteMember) {
  var self = this;
  var xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = function() {
      if (xhttp.readyState === 4 && xhttp.status === 200) {
          self[OnCompleteMember](cobj, xhttp.responseText);
      } else if(xhttp.readyState === 4) {
        cobj.onError("JsdClient.loadRemoteFile(): Server returned HTTP response code " + xhttp.status + ".");
      }
  };

  xhttp.ontimeout = function (e) {
    cobj.onError("JsdClient.loadRemoteFile(): Timeout exception when connecting to server. " + e);
  };

  xhttp.open("GET", this.rootJsdPath + ToLoad, true);
  xhttp.setRequestHeader("Content-type", "application/json");
  xhttp.timeout = this.timeoutMills;
  try {
    xhttp.send();
  } catch (e) {
    cobj.onError("JsdClient.loadRemoteFile(): Network connection failure. " + e);
  }
};

/**
 * Creates a HTTP POST call with the provided call object and then calls
 * the member function provided.
 * @param cobj is a JS object with call object information. (See callMethod)
 * @param OnCompleteMember is a string with the member function to call with
 * the result text.
 */
JsdClient.prototype.postJson = function (cobj, OnCompleteMember) {
  var self = this;
  var xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = function() {
      if (xhttp.readyState === 4 && xhttp.status === 200) {
          self[OnCompleteMember](cobj, xhttp.responseText);
      } else if(xhttp.readyState === 4) {
        cobj.onError("JsdClient.postJson(): Server returned HTTP response code " + xhttp.status + ".");
      }
  };

  xhttp.ontimeout = function (e) {
    cobj.onError("JsdClient.postJson(): Timeout exception when connecting to server. " + e);
  };

  xhttp.open("POST", this.rootJsdPath + cobj.endpoint, true);
  xhttp.setRequestHeader("Content-type", "application/json");
  xhttp.timeout = this.timeoutMills;
  try {
    xhttp.send(cobj.reqObj.toString());
  } catch (e) {
    cobj.onError("JsdClient.postJson(): Network connection failure. " + e);
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
