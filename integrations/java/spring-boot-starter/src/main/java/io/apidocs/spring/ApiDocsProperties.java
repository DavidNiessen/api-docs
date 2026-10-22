package io.apidocs.spring;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("api-docs")
public class ApiDocsProperties {
  private boolean enabled = true;
  private String directory;
  private String path = "/docs";
  private String publicBasePath;
  private String artifactDigest;
  public boolean isEnabled() { return enabled; }
  public void setEnabled(boolean value) { enabled = value; }
  public String getDirectory() { return directory; }
  public void setDirectory(String value) { directory = value; }
  public String getPath() { return path; }
  public void setPath(String value) { path = value; }
  public String getPublicBasePath() { return publicBasePath; }
  public void setPublicBasePath(String value) { publicBasePath = value; }
  public String getArtifactDigest() { return artifactDigest; }
  public void setArtifactDigest(String value) { artifactDigest = value; }
}
