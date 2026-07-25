# proc2rest

A code generator that converts TypeScript RPC functions into REST APIs with automatic client generation.

## Overview

**proc2rest** generates:

- Express.js server routes from TypeScript functions
- JavaScript ES modules API clients with full type support
- Support for JSON and binary (MessagePack) transport formats

## Key Features

- **Automatic REST Endpoint Generation**: Exported functions marked with `@rest` become REST endpoints
- **Binary Data Support**: Type-aware detection of binary parameters (Uint8Array, ArrayBuffer, Blob, etc.)
- **MessagePack Transport**: Efficient binary serialization for endpoints with binary parameters
- **ES Module Clients**: Auto-generated JS clients as native ES modules
- **CORS & Configuration**: Centralized config via `proc2rest.config.json`
- **Handlebars-based Templates**: Stable code generation via adapter-owned templates

## Configuration

Create `proc2rest.config.json` in your project root:

```json
{
    "jsClients": ["src/client/index.js"],
    "servers": [
        { "src": "src/server/first/my-server.ts", "namespace": "myServer" }
    ],
    "rawServerFiles": ["src/server/my-server-raw.ts"],
    "apiUrl": "http://localhost:3000",
    "cors": { "allowOrigin": "*" },
    "rateLimit": {
        "windowDurationMs": 900000,
        "maxRequests": 100,
        "useStandardHeaders": true,
        "useLegacyHeaders": false
    },
    "errorStatusCodes": {
        "UnsupportedArgumentError": 422
    },
    "method-rules": {
        "GET": "^(get|list|find)",
        "POST": "^(create|add|insert)",
        "PATCH": "^(update|set|patch)",
        "DELETE": "^(delete|remove)"
    },
    "method-rules-custom-functions": {
        "getBinDataInfo": "POST"
    },
    "binaryTypes": ["ArrayBuffer", "Uint8Array", "Buffer", "Blob", "File"]
}
```

**Config Fields:**

- `jsClients`: JS client source files that should receive `@server-import` injection
- `servers`: Array of server descriptors with:
    - `src`: server source path
    - `namespace`: import namespace used for generated routes and clients
- `rawServerFiles`: extra server files to inline into `routes.generated.ts`
- `apiUrl`: Base URL for API requests (default: `http://localhost:3000`)
- `cors`: Framework-neutral CORS config (translated by the server adapter, e.g. `allowOrigin`)
- `rateLimit`: Framework-neutral rate-limit config (translated by the server adapter, e.g. `windowDurationMs`, `maxRequests`)
- `errorStatusCodes`: map from error class name to HTTP status code
- `method-rules`: regex map for method resolution by function name
- `method-rules-custom-functions`: exact function name overrides for HTTP method
- `binaryTypes`: Type names considered binary (matched against TS types)

## Setup

### Use in your own project

Install in your app project:

```bash
npm install --save-dev proc2rest
```

Then run via `npx` (or `npm exec`):

```bash
npx proc2rest
```

Or add a script in your app's `package.json`:

```json
{
    "scripts": {
        "generate-api": "proc2rest"
    }
}
```

Then run:

```bash
npm run generate-api
```

Note: local package binaries are available through `npx`/`npm run` and are located under `node_modules/.bin`.

A complete example project is available on GitHub:
https://github.com/tobi2409/proc2rest/tree/main/examples/example1

Optional with explicit parameters:

```bash
npx proc2rest \
  --appPath=. \
  --srcServerDir=src/server \
  --generatedServerDir=generated/srv \
  --srcClientDir=src/client \
  --generatedClientDir=generated/cl \
  --configPath=proc2rest.config.json
```

Parameter overview:

- `--appPath`: Root of your app project (default: `.`)
- `--srcServerDir`: Source directory for server TS files (default: `src/server`)
- `--generatedServerDir`: Output directory for generated server code (default: `generated/srv`)
- `--srcClientDir`: Source directory for client JS files (default: `src/client`)
- `--generatedClientDir`: Output directory for generated client code (default: `generated/cl`)
- `--configPath`: Path to `proc2rest.config.json` (default: `<appPath>/proc2rest.config.json`)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Server Functions

In `my-server.ts`:

```typescript
interface Person {
    name: string
    age: number
}

// @rest
export function getPerson(name: string): Person {
    return { name, age: 30 }
}

// @rest
// @middleware(auth)
export function uploadFile(filename: string, data: Uint8Array): string {
    return `${filename}: ${data.byteLength} bytes`
}
```

### 3. Generate Code

```bash
npm run generate --appPath=examples/example1 --srcServerDir=src/server --generatedServerDir=generated/srv --srcClientDir=src/client --generatedClientDir=generated/cl
```

This creates (u. a.):

- `examples/example1/generated/srv/routes.generated.ts` - Express routes
- `examples/example1/generated/srv/logger.ts` - Shared logger utility
- copies of server source files from `src/server/**` into `generated/srv/**`
- generated API clients per configured server, e.g. `generated/cl/first/my-server-client.js`
- copied JS client source files from `src/client/**` into `generated/cl/**`
- injected imports in copied JS clients via `// @server-import <server-file.ts>` markers

### 4. Start Server

```bash
cd examples/example1/generated/srv
npm install
npm start
```

The generated Express app listens on port 3000 by default (or `$PORT`).

### 5. Use Client in HTML

`index.html`:

```html
<script type="module" src="index.js"></script>
<button id="btn">Get Person</button>
```

`src/client/index.js` (source, with `@server-import` marker):

```javascript
// @server-import first/my-server.ts

const { getPerson } = myServer

document.getElementById('btn').addEventListener('click', async () => {
    const person = await getPerson('Jane Doe')
    console.log(person)
})
```

## How It Works

### HTTP Method Detection

The HTTP method is automatically derived from the function name prefix:

| Prefix                    | HTTP Method |
| ------------------------- | ----------- |
| `get`, `list`, `find`     | `GET`       |
| `create`, `add`, `insert` | `POST`      |
| `update`, `set`, `patch`  | `PATCH`     |
| `delete`, `remove`        | `DELETE`    |
| _(anything else)_         | `POST`      |

Examples: `getPerson` → `GET`, `addPerson` → `POST`, `deleteUser` → `DELETE`.

### Server Generation

1. Parser (`exported-functions-metadata.js`) uses `ts-morph` to extract function signatures
2. Only exported functions marked with `@rest` are mapped to routes
3. HTTP method is resolved from the function name (or custom overrides)
4. `@middleware(nameA, nameB)` markers are collected per route
5. Detects parameter types against `binaryTypes` config
6. Generates appropriate middleware:

- `express.json()` for JSON endpoints
- `express.raw({ type: 'application/msgpack' })` for binary endpoints

7. Routes are created in `routes.generated.ts`

### Client Generation

1. Uses metadata from configured `servers`
2. Creates `<server-file>-client.js` files with ESM exports
3. Each function becomes an async API call:

- JSON endpoints: `JSON.stringify()` request body
- Binary endpoints: `MessagePack.encode()` request body

4. Injects imports into configured `jsClients` from `// @server-import ...` markers

### Templates

- Generation uses Handlebars templates in adapter folders
- `{{...}}` for escaped values, `{{{...}}}` for raw code insertion

### Transport Formats

**JSON (default):**

```javascript
await request(
    '/api/myServer/getPerson',
    'GET',
    { name: 'John' },
    'application/json'
)
```

**MessagePack (for binary params):**

```javascript
const data = new Uint8Array([1, 2, 3])
await request(
    '/api/myServer/uploadFile',
    'POST',
    { filename: 'test', data },
    'application/msgpack'
)
```

Response handling is automatic—the client detects the response `content-type` and decodes accordingly.

## `@server-import` Marker

In JS client files under `src/client`, add markers like:

```javascript
// @server-import first/my-server.ts
```

During generation, proc2rest replaces these markers with proper client imports.

## Project Structure

```
proc2rest/
├── scripts/
│   ├── distro/
│   │   ├── express.js
│   │   ├── fetch.js
│   │   └── express-fetch.js
│   ├── generators/
│   │   ├── generate-server.js
│   │   ├── generate-client.js
│   │   ├── adapters/
│   │   │   ├── server/express-adapter/
│   │   │   └── client/fetch-adapter/
│   │   └── shared/
│   │       ├── exported-functions-metadata.js
│   │       ├── generator-config.js
│   │       └── cli-args.js
│   └── package.json
└── examples/
   └── example1/
      ├── proc2rest.config.json
      ├── src/
      │   ├── server/
      │   └── client/
      └── generated/
```

## Development

To regenerate after changes to server/client files:

```bash
npm run generate --appPath=examples/example1 --srcServerDir=src/server --generatedServerDir=generated/srv --srcClientDir=src/client --generatedClientDir=generated/cl
```

To run the generated server:

```bash
cd examples/example1/generated/srv
npm install
npm start
```

## VS Code Setup

To prevent Live Server from reloading when server logs are written, add this to `.vscode/settings.json`:

```json
{
    "liveServer.settings.ignoreFiles": ["**/generated/srv/logs/**", "**/*.log"]
}
```

## Debugging MessagePack Requests

Add logging to client before sending:

```javascript
const msgpack = await getMsgPackModule()
console.log('Sending:', params)
const encoded = msgpack.encode(params)
console.log('Encoded bytes:', encoded)
```

Or inspect in browser DevTools → Network → binary request body.

## Limitations & TODOs

### High Priority

- **Unit tests for the generator**: Test metadata extraction, HTTP method resolution, and code generation output
- **HTTPS support**: Allow configuring an HTTPS server (cert/key paths via config or CLI) in the generated server bootstrap
- **Additional Express.js security mechanisms**: Support for `helmet`, stricter CORS policies, request size limits, and other hardening options via `proc2rest.config.json`

### Medium Priority

- **Filename patterns in config**: Support glob patterns like `*.server.ts` instead of listing individual files
