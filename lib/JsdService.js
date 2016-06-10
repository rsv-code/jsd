/*
 * Copyright (c) 2016 Austin Lehman.
 * Distributed under the BSD 3-Clause License.
 * (See accompanying file LICENSE or copy at https://github.com/rsv-code/jsd)
 */

/**
 * JsdService is an object that manages the service definition and handlers.
 */
function JsdService(SchemaObj) {
  BaseObj.call(this);

  // The schema definition.
  this.definition = {};

  // Call handlers.
  this.handlers = {};

  if (isDef(SchemaObj)) {
    this.definition = SchemaObj;
  }
}
JsdService.prototype = new BaseObj();

/**
 * Sets an on call handler for a method in this service to be called when
 * a request comes in. The JS object reference and method name are saved
 * for use when the handler needs to be called.
 * @param MethodName is a string with the service method to call.
 * @param OnCallObj is a JS object to call a method on when handled.
 * @param OnCallMethod is a string with the object method name to call.
 */
JsdService.prototype.setOnCall = function (MethodName, OnCallObj, OnCallMethod) {
  if (!isDef(MethodName)) {
    throw ("JsdService.setOnCall(): Param MethodName is missing.");
  }
  if (!this.definition.methods.contains(MethodName)) {
    throw ("JsdService.setOnCall(): Method name '" + MethodName + "' not found in service definition.");
  }
  if (!isDef(OnCallObj) || !isObj(OnCallObj)) {
    throw ("JsdService.setOnCall(): Param OnCallObj must be a valid JS object.");
  }
  if (!isDef(OnCallMethod) || !isString(OnCallMethod)) {
    throw ("JsdService.setOnCall(): Param OnCallMethod must be a JS string.");
  }

  this.handlers[MethodName] = { onCallObject: OnCallObj, onCallMethod: OnCallMethod };
};

/**
 * This is called when a request needs to be handled. This method then invokes
 * the stored handler object/method if found.
 * @param MethodName is a string with the service method to call.
 * @param ObjectArg is a JS object with the argument provided.
 * @param Data is an optional argument passed through to the handler.
 */
JsdService.prototype.callHandler = function (MethodName, ObjectArg, Data) {
  if (!this.handlers.contains(MethodName)) {
    throw ("JsdService.callHandler(): Not implemented.");
  }

  var callInfo = this.handlers[MethodName];
  if (!isDef(callInfo.onCallObject) || !isDef(callInfo.onCallMethod) || callInfo.onCallMethod.trim() === "") {
    throw ("JsdService.callHandler(): Not implemented.");
  }

  // Make actual method call and return result.
  return callInfo.onCallObject[callInfo.onCallMethod](ObjectArg, Data);
};

JsdService.prototype.constructor = JsdService;
