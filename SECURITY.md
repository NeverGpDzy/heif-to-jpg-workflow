# Security Policy

## Supported Versions

Security fixes are handled on the latest released version.

## Reporting a Vulnerability

Please do not open a public issue for credential leaks or security-sensitive bugs.

If you find a vulnerability, contact the maintainer through the GitHub profile associated with this repository and include:

- affected version or commit
- reproduction steps
- expected and actual behavior
- any relevant logs with secrets removed

## Credential Handling

Do not commit OSS credentials, `.env` files, `key.txt`, private photos, or generated output images.

If a credential is accidentally exposed, rotate it immediately in the provider console.
