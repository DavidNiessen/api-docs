package io.apidocs.consumer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

class MvcConsumerTest {
  @SpringBootConfiguration @EnableAutoConfiguration @Import(Security.class)
  static class Application {}
  static class Security {
    @Bean InMemoryUserDetailsManager users() {
      return new InMemoryUserDetailsManager(User.withUsername("reader").password("{noop}fixture-password").roles("DOCS").build());
    }
    @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
      return http.authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
          .httpBasic(Customizer.withDefaults()).build();
    }
  }
  @Test void installedStarterWorksWithOnlyMvcBehindHostSecurityAndContextPath() throws Exception {
    HostProbe.exercise(Application.class, WebApplicationType.SERVLET,
        "org.springframework.web.reactive.DispatcherHandler");
  }
}
