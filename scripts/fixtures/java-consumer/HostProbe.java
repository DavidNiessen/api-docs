package io.apidocs.consumer;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;

final class HostProbe {
  static void exercise(Class<?> application, WebApplicationType type, String absentClass) throws Exception {
    assertThrows(ClassNotFoundException.class, () -> Class.forName(absentClass),
        "Optional dependencies must remain absent from this consumer's classpath");
    Path root = Path.of(System.getProperty("apiDocs.fixture"));
    Path hidden = root.resolve("unlisted-consumer-file.txt");
    Files.writeString(hidden, "A real file outside the publication manifest");
    try (var context = new SpringApplicationBuilder(application).web(type).properties(
        "server.port=0", "server.servlet.context-path=/gateway", "spring.webflux.base-path=/gateway",
        "api-docs.directory=" + root, "api-docs.path=/docs",
        "api-docs.artifact-digest=" + System.getProperty("apiDocs.artifactDigest"),
        "spring.main.banner-mode=off", "logging.level.root=WARN").run()) {
      String base = "http://127.0.0.1:" + context.getEnvironment().getProperty("local.server.port");
      var client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();
      String credential = "Basic " + Base64.getEncoder().encodeToString(
          "reader:fixture-password".getBytes(StandardCharsets.UTF_8));
      for (String path : new String[]{"/", "/search.json", "/assets/reader.js", "/guides/quickstart/",
          "/oauth/callback/", "/assets/oauth-callback.js"}) {
        URI uri = URI.create(base + "/gateway/docs" + path);
        assertEquals(401, client.send(HttpRequest.newBuilder(uri).GET().build(),
            HttpResponse.BodyHandlers.ofString()).statusCode(), "Host security must cover " + path);
        var response = client.send(HttpRequest.newBuilder(uri).header("Authorization", credential).GET().build(),
            HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(), "Failed to serve " + path + " at " + response.uri());
        if (path.equals("/")) assertEquals("/gateway/docs/index.html", response.uri().getPath(),
            "The context prefix must appear exactly once in the landing-page redirect");
      }
      for (String path : new String[]{"/missing.json", "/unlisted-consumer-file.txt"}) {
        assertEquals(404, client.send(HttpRequest.newBuilder(URI.create(base + "/gateway/docs" + path))
            .header("Authorization", credential).GET().build(), HttpResponse.BodyHandlers.ofString()).statusCode());
      }
    } finally {
      Files.deleteIfExists(hidden);
    }
  }
}
