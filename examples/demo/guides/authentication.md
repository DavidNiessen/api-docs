---
order: 2
title: Authentication
description: Keep your integration secure with scoped API credentials.
group: Get started
---

## Bearer authentication

Include an API token in the `Authorization` header for every request:

```http
Authorization: Bearer YOUR_API_KEY
```

Never commit credentials to source control or include private tokens in public client applications. Use environment variables or an approved secret store in your service.

## Using the playground

Enter a token in the authentication field. Credentials remain in memory and are cleared when you navigate to a different endpoint or reload the page. Copied code uses placeholders.

## Demo credentials

The local mock API accepts `demo-token`. It is a public fixture, not a production credential.

## Rotate compromised keys

Revoke exposed tokens, issue replacements, update your secret store, and review access logs. Documentation must never be the only security boundary protecting your API.
