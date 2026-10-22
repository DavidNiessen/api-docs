package io.apidocs.core;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** A verified, immutable static publication. No JavaScript runtime is needed to serve it. */
public final class Publication {
  private final Path root;
  private final String basePath;
  private final Set<String> files;

  public Publication(Path directory) throws IOException {
    root = directory.toRealPath();
    Gson gson = new Gson();
    JsonObject manifest;
    try (var reader = Files.newBufferedReader(root.resolve("manifest.json"))) {
      manifest = gson.fromJson(reader, JsonObject.class);
    }
    if (manifest == null || manifest.get("schemaVersion").getAsInt() != 1) {
      throw new IOException("Unsupported api-docs manifest version");
    }
    files = manifest.getAsJsonObject("files").entrySet().stream()
        .map(Map.Entry::getKey).collect(Collectors.toUnmodifiableSet());
    for (String file : files) {
      Path path = resolve(file);
      try (var stream = Files.newInputStream(path)) {
        var digest = MessageDigest.getInstance("SHA-256");
        var bytes = new byte[8192];
        int length;
        while ((length = stream.read(bytes)) != -1) digest.update(bytes, 0, length);
        if (!HexFormat.of().formatHex(digest.digest()).equals(
            manifest.getAsJsonObject("files").get(file).getAsString())) {
          throw new IOException("Publication checksum mismatch: " + file);
        }
      } catch (NoSuchAlgorithmException error) {
        throw new IOException("SHA-256 is unavailable", error);
      }
    }
    try (var reader = Files.newBufferedReader(resolve("site.json"))) {
      basePath = gson.fromJson(reader, JsonObject.class).getAsJsonObject("config")
          .get("basePath").getAsString();
    }
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
  public Path root() { return root; }
}
