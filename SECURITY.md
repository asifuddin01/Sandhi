# Security policy

## Reporting a vulnerability

Please report security problems privately. Do not open a public issue.

- Use GitHub's **Report a vulnerability** button on this repository's Security tab, or
- email the address listed as `Contact` in [`https://sandhiresearch.org/.well-known/security.txt`](https://sandhiresearch.org/.well-known/security.txt).

Include what you found, the steps to reproduce it, and the impact you expect. We aim to acknowledge reports within three working days and to share a fix plan within ten.

## Scope

In scope: the website at `sandhiresearch.org`, the member portal, the administration area, and this repository's code.

Out of scope: volumetric denial of service, social engineering of lab members, reports from automated scanners without a demonstrated impact, and missing best-practice headers on third-party services.

## Safe harbour

We will not pursue legal action for research that stays within this policy: test only against accounts you own, do not access or keep other people's data, do not degrade the service for others, and give us reasonable time to fix a problem before disclosing it.

## Supported versions

Only the version currently deployed from the `main` branch is supported.

## More

- [`docs/security/checklist.md`](docs/security/checklist.md): how each security control is met, item by item.
- [`docs/security/operations.md`](docs/security/operations.md): production settings, secret rotation, backups, and incident response.
