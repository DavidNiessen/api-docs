---
order: 1
title: Quickstart
description: Your first successful API request in under five minutes.
group: Get started
---

## Before you begin

Start the included mock API with `npm run demo:api`. You do not need an external account. The demo accepts the token `demo-token`.

## Make your first request

List the projects in your workspace:

```sh
curl http://127.0.0.1:4010/v1/projects \
  --header 'Authorization: Bearer demo-token'
```

The API responds with a JSON object containing your projects and pagination metadata.

## Create a project

```sh
curl --request POST http://127.0.0.1:4010/v1/projects \
  --header 'Authorization: Bearer demo-token' \
  --header 'Content-Type: application/json' \
  --data '{"name":"My first project"}'
```

## Build your integration

Use the API reference to inspect request schemas, copy code snippets, and send requests. Configure the server field to point at your own API when you import your specification.

Need to repeat the check? [Return to your first request](quickstart.md#heading-make-your-first-request).
