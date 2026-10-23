# Remote import TLS fixture

This certificate and key are a public, disposable identity for loopback transport tests. They are not production credentials. Tests first reject the untrusted certificate, then add this fixture CA to the isolated worker's trust store to verify HTTPS, SNI, DNS pinning and proxy tunneling without disabling certificate verification. The original trust store is restored afterward.
