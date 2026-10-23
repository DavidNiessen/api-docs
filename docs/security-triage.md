# Security findings and acceptance status

Updated: 2026-10-23. This record distinguishes initial scanner matches, implemented changes and completed acceptance. It supplies no waiver, suppression or permission to publish. Scanner matches need investigation; a match alone does not prove exploitability.

## Source analysis

The first hosted CodeQL extraction at `0d4288b` completed for JavaScript/TypeScript and Java. Java reported no findings. JavaScript reported 43 results: 38 High and five Medium. The SARIF checksum is `d0d4b463a71b9acae8710bfd43f1a370c6d72105a64b4a2387fe552f63354b08`. The query rules reside in SARIF tool extensions; the corrected reader validates component/rule identities and assesses those results. It does not omit extension findings.

The follow-up at `65a2c33` reported 31 High and five Medium JavaScript matches. Extraction at `93e7ade` reduced that to three High and five Medium, with no Java findings. The latest extraction at `2912184` reports **one High and five Medium**; both Express request-quota matches are resolved. Its raw JavaScript SARIF checksum is `eb5e578a463d46188f86195e9c834a3f7706e03b56b4dae3acb1921b98402cec`. The remaining High match concerns source containment. A further explicit separator-delimited check on the canonical lookup path is pending fresh analysis. [Reader boundary controls](reader-security.md) describe the HTML/URL changes.

| Query                        | Initial matches | Severity | Latest scanner result and work                                                                                                                                                                                                       |
| ---------------------------- | --------------: | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `js/polynomial-redos`        |               3 | High     | No matches at `93e7ade`. Placeholder detection and JSON wire processing use bounded character scans; exact numeric lexemes remain preserved.                                                                                         |
| `js/xss-through-dom`         |              25 | High     | No matches at `93e7ade`. Shared rendering-boundary HTML sanitization and canonical navigation policies pass hosted source/browser checks.                                                                                            |
| `js/path-injection`          |               1 | High     | One match remains at `2912184` after canonical rebasing. The next change also verifies the separator-delimited canonical prefix immediately before lookup, preserving root aliases and filesystem roots. Fresh analysis is required. |
| `js/missing-rate-limiting`   |               2 | High     | No matches at `2912184`. Express and Fastify enforce configurable, bounded request quotas before authentication, with real HTTP, capacity, IPv6 and host-route regressions.                                                          |
| `js/insecure-temporary-file` |               1 | High     | No matches at `93e7ade`. The TLS fixture uses a private temporary directory and exclusive configuration creation.                                                                                                                    |
| `js/file-system-race`        |               6 | High     | No matches at `93e7ade`. Bounded evidence readers and archive corruption/restoration inspect and consume the same open descriptor.                                                                                                   |
| `js/bad-code-sanitization`   |               3 | Medium   | Generated plugin-test modules need context review. All three results remain visible.                                                                                                                                                 |
| `js/file-access-to-http`     |               1 | Medium   | Review the benchmark fixture's file-to-network flow. The result remains visible.                                                                                                                                                     |
| `js/missing-origin-check`    |               1 | Medium   | Review the dedicated search worker's message boundary and validation. The result remains visible.                                                                                                                                    |

The latest recorded scanner verdict remains one High/five Medium JavaScript match until a new extraction and assessment validates the changes. No count is reduced merely because a source edit or local test passed. The [source-security gate](code-security.md) continues to block High/Critical results and rejects suppressions.

## Dependencies and containers

The prepared npm consumer audit found High-severity Zod advisory [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) in 4.3.6. All four direct dependencies and both locks now use patched 4.6.6. Source, root audit and installed npm consumer checks pass locally after the update. A fresh image and hosted prepared-version verification are still required for those dependency bytes.

The preceding Node 24.22.1 prepared image passed all 44 deployment checks and its Grype threshold, with zero High/Critical/unknown-severity matches. It retains three Medium matches for CVE-2025-60876 across BusyBox packages; the scanner supplied no fix version. The raw findings remain visible. This image predates the Zod update and cannot stand in for acceptance of a newly built image. See [container policy and evidence](container-security.md).

Independent security/isolation review, final license review, authenticated signed distributions and release-owner approval remain separate launch gates. The project is pre-release.
