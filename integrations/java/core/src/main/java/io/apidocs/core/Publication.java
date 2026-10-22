package io.apidocs.core;

import com.google.gson.Strictness;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;

/** A verified, immutable static publication. No JavaScript runtime is needed to serve it. */
public final class Publication {
  private final Path root;
  private final String basePath;
  private final String artifactDigest;
  private final Set<String> files;

  public Publication(Path directory) throws IOException {
    this(directory, null);
  }

  /** Pin the digest to a value obtained from a trusted build or release inventory. */
  public Publication(Path directory, String expectedArtifactDigest) throws IOException {
    root = directory.toRealPath();
    Manifest manifest = Manifest.read(root.resolve("manifest.json"));
    artifactDigest = manifest.artifactDigest;
    if (expectedArtifactDigest != null && (!expectedArtifactDigest.matches("[a-f0-9]{64}")
        || !MessageDigest.isEqual(expectedArtifactDigest.getBytes(StandardCharsets.US_ASCII),
            artifactDigest.getBytes(StandardCharsets.US_ASCII))))
      throw new IOException("Publication does not match the pinned artifact digest");
    files = manifest.files.keySet();
    for (String file : files) {
      Path path = resolve(file);
      try (var stream = Files.newInputStream(path)) {
        var digest = MessageDigest.getInstance("SHA-256");
        var bytes = new byte[8192];
        int length;
        while ((length = stream.read(bytes)) != -1) digest.update(bytes, 0, length);
        if (!HexFormat.of().formatHex(digest.digest()).equals(
            manifest.files.get(file))) {
          throw new IOException("Publication checksum mismatch: " + file);
        }
      } catch (NoSuchAlgorithmException error) {
        throw new IOException("SHA-256 is unavailable", error);
      }
    }
    basePath = readBasePath(resolve("site.json"));
  }

  private static String readBasePath(Path site) throws IOException {
    String base = null; boolean config = false;
    // Skip the aggregate graph instead of materializing every guide and schema in Java memory.
    try (var stream = Files.newInputStream(site);
         var input = new InputStreamReader(stream, StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT));
         var reader = new JsonReader(input)) {
      reader.setStrictness(Strictness.STRICT);
      reader.beginObject();
      while (reader.hasNext()) {
        if (!reader.nextName().equals("config")) { reader.skipValue(); continue; }
        if (config) throw new IOException("Duplicate publication configuration");
        config = true; reader.beginObject();
        while (reader.hasNext()) {
          if (!reader.nextName().equals("basePath")) { reader.skipValue(); continue; }
          if (base != null || reader.peek() != JsonToken.STRING) throw new IOException("Invalid publication base path");
          base = reader.nextString();
        }
        reader.endObject();
      }
      reader.endObject();
      if (reader.peek() != JsonToken.END_DOCUMENT || base == null || !(base.isEmpty()
          || base.matches("/[a-zA-Z0-9][a-zA-Z0-9/_-]*") && !base.endsWith("/")))
        throw new IOException("Invalid publication base path");
      return base;
    } catch (RuntimeException error) { throw new IOException("Invalid publication configuration"); }
  }

  public Path resolve(String file) throws IOException {
    if (!files.contains(file)) throw new IOException("File is not in the publication manifest");
    Path target = root.resolve(file).toRealPath();
    if (!target.startsWith(root) || !Files.isRegularFile(target)) {
      throw new IOException("Publication path escapes its root");
    }
    return target;
  }

  public boolean contains(String file) { return files.contains(file); }
  public String basePath() { return basePath; }
  public String artifactDigest() { return artifactDigest; }
  public Path root() { return root; }
}
