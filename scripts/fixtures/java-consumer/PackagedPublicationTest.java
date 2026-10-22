package io.apidocs.consumer;

import static org.junit.jupiter.api.Assertions.*;
import io.apidocs.core.Publication;
import io.apidocs.spring.ApiDocsAutoConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;

class PackagedPublicationTest {
  @Test void publicClassesComeFromTheExactInstalledJarsAndVerifyTheRealPublication() throws Exception {
    verifyOrigin(Publication.class, "apiDocs.core.sha256");
    verifyOrigin(ApiDocsAutoConfiguration.class, "apiDocs.starter.sha256");
    var publication = new Publication(Path.of(System.getProperty("apiDocs.fixture")),
        System.getProperty("apiDocs.artifactDigest"));
    assertEquals("/gateway/docs", publication.basePath());
    assertTrue(publication.contains("index.html"));
    assertTrue(Files.readString(publication.resolve("index.html")).contains("/gateway/docs/assets/reader.js"));
    assertThrows(java.io.IOException.class, () -> publication.resolve("../private.txt"));
  }
  private void verifyOrigin(Class<?> type, String expectedProperty) throws Exception {
    var origin = Path.of(type.getProtectionDomain().getCodeSource().getLocation().toURI()).toRealPath();
    assertTrue(Files.isRegularFile(origin) && origin.getFileName().toString().endsWith(".jar"),
        "A consumer must use an installed JAR, never reactor classes");
    assertFalse(origin.startsWith(Path.of(System.getProperty("apiDocs.sourceRoot")).toRealPath()),
        "The installed artifact must be outside the source checkout");
    try (var input = Files.newInputStream(origin)) {
      var digest = MessageDigest.getInstance("SHA-256");
      var buffer = new byte[8192];
      for (int count; (count = input.read(buffer)) != -1;) digest.update(buffer, 0, count);
      assertEquals(System.getProperty(expectedProperty), HexFormat.of().formatHex(digest.digest()),
          "The consumer must load the exact inspected baseline candidate");
    }
  }
}
