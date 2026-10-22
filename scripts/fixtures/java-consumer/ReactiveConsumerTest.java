package io.apidocs.consumer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.MapReactiveUserDetailsService;
import org.springframework.security.web.server.SecurityWebFilterChain;

class ReactiveConsumerTest {
  @SpringBootConfiguration @EnableAutoConfiguration @Import(Security.class)
  static class Application {}
  static class Security {
    @Bean MapReactiveUserDetailsService users() {
      return new MapReactiveUserDetailsService(User.withUsername("reader").password("{noop}fixture-password").roles("DOCS").build());
    }
    @Bean SecurityWebFilterChain security(ServerHttpSecurity http) {
      return http.authorizeExchange(authorize -> authorize.anyExchange().authenticated())
          .httpBasic(Customizer.withDefaults()).build();
    }
  }
  @Test void installedStarterWorksWithOnlyWebFluxBehindHostSecurityAndContextPath() throws Exception {
    HostProbe.exercise(Application.class, WebApplicationType.REACTIVE,
        "org.springframework.web.servlet.DispatcherServlet");
  }
}
