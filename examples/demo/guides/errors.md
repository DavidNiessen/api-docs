---
order: 3
title: Errors
description: Understand errors and build resilient integrations.
group: Essentials
---

## HTTP status codes

| Status | Meaning                          | What to do                       |
| ------ | -------------------------------- | -------------------------------- |
| 200    | Request succeeded                | Read the response body           |
| 201    | Resource created                 | Store the returned identifier    |
| 204    | Request succeeded without a body | Continue without parsing JSON    |
| 400    | Invalid request                  | Check parameters and schema      |
| 401    | Authentication required          | Supply a valid token             |
| 404    | Resource not found               | Verify the resource identifier   |
| 429    | Rate limited                     | Respect Retry-After and back off |

## Error response

```json
{
  "error": "not_found",
  "message": "The requested resource does not exist."
}
```

## Retry safely

Retry idempotent reads with bounded exponential backoff and jitter. Do not blindly retry resource creation without a server-supported idempotency key.
