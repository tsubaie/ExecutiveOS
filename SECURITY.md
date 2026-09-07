# Security status

ExecutiveOS is a development preview. There are no supported production releases yet. The remaining authentication, backup, job recovery, audit, and release-security requirements are recorded in HANDOFF.md.

The default Compose deployment publishes the application on loopback only and does not publish PostgreSQL. Secrets belong in the ignored `.env` file. The setup token is printed in the application log only while the installation has no users.

Before publishing this repository, the maintainer must configure a private vulnerability-reporting channel (for example, repository Security Advisories) and document its address here. No reporting address or public remote has been configured in this checkout. Do not put credentials, session tokens, private office documents, or exploitable vulnerability details in public issue reports.
