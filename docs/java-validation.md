# Java runtime validation

The declared support matrix is in the Java job of `.github/workflows/quality.yml`: JDK 17, 21 and 25 with Spring Boot 3.5.16 and 4.1.1. The local runner reads that matrix rather than maintaining a separate list.

After installing dependencies and running `npm run build`, set `JAVA17_HOME`, `JAVA21_HOME` and `JAVA25_HOME` to the corresponding JDK directories, then run:

```sh
npm run test:java-matrix
```

The runner prepares a fresh real publication, checks each runtime's version and runs the Maven wrapper sequentially for every combination. It removes only generated JUnit reports before each run and requires nonzero, successful manifest and servlet/reactive host suites without skipped tests. The source CI job uses the same result checks after its Maven invocation. A successful Maven exit with skipped tests cannot satisfy this gate.

Reports live in `.api-docs/java-matrix/<commit>-<run>/report.json`, with per-combination local Maven logs. Reports record source commit/dirty state, runtime versions, platform, publication identity and suite counts. A root `passed` flag is set only after every expected combination completes. Raw JUnit property blocks are not copied into the report. Java option banners and credential-valued environment variables are omitted from retained logs; use only fixture data in tests and review logs before sharing.

The local runner supports Linux, macOS and WSL. `JAVA_MATRIX_MAVEN` can select an installed Maven executable; otherwise it uses the repository wrapper. `JAVA_MATRIX_MAVEN_ARGS` accepts a JSON array of extra Maven arguments, for example a settings-file path or local repository override. Keep credentials in the normal Maven credential/settings mechanism rather than command arguments. The script never evaluates those arguments through a shell.

## Recorded Linux validation

The 2026-10-22 local matrix used Temurin 17.0.21+9, 21.0.13+9 and 25.0.5+8 on Linux x64. Each runtime passed both Boot lines with 8 manifest tests and 2 servlet/reactive host tests: 60 test executions across six combinations, no skips. The host tests serve real generated pages, search, scripts and OAuth callback assets behind Spring Security and an approved-digest pin.

The JDK downloads matched both the Adoptium API metadata and release checksum files, and their detached signatures verified against the pinned Adoptium key `3B04D753C9050D9A5D343F39843C48A565F8F04B`. Recorded archive SHA-256 digests:

| Runtime           | Archive SHA-256                                                    |
| ----------------- | ------------------------------------------------------------------ |
| Temurin 17.0.21+9 | `8b9b611d917e3dfd8419d3566b5949226f69b052fed7e109c1368add1dfe8711` |
| Temurin 21.0.13+9 | `d7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c` |
| Temurin 25.0.5+8  | `68982529869257d0ee6b824ec5aa270ff8b118bb438670da0b97ebdab178d7fb` |

This evidence covers the tested Linux checkout and fixtures. GitHub-hosted execution remains unverified while account billing prevents Actions from starting; other operating systems, architectures, external applications and registry installation remain separate release evidence.
