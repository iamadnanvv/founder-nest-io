# FounderHuntCommunity Platform Issue Fixes

## What will change
- Audit the current app signals and core user journeys across sign-in, premium access, the founder directory, feed, messaging, events, showcase voting, and opportunity pages.
- Fix only reproducible functional, navigation, state-sync, or mobile-layout defects found during that audit; leave unrelated security findings and business rules untouched.
- Validate the fixes with the existing checks and desktop/mobile browser flows, and document anything that depends on an external service or deployment action.

## Technical details
- Use the existing TanStack Start routes, Supabase client/RLS, and app design tokens.
- Verify affected flows with focused tests or browser checks, then inspect the resulting build diagnostics.
- Do not change live data except previously identified QA artifacts after confirming their exact ownership and contents.
