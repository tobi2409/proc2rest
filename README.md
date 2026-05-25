# proc2rest
A code generator that converts TypeScript RPC functions into REST APIs with automatic client generation.

## Overview

**proc2rest** generates:
- Express.js server routes from TypeScript functions
- JavaScript ES modules API clients with full type support
- Support for JSON and binary (MessagePack) transport formats

## Key Features

- **Automatic REST Endpoint Generation**: Exports from TypeScript files become REST endpoints
- **Binary Data Support**: Type-aware detection of binary parameters (Uint8Array, ArrayBuffer, Blob, etc.)
- **MessagePack Transport**: Efficient binary serialization for endpoints with binary parameters
- **ES Module Clients**: Auto-generated JS clients as native ES modules
- **CORS & Configuration**: Centralized config via `proc2rest.config.json`

## Configuration

Create `proc2rest.config.json` in your project root:

```json
{
  "clients": [
    { "filename": "index.html", "servers": [] },
    { "filename": "index.js", "servers": ["my-server.ts"] }
  ],
  "servers": ["my-server.ts"],
  "apiUrl": "http://localhost:3000",
  "cors": { "origin": "*" },
  "binaryTypes": [
    "ArrayBuffer",
    "Uint8Array",
    "Buffer",
    "Blob",
    "File"
  ]
}
```

**Config Fields:**
- `clients`: Array of client files. Each entry:
  - `filename`: Source file path (`.html`, `.js`, etc.)
  - `servers`: List of server files to generate clients for (only for `.js` files)
- `servers`: Array of server files to generate routes from
- `apiUrl`: Base URL for API requests (default: `http://localhost:3000`)
- `cors`: CORS options for Express
- `binaryTypes`: Type names considered binary (matched against TS types)

## Setup

### 1. Install Dependencies

```bash
cd scripts
npm install
```

### 2. Create Server Functions

In `my-server.ts`:

```typescript
interface Person {
  name: string
  age: number
}

export function getPerson(name: string): Person {
  return { name, age: 30 }
}

export function uploadFile(filename: string, data: Uint8Array): string {
  return `${filename}: ${data.byteLength} bytes`
}
```

### 3. Generate Code

```bash
npm run generate --appPath=../examples/example1
```

This creates:
- `generated/server/express-routes.generated.ts` - Express routes
- `generated/server/package.json` - Server dependencies
- `generated/client/my-server.ts-client.js` - API client module
- `generated/client/index.js` - Updated with imports (from `index.js` config)

### 4. Start Server

```bash
cd generated/server
npm install
npm start
```

The server runs on port 3000 (or `$PORT` env var).

### 5. Use Client in HTML

`index.html`:
```html
<script type="module" src="index.js"></script>
<button id="btn">Get Person</button>
```

`index.js` (auto-updated by generator):
```javascript
import * as my_server_ts_client_js from './my-server.ts-client.js'
const { getPerson } = my_server_ts_client_js

document.getElementById('btn').addEventListener('click', async () => {
  const person = await getPerson('Jane Doe')
  console.log(person)
})
```

## How It Works

### HTTP Method Detection

The HTTP method is automatically derived from the function name prefix:

| Prefix | HTTP Method |
|--------|-------------|
| `get`, `list`, `find` | `GET` |
| `create`, `add`, `insert` | `POST` |
| `update`, `set`, `patch` | `PATCH` |
| `delete`, `remove` | `DELETE` |
| *(anything else)* | `POST` |

Examples: `getPerson` → `GET`, `addPerson` → `POST`, `deleteUser` → `DELETE`.

### Server Generation

1. Parser (`route-stubs.js`) uses `ts-morph` to extract function signatures
2. HTTP method is resolved from the function name (see above)
3. Detects parameter types against `binaryTypes` config
4. Generates appropriate middleware:
   - `express.json()` for JSON endpoints
   - `express.raw({ type: 'application/msgpack' })` for binary endpoints
4. Routes are created in `express-routes.generated.ts`

### Client Generation

1. Extracts all exported functions from server files
2. Creates `{serverName}-client.js` with ESM exports
3. Each function becomes an async API call:
   - JSON endpoints: `JSON.stringify()` request body
   - Binary endpoints: `MessagePack.encode()` request body
4. Injects `import` statements into client JS files

### Transport Formats

**JSON (default):**
```javascript
await request('/api/getPerson', 'GET', { name: 'John' }, 'application/json')
```

**MessagePack (for binary params):**
```javascript
const data = new Uint8Array([1, 2, 3])
await request('/api/uploadFile', 'POST', { filename: 'test', data }, 'application/msgpack')
```

Response handling is automatic—the client detects the response `content-type` and decodes accordingly.

## File Upload Example

### Server

```typescript
export function processFile(filename: string, data: Uint8Array): number {
  return data.byteLength
}
```

### Client HTML

```html
<input type="file" id="fileInput" />
<button id="uploadBtn">Upload</button>
```

### Client JS

```javascript
import { processFile } from './my-server.ts-client.js'

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const file = document.getElementById('fileInput').files[0]
  const uint8Array = new Uint8Array(await file.arrayBuffer())
  
  const result = await processFile(file.name, uint8Array)
  console.log(`File processed: ${result} bytes`)
})
```

## Project Structure

```
proc2rest/
├── scripts/
│   ├── generate-server.js          # Server generator
│   ├── generate-client.js          # Client generator
│   ├── shared/
│   │   ├── route-stubs.js          # TS parser
│   │   ├── generator-config.js     # Config loader
│   │   └── app-path.js
│   └── templates/
│       ├── express-route.template.txt
│       ├── express-routes-file.template.txt
│       ├── client-file.template.txt
│       ├── client-method.template.txt
│       └── generated-package.template.json
└── examples/
    └── example1/
        ├── proc2rest.config.json
        ├── my-server.ts
        ├── index.html
        ├── index.js
        └── generated/              # Auto-generated
```

## Development

To regenerate after changes to server functions:

```bash
cd proc2rest/scripts
npm run generate --appPath=../examples/example1
```

Then restart the server:

```bash
cd ../examples/example1/generated/server
npm start
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
- **Namespacing for multiple servers**: Prevent method name collisions by grouping exports per server (e.g., `userApi.getUser()`, `orderApi.getUser()`)
- **Filename patterns in config**: Support glob patterns like `*.server.ts` instead of listing individual files
- **HTTP method rules in config**: Allow custom function-to-HTTP-method mapping (e.g., `{ "methods": { "fetch": "GET", "store": "POST" } }`)
- **Authentication hooks**: Flexible auth header generation (Bearer, API-Key, custom)
- **Vanilla Express route support**: Allow custom routes and arbitrary code (imports, middleware, custom handlers) to be included 1:1 in generated server

### Medium Priority
- Selective function export (ability to exclude specific functions from API)
- Content negotiation on server (respond based on `Accept` header)

### Nice to Have
- Custom templates for generated code (e.g., DB pool initialization, middleware hooks)
- Class/namespace exports with method grouping
- Built-in integration tests for JSON + Binary roundtrips

## License

ISC