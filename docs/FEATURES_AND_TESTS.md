# QA checklist — manually verify before launch

| Feature | Test |
|---|---|
| Audit mobile | Public URL gives real mobile scores or helpful API failure |
| Audit desktop | Scores display separately for desktop |
| Unsafe URL | Reject localhost, ports, IP literals, custom credentials |
| Report | View scores, core metrics, recommendations; screenshot and PDF |
| AI | Configured Gemini key generates suggestions; no key gives helpful error |
| Browser history | Local audit appears in Dashboard after refresh |
| Auth | Signup, email confirmation, sign-in, sign-out |
| Cloud | Signed-in audit appears under Cloud reports; signed-out doesn't sync |
| Privacy | User A cannot read/update/delete user B's report (Supabase RLS) |
| Share | Only owner can enable link; anon reads shared report; revocation blocks it |
| PDF | Correct URL/scores, long text wraps, multiple pages render |
| Upload comparison | Two images preview and slider operates by touch and mouse |
| Mobile | Navigation, audit form, dashboard cards fit narrow phones |
| Load tests | API throttles too many requests; error messages show without keys |
| Deployment | Environment variables, redirect URLs, page routes, SSL, quotas |

## Limitations

- AI plans are *advice*, not actual automated source-code fixes or redesigns.
- Login supports email and password; password reset, MFA and OAuth are not included.
- No team accounts, billing, subscriptions or scheduler.
- Public sharing exposes a report to anyone with its link; make private again anytime.
- IP-based quotas can affect users who share one public IP and aren't comprehensive bot protection.
- No production verification, cross-account RLS testing, full browser tests or provider provisioning performed by ChatGPT.
