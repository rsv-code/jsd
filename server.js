#!/usr/bin/ic9
/*
 * Copyright (c) 2016 Austin Lehman.
 * Distributed under the BSD 3-Clause License.
 * (See accompanying file LICENSE or copy at https://github.com/rsv-code/jsd)
 */

// Include a few needed items ...
include("lib/Jsd.js");
include("net/HttpServer.js");
include("io/file.js");

// Globals
jsd = undefined;
lstatus = false;

/**
 * Server constructor that initializes the global jsd object,
 * loads all JSD and schema definitions in the jsd directory,
 * registers two handler methods and then binds the HTTP server.
 */
function JsdServerImpl() {
  // Create new Jsd object.
  jsd = new Jsd();

  // Load all service definition and schema files in provided path.
  jsd.load("jsd");

  // Implement jsd handlers. Bind the lightSimple interface and defined functions to
  // this object and the respective handlers.
  jsd.registerHandler("/lighting/lightSimple", "getLightStatus", this, "onGetLightStatus");
  jsd.registerHandler("/lighting/lightSimple", "setLightStatus", this, "onSetLightStatus");

  // Bind to all interfaces on port 8080.
  HttpServer.call(this, "0.0.0.0", 8080);
}
JsdServerImpl.prototype = new HttpServer();

/**
 * Handle function is called when there is a request
 * to the interface.
 * @param req is the HTTP request object.
 * @param res is the HTTP response object.
 */
JsdServerImpl.prototype.handle = function (req, res)
{
  // Default page to index.html.
  if (req.request === "/") {
    req.request = "index.html";
  }

  // Handle HTTP GET request.
  if (req.method.toLowerCase() === "get") {
    if (jsd.services.contains(req.request)) {
      res.println(jsd.services[req.request].definition.toString());
    } else if (jsd.schemas.contains(req.request)) {
      res.println(jsd.schemas[req.request].toString());
    } else if (file.exists("public_html/" + req.request)) {
      // Server anything from public_html folder.
      res.write(file.readBinary("public_html/" + req.request));
    }
    // Can't find what you're looking for. Normally this would be where you
    // deliver the 404, but we we are just going to print the req info.
    else {
      // No script found, just print the about text file.
      res.setStatus(404);
      res.println("404 Not Found: " + req.request);
      console.log("Couldn't find resource '" + req.request + "'.");
    }
  }
  // Handle HTTP POST request.
  else if (req.method.toLowerCase() === "post") {
    if (jsd.services.contains(req.request)) {
      // Handle RPC request.
      res.println(jsd.callService(req.request, req.getContent()).toString());
    }
    // Can't find what you're looking for. Normally this would be where you
    // deliver the 404, but we we are just going to print the req info.
    else {
      // No script found, just print the about text file.
      res.setStatus(404);
      res.println("404 Not Found: " + req.request);
    }
  }
  // Only support GET/POST requests.
  else {
    // Unsupported method.
    res.setStatus(405);
    res.println("405 Method not allowed.");
  }
};

/**
 * On getLightStatus handler.
 * @param ReqObj is a JS object with the call parameter.
 * @return A JS object with the call result.
 */
JsdServerImpl.prototype.onGetLightStatus = function (ReqObj) {
  console.log('returning light status ' + lstatus);
  return { status: lstatus };
};

/**
 * On setLightStatus handler.
 * @param ReqObj is a JS object with the call parameter.
 * @return A JS object with the call result.
 */
JsdServerImpl.prototype.onSetLightStatus = function (ReqObj) {
  console.log('setting status to ' + ReqObj.status);
  lstatus = ReqObj.status;
  return null;
};

JsdServerImpl.prototype.constructor = JsdServerImpl;

// Create an instance of the JsdServerImpl and start it.
var sv = new JsdServerImpl();
sv.start();
