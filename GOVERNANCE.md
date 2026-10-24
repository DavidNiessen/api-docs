# Governance and maintenance

The repository owner, [DavidNiessen](https://github.com/DavidNiessen), is the initial maintainer. Additional maintainers are appointed through a public pull request documenting their responsibilities and access. The project currently has a single maintainer; independent appeal coverage is limited until the team expands.

## Decisions

Small changes use ordinary reviewed pull requests. Public API, plugin compatibility, security, architecture, licensing, and release-policy changes require a design issue or ADR and maintainer review. Record the resulting decision and its trade-offs in the repository. Contributors should have a reasonable opportunity to comment before broad changes are finalized.

## Contributions

Contributions are licensed under Apache-2.0, using the same inbound and outbound license. Contributors must have permission to submit their work and preserve relevant third-party attribution and notices. No CLA or mandatory DCO sign-off is currently required; changing that policy requires a public governance decision. Use a contributor identity and email address you are comfortable publishing, including an appropriate GitHub noreply address.

## Releases and ownership

Maintainers approve protected release tags, migration notes, dependency/security exceptions, and the exact artifact digests promoted to stable. Stable publication credentials must be scoped and rotatable, with short-lived workload identity preferred. Code ownership rules request review; GitHub rulesets must separately enforce it.

Publish support windows and triage priorities with each stable release. Security fixes and data-loss/authorization bugs take precedence over feature expansion. Keep a release checklist, tested recovery procedure, and documented path for handing maintenance to additional trusted contributors.

The [support and operations policy](SUPPORT.md) assigns current release monitoring, triage, incident and rollback coordination to the initial maintainer, records the existing labels and tested support boundaries, and distinguishes best-effort prerelease maintenance from stable security commitments.
