package io.apidocs.spring;
import io.apidocs.core.Publication;
import java.io.IOException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.resource.PathResourceResolver;

@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(WebMvcConfigurer.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
class ApiDocsMvcConfiguration implements WebMvcConfigurer {
  private final Publication publication;
  private final ApiDocsProperties properties;
  ApiDocsMvcConfiguration(Publication publication, ApiDocsProperties properties) { this.publication = publication; this.properties = properties; }
  @Override public void addViewControllers(org.springframework.web.servlet.config.annotation.ViewControllerRegistry registry) {
    registry.addRedirectViewController(properties.getPath(), publication.basePath() + "/index.html");
    registry.addRedirectViewController(properties.getPath() + "/", publication.basePath() + "/index.html");
  }
  @Override public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry.addResourceHandler(properties.getPath() + "/**")
      .addResourceLocations(publication.root().toUri().toString()).setCachePeriod(0)
      .resourceChain(false).addResolver(new PathResourceResolver() {
        @Override protected Resource getResource(String path, Resource location) throws IOException {
          String file = path.isEmpty() ? "index.html" : path.endsWith("/") ? path + "index.html" : path;
          if (!publication.contains(file) && !file.substring(file.lastIndexOf('/') + 1).contains(".")) file += "/index.html";
          if (!publication.contains(file)) return null;
          publication.resolve(file);
          return super.getResource(file, location);
        }
      });
  }
}
