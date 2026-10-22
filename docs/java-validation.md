# Java runtime validation

The declared support matrix is in the Java job of `.github/workflows/quality.yml`: JDK 17, 21 and 25 with Spring Boot 3.5.16 and 4.1.1. The local runner reads that matrix rather than maintaining a separate list.

After installing dependencies and running `npm run build`, set `JAVA17_HOME`, `JAVA21_HOME` and `JAVA25_HOME` to the corresponding JDK directories, then run:

```sh
npm run test:java-matrix
```

The runner prepares a fresh real publication, checks each runtime's version and runs the Maven wrapper sequentially for every combination. It removes only generated JUnit reports before each run and requires nonzero, successful manifest and servlet/reactive host suites without skipped tests. The source CI job uses the same result checks after its Maven invocation. A successful Maven exit with skipped tests cannot satisfy this gate.

Reports live in `.api-docs/java-matrix/<commit>-<run>/report.json`, with per-combination local Maven logs. Reports record source commit/dirty state, runtime versions, platform, publication identity and suite counts. A root `passed` flag is set only after every expected combination completes. Raw JUnit property blocks are not copied into the report. Java option banners and credential-valued environment variables are omitted from retained logs; use only fixture data in tests and review logs before sharing.

The local runner supports Linux, macOS and WSL. `JAVA_MATRIX_MAVEN` can select an installed Maven executable; otherwise it uses the repository wrapper. `JAVA_MATRIX_MAVEN_ARGS` accepts a JSON array of extra Maven arguments, for example a settings-file path or local repository override. Keep credentials in the normal Maven credential/settings mechanism rather than command arguments. The script never evaluates those arguments through a shell.

## Installed JAR consumers

Run `npm run test:java-consumers -- --matrix` with the same JDK home variables to verify the distributed binary independently of reactor classes. For one runtime, set `JAVA_HOME` and run `npm run test:java-consumers -- --boot 4.1.1` (or another Boot version from the quality matrix).

The runner clean-builds and installs one baseline candidate using the first declared Boot line and Java 17 bytecode. It inspects both runtime JARs without extracting archive paths, checking public entrypoints, embedded Maven coordinates/POMs, automatic Boot discovery metadata, bytecode version and the exact root license/notice files. Candidate archives and the parent/module POMs remain under `.api-docs/java-candidates/<commit>-<run>/` with their SHA-256 inventory. Installing writes the project's development coordinates into the configured local Maven repository; it does not publish them to a registry.

Each selected JDK/Boot combination consumes those exact installed bytes from separate temporary Maven projects outside the checkout. MVC-only and WebFlux-only classpaths must exclude the opposite stack. Public classes must originate in JARs outside the source checkout and match the candidate hashes. Tests serve a real publication at `/gateway/docs` behind host Spring Security, pin its manifest digest, verify that redirects contain the context prefix exactly once, and reject both missing and physically present unlisted files. Each consumer then removes generated test classes and recompiles offline from the resolved cache. Temporary projects are removed; sanitized Maven logs, current suite counts and candidate inventories are retained. Fresh nonzero suites without failures or skips are required.

`JAVA_CONSUMER_MAVEN` and `JAVA_CONSUMER_MAVEN_ARGS` select an installed Maven executable and a JSON array of extra arguments; their `JAVA_MATRIX_*` equivalents are accepted as fallbacks. Keep credentials in Maven settings. The configured local Maven repository must be outside the source checkout so origin assertions can reject reactor/build classes. The runner uses normal checksum/TLS verification and never interprets argument strings through a shell.

Feature/PR/default-branch checks and the manual prepared-version rehearsal include installed consumers in every Java job before the source matrix check. Local validation does not establish that GitHub Actions ran, that the Maven namespace is owned, or that packages are signed or published. Registry installation, source/Javadoc distributions, Java SBOMs and signature/provenance verification remain release work.

## Recorded Linux validation

The 2026-10-22 local matrix used Temurin 17.0.21+9, 21.0.13+9 and 25.0.5+8 on Linux x64. Each runtime passed both Boot lines with 8 manifest tests and 2 servlet/reactive host tests: 60 test executions across six combinations, no skips. The host tests serve real generated pages, search, scripts and OAuth callback assets behind Spring Security and an approved-digest pin.

The installed-JAR run on the same date built one baseline candidate against Boot 3.5.16 and consumed the same core/starter hashes across all six runtime/Boot combinations. Twelve isolated MVC-only/WebFlux-only consumers passed 24 current tests without skips and twelve fresh offline compilations. The new context-prefix journey found and fixed MVC's duplicated-context redirect. Runtime archives include the exact Apache license/notice, Java 17 bytecode, matching Maven metadata and automatic Boot discovery resources. The retained local candidate is an unpublished development snapshot with dirty-source state recorded; this is not registry installation or signed provenance.

A separate prepared-version rehearsal from source `1db4ed0` installed npm tooling offline in a temporary clone, executed the exact release-preparation composite action to apply canonical `0.2.0` metadata, built the product and passed both installed consumers on Java 21 / Boot 4.1.1. Four current tests and both offline compilations passed using inspected `0.2.0` JAR/POM coordinates. Evidence is retained locally under `.api-docs/release-rehearsals/1db4ed0c1aa4-installed-java-0.2.0-1792706749010/`; the temporary clone was removed. This targeted canonical-version check is separate from the development-version full matrix and the earlier full release rehearsal. Nothing was tagged or published.

The JDK downloads matched both the Adoptium API metadata and release checksum files, and their detached signatures verified against the pinned Adoptium key `3B04D753C9050D9A5D343F39843C48A565F8F04B`. Recorded archive SHA-256 digests:

| Runtime           | Archive SHA-256                                                    |
| ----------------- | ------------------------------------------------------------------ |
| Temurin 17.0.21+9 | `8b9b611d917e3dfd8419d3566b5949226f69b052fed7e109c1368add1dfe8711` |
| Temurin 21.0.13+9 | `d7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c` |
| Temurin 25.0.5+8  | `68982529869257d0ee6b824ec5aa270ff8b118bb438670da0b97ebdab178d7fb` |

This evidence covers the tested Linux checkout and fixtures. GitHub-hosted execution remains unverified while account billing prevents Actions from starting; other operating systems, architectures, external applications and registry installation remain separate release evidence.
