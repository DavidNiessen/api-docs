# Install from GitHub Packages

The configured targets are GitHub's npm and Maven registries and GHCR. `api-docs` is still a provisional product name. Use versions that have passed the protected publication workflow and its fresh consumer checks; configuring destinations does not mean a version has already been published.

GitHub requires authentication to download npm and Maven packages, including public packages. No npm or Maven Central account is needed. For local installation, use your GitHub username and a personal access token **classic** with `read:packages`, following [GitHub's npm registry guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) and [Maven registry guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-apache-maven-registry). Keep token values out of source control, command arguments and chat.

## JavaScript and TypeScript

Set the project registry for this scope and authenticate interactively:

```sh
npm config set @davidniessen:registry https://npm.pkg.github.com --location=project
npm login --scope=@davidniessen --auth-type=legacy --registry=https://npm.pkg.github.com
```

Use your GitHub username and the token when prompted. After a preview has been published:

```sh
npm install @davidniessen/node@next
```

The Express/Fastify entry points are `@davidniessen/node/express` and `@davidniessen/node/fastify`. The CLI package is `@davidniessen/cli`; its executable remains `api-docs`. See [framework integrations](integrations.md) and the [CLI reference](cli.md). Stable releases use npm's `latest` channel.

For CI, use a repository token with `packages: read`, configure the same scope and set this npm configuration with a literal environment reference:

```ini
@davidniessen:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Supply `GITHUB_PACKAGES_TOKEN` only to the installation step. Grant the consuming repository access in the package's Actions access settings when required. Ordinary third-party dependencies continue to come from npmjs.

## Maven and Spring Boot

Add the repository and the required version to your project POM:

```xml
<repositories>
  <repository>
    <id>github</id>
    <url>https://maven.pkg.github.com/davidniessen/api-docs</url>
  </repository>
</repositories>
```

```xml
<dependency>
  <groupId>dev.niessen</groupId>
  <artifactId>api-docs-spring-boot-starter</artifactId>
  <version>RELEASED_VERSION</version>
</dependency>
```

Replace `RELEASED_VERSION` with a successfully published version. Generic Java applications can use `dev.niessen:api-docs-core`. The Java/Spring integration serves an already built documentation publication and does not require Studio, PostgreSQL or a Node runtime in the deployed Java application. See the [integration guide](integrations.md).

Merge this server entry into your private Maven settings, using your GitHub username:

```xml
<settings>
  <servers>
    <server>
      <id>github</id>
      <username>YOUR_GITHUB_USERNAME</username>
      <password>${env.GITHUB_PACKAGES_TOKEN}</password>
    </server>
  </servers>
</settings>
```

Supply the token through your shell/CI secret store. The repository and server IDs must match. The publishing workflow uses the same pattern with its short-lived repository token; it does not require a Central account, a domain claim or an OpenPGP key. Third-party Spring dependencies still resolve from Maven Central.

## Containers and static hosting

Public versioned server images use `ghcr.io/davidniessen/api-docs:RELEASED_VERSION`; operators should pin the verified registry digest. Public images can be pulled anonymously after their package visibility is public. See [deployment](deployment.md).

Generated documentation is an ordinary static directory. Serving that output needs no package-registry credentials and no account with the project maintainers. The public [mock demo](pages-demo.md) also needs no credentials.

## First publication and visibility

The protected workflow publishes only approved candidate bytes and requires the repository's `release` reviewer. npm and GHCR packages can initially be private. In your GitHub profile's **Packages**, open each new package, select **Package settings**, and change visibility to **Public**. Keep its source repository connected and its Actions access configured. Maven packages inherit their repository's access model.

Rerun all publication jobs after changing visibility; matching immutable versions are reused and fresh consumer checks must pass. A private package reachable by the workflow token is insufficient for the public npm acceptance gate. See [publication policy](publication-plans.md) for exact verification, security freshness and failure recovery.
