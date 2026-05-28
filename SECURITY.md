# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities privately to security@example.com. Include
the affected version, a description of the issue, reproduction steps, and any
known impact.

We will acknowledge reports within 5 business days and share remediation status
as we investigate.

## Security Principles

- API keys and tokens must never be logged or written to disk.
- Webhook requests must be verified before processing.
- The bot does not phone home or send telemetry.
- The bot only writes GitHub PR review comments.
