// Standalone Go standard-library code for an already prepared, redacted request.
export function goSnippet(request) {
  if (request.multipart)
    throw new Error('This example does not support multipart');
  const quote = (value) => {
    if (new TextDecoder().decode(new TextEncoder().encode(value)) !== value)
      throw new Error('Go examples require valid Unicode');
    return JSON.stringify(value);
  };
  return `package main

import (
  "fmt"
  "io"
  "log"
  "net/http"
  "strings"
  "time"
)

func main() {
  client := &http.Client{
    Timeout: 30 * time.Second,
    CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse },
  }
  request, err := http.NewRequest(${quote(request.method)}, ${quote(request.url)}, strings.NewReader(${quote(request.body ?? '')}))
  if err != nil { log.Fatal(err) }
${Object.entries(request.headers)
  .map(([key, value]) => `  request.Header.Set(${quote(key)}, ${quote(value)})`)
  .join('\n')}
  response, err := client.Do(request)
  if err != nil { log.Fatal(err) }
  defer response.Body.Close()
  body, err := io.ReadAll(io.LimitReader(response.Body, 2 * 1024 * 1024 + 1))
  if err != nil { log.Fatal(err) }
  if len(body) > 2 * 1024 * 1024 { log.Fatal("Response exceeds 2 MiB") }
  fmt.Print(string(body))
  if response.StatusCode < 200 || response.StatusCode >= 300 { log.Fatalf("HTTP %d", response.StatusCode) }
}
`;
}
