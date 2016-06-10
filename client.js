#!/usr/bin/ic9
/*
 * Copyright (c) 2016 Austin Lehman.
 * Distributed under the BSD 3-Clause License.
 * (See accompanying file LICENSE or copy at https://github.com/rsv-code/jsd)
 */

// Include a few needed items ...
include("lib/JsdClient.js");

// Create a new instance of the JsdClient.
var cli = new JsdClient("http://localhost:8080");

// Call the setLightStatus method.
console.log("Calling setLightStatus with status set to 'true'.");
cli.callMethod("/lighting/lightSimple", "setLightStatus", { status: true });

// Call the getLightStatus method and print the returned object.
console.log("Calling getLightStatus:");
console.info(cli.callMethod("/lighting/lightSimple", "getLightStatus").toString());
