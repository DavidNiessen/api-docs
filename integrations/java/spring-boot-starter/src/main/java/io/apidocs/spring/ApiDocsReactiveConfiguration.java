package io.apidocs.spring;
import io.apidocs.core.Publication;
import java.io.IOException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.reactive.config.WebFluxConfigurer;
import org.springframework.web.reactive.config.ResourceHandlerRegistry;
import org.springframework.web.reactive.resource.PathResourceResolver;
import reactor.core.publisher.Mono;

@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(WebFluxConfigurer.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.REACTIVE)
class ApiDocsReactiveConfiguration implements WebFluxConfigurer {
  private final Publication publication;
  private final ApiDocsProperties properties;
  ApiDocsReactiveConfiguration(Publication publication, ApiDocsProperties properties) { this.publication = publication; this.properties = properties; }
  @org.springframework.context.annotation.Bean
  org.springframework.web.reactive.function.server.RouterFunction<org.springframework.web.reactive.function.server.ServerResponse> apiDocsIndex() {
    return org.springframework.web.reactive.function.server.RouterFunctions.route(
      org.springframework.web.reactive.function.server.RequestPredicates.GET(properties.getPath()).or(org.springframework.web.reactive.function.server.RequestPredicates.GET(properties.getPath() + "/")),
      request -> org.springframework.web.reactive.function.server.ServerResponse.temporaryRedirect(java.net.URI.create(publication.basePath() + "/index.html")).build());
  }
  @Override public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry.addResourceHandler(properties.getPath() + "/**")
      .addResourceLocations(publication.root().toUri().toString()).resourceChain(false)
      .addResolver(new PathResourceResolver() {
        @Override protected Mono<Resource> getResource(String path, Resource location) {
          String file = path.isEmpty() ? "index.html" : path.endsWith("/") ? path + "index.html" : path;
          if (!publication.contains(file) && !file.substring(file.lastIndexOf('/') + 1).contains(".")) file += "/index.html";
          if (!publication.contains(file)) return Mono.empty();
          try { publication.resolve(file); } catch (IOException error) { return Mono.error(error); }
          return super.getResource(file, location);
        }
      });
  }
}
