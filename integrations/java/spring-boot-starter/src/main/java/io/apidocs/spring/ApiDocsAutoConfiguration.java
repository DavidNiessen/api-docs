package io.apidocs.spring;
import io.apidocs.core.Publication;
import java.io.IOException;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.beans.factory.ObjectProvider;

/** Mounts a verified publication using the available web stack and existing host security. */
@AutoConfiguration
@ConditionalOnProperty(prefix = "api-docs", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(ApiDocsProperties.class)
@Import({ApiDocsMvcConfiguration.class, ApiDocsReactiveConfiguration.class})
public class ApiDocsAutoConfiguration {
  /** Create the auto-configuration discovered by Spring Boot. */
  public ApiDocsAutoConfiguration() {}
  @Bean
  Publication apiDocsPublication(ApiDocsProperties properties, Environment environment,
      ObjectProvider<ApiDocsHostContext> hostContext) throws IOException {
    if (properties.getDirectory() == null) {
      throw new IllegalArgumentException("Set api-docs.directory to a prebuilt publication directory, or disable api-docs.enabled");
    }
    String mount = properties.mountPrefix();
    var publication = new Publication(Path.of(properties.getDirectory()), properties.getArtifactDigest());
    String context = hostContext.getIfAvailable(() -> new ApiDocsHostContext(
        environment.getProperty("server.servlet.context-path",
            environment.getProperty("spring.webflux.base-path", "")))).prefix();
    String expected = properties.getPublicBasePath() == null ? context + mount : properties.getPublicBasePath();
    if (!publication.basePath().equals(expected)) {
      throw new IllegalArgumentException("Publication basePath must match the public context and docs path: " + expected);
    }
    return publication;
  }
}
