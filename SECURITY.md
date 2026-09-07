# Security status

ExecutiveOS is a development preview. There are no supported production releases yet. The remaining authentication, backup, job recovery, audit, and release-security requirements are recorded in docs/history/HANDOFF.md.

The default Compose deployment publishes the application on loopback only and does not publish PostgreSQL. Secrets belong in the ignored `.env` file. The setup token is printed in the application log only while the installation has no users.

## Reporting a vulnerability

Report privately through the repository's GitHub Security Advisories ("Report a vulnerability") once the repository is public, or by email to the address the maintainer lists in the repository description. Expect an acknowledgement within seven days. Do not put credentials, session tokens, private office documents, or exploitable vulnerability details in public issue reports.

## Supported versions

There are no supported production releases yet; fixes land on `main` only.
