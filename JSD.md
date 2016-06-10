# JSD - JSON Service Definition

###### Origin Date:
2016-06-07

###### Updated:
2016-06-07

###### Author:
Austin Lehman [(lehman.austin@gmail.com)](mailto:lehman.austin@gmail.com?Subject=JSD)

## Overview

JSON service defintion is a specification for creating a web service definition
in JSON for use with JSON-RPC and JSON Schema specifications. JSD provides a simple
standard to define services. Simple is key here and JSD leans heavily
on JSON-RPC and JSON Schema specifications for handling many details of the
service definition.

## What is it?

JSD is a specification for defining web services. The main thing JSD does is define
high level interface properties, methods, and their parameters and return data types.

## JSD Objectives

These are the core objectives that guide the JSD specification. Any future revisions
of the specification should use these principals to inform changes.

* **Simple definition.** The service definition shouldn't be overly complicated.
* **Unambiguous.** The definition should contain all information required to
interact with the interface.
* **Self documenting.** Fields within the service definition should provide
documentation required for developers and end users to interact with.
* **Compartmentalized.** JSD should accomplish the task it was created for but not
try to solve every problem out there. Use existing standards where possible and
if it's desired to extend JSD for other use cases it's recommended to create
a new standard that uses JSD for it's own purposes.

## Definition Format
JSD is defined in JSON which itself is defined in [ECMA-404](http://www.json.org/)
definition. Thus the JSD itself should be defined in a valid JSON object. If saving
the JSD to a file it's recommended to use a lowercase .jsd file extension and the file
should only contains a single JSON object.

### Definition Attributes
There are just a few service definition attributes that need to be defined.

* **name** - Is a unique name for the interface definition. The purpose of name
is for a machine to differentiate one definition from another. The name may
contain uppercase letters, lowercase letters, numbers, dashes or underscores.

* **title** - Is a human readable string with the title of the interface.

* **description** - Is a human readable string with a description of the
interface.

Below is an example of the JSD definition attributes.
```
{
  "name": "simpleLightControl",
  "title": "Simple Light Control",
  "description": "Provides an interface for controlling a basic on/off light switch.",
  ...
}
```

### Types
The types section of the definition defines JSON Schema data types and their schema
locations. These definitions are references used by methods to define param, return
and error complex data types.

The types key is an alphanumeric identifier and the value is a string with the
relative path of the JSON Schema file that defines that type. The relative
path must start with a forward slash and exist on the server at that location
in the same domain.

Below is an example of the types section. In this example we define two types,
lightStatus and deviceFailure. These two types refer to lightStatus.json
and deviceFailure.json JSON Schema files.
```
{
  "name": "simpleLightControl",
  "title": "Simple Light Control",
  "description": "Provides an interface for controlling a basic on/off light switch.",
  "types": {
    "lightStatus": "/lighting/lightStatus.json",
    "deviceFailure": "/lighting/deviceFailure.json"
  },
...
}
```

/lighting/lightStatus.json
```
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Light Status",
  "description": "Defines the light status as on/off.",
  "type": "object",
  "properties": {
    "status": {
      "type": "boolean",
      "description": "A boolean value representing the light status. (True is On)",
      "readonly": false
    }
  },
  "required": ["status"]
}
```

/lighting/deviceFailure.json
```
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Device Failure",
  "description": "An unexpected device failure occurred.",
  "type": "object",
  "properties": {
    "code": {
      "type": "integer",
      "description": "A integer with the device failure code.",
      "readonly": true
    },
    "description": {
      "type": "string",
      "description": "The error string.",
      "readonly": true
    }
  }
}
```

### Methods
The methods section defines the actual methods that can be performed against the
interface. Method object keys are the method names and their values define name,
description, parameters, return values and errors.

The methods key is an alphanumeric identifier that is the name of the method. Each
method value is an object with the following attributes.

* **title** - Is a human readable string with the title of the method. It's
assumed that this will be visible to the end user.

* **description** - Is a human readable string with a description of the
method. It's assumed that this will be visible to the end user.

* **param** - Is either null or a string that matches a key within the 'types'
section which defines the method argument data type.

* **result** - Is either null or a string that matches a key within the 'types'
section which defines the method return data type.

* **errors** - Is an optional JSON array of strings with names of keys within
the 'types' section which defines expected error data types.


Below is an example of a methods section which defines two methods getLightStatus
and setLightStatus. The getLightStatus method expects no param to be provided
because it's set to null and expects a 'lightStatus' data type as the return
object. The setLightStatus expects the parameter to ge a 'lightStatus' object
and will return nothing as defined by null. Both methods may return a 'deviceFailure'
object as part of an error if it occurrs.

Full Definition: /lighting/lightSimple.jsd
```
{
  "name": "simpleLightControl",
  "title": "Simple Light Control",
  "description": "Provides an interface for controlling a basic on/off light switch.",
  "types": {
    "lightStatus": "/lighting/lightStatus.json",
    "deviceFailure": "/lighting/deviceFailure.json"
  },
  "methods": {
    "getLightStatus": {
      "title": "Get Light Status",
      "description": "Gets the status (on/off) of the light.",
      "param": null,
      "result": "lightStatus",
      "errors": [ "deviceFailure" ]
    },
    "setLightStatus": {
      "title": "Set Light Status",
      "description": "Sets the status (on/off) of the light.",
      "param": "lightStatus",
      "result": null,
      "errors": [ "deviceFailure" ]
    }
  }
}
```

## Transport Requirements

JSD uses a subset of [JSON-RPC 2.0](http://www.jsonrpc.org/specification) as
it's transport mechanism over the HTTP POST method. JSD does NOT currently
support the JSON-RPC Notification or Batch requests. The HTTP POST method is
used and the Content-Type HTTP header should be set to 'application/json'.

### JSON-RPC Request Parameters

* **id** - Is a string or number with the transaction ID. This must be a unique
value and the response to this call will include the same ID value.

* **jsonrpc** - Is a string with the JSON-RPC version. JSD currently only
supports the "2.0" value.

* **method** - Is a string with the method name to call.

* **params** - Is a JSON array with a single parameter. The parameter is
expected to be a JSON object of the type that is defined in the JSD. If the
JSD defines the param as null then the params section should be omitted in
the request.

setLightStatus HTTP Request JSON Content:
```
{
  "id": "12345",
  "jsonrpc": "2.0",
  "method": "setLightStatus",
  "params": [ { "status": true } ]
}
```

### JSON-RPC Response Parameters

* **id** - Is a string or number with the ID provided in the request.

* **jsonrpc** - Is a string with the JSON-RPC version. JSD currently only
supports the "2.0" value.

* **result** - Is a JSON object with the return object or null if no result
object is expected. In the event of an error the result must be omitted.

* **error** - Is a JSON object with the error. This object is defined in
JSON-RPC 2.0 specification in section 5.1. The error parameter must NOT be set if there is no
error and result is set.

setLightStatus HTTP Response JSON Content:
```
{
  "id": "12345",
  "jsonrpc": "2.0",
  "result": null
}
```
