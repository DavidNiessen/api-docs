---
order: 4
title: Pagination
description: Navigate large collections with cursor-based pagination.
group: Essentials
---

## Request a page

Use `limit` to control page size. The API returns up to 100 results per request.

```sh
curl 'http://127.0.0.1:4010/v1/projects?limit=20' \
  --header 'Authorization: Bearer demo-token'
```

## Continue from a cursor

When `has_more` is true, pass the returned `next_cursor` value as `cursor` in the next request. Treat cursors as opaque strings.

## Keep your requests consistent

Preserve filters while paginating. Handle empty collections and deleted resources. Avoid assuming that a collection will remain unchanged across requests.
