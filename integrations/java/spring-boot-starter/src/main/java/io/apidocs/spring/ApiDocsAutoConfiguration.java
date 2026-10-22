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

@AutoConfiguration
@ConditionalOnProperty(prefix = "api-docs", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(ApiDocsProperties.class)
@Import({ApiDocsMvcConfiguration.class, ApiDocsReactiveConfiguration.class})
public class ApiDocsAutoConfiguration {
  @Bean
  Publication apiDocsPublication(ApiDocsProperties properties, Environment environment) throws IOException {
    if (properties.getDirectory() == null) {
      throw new IllegalArgumentException("Set api-docs.directory to a prebuilt publication directory, or disable api-docs.enabled");
    }
    if (!properties.getPath().matches("/[a-zA-Z0-9][a-zA-Z0-9/_-]*") || properties.getPath().endsWith("/")) {
      throw new IllegalArgumentException("api-docs.path must be an absolute path without a trailing slash");
    }
    var publication = new Publication(Path.of(properties.getDirectory()));
    String context = environment.getProperty("server.servlet.context-path",
        environment.getProperty("spring.webflux.base-path", ""));
    String expected = properties.getPublicBasePath() == null ? context + properties.getPath() : properties.getPublicBasePath();
    if (!publication.basePath().equals(expected)) {
      throw new IllegalArgumentException("Publication basePath must match the public context and docs path: " + expected);
    }
    return publication;
  }
}
