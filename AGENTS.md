<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Classroom architecture
- Keep mathematical definitions in pure TypeScript and let the R3F scene only draw them, so camera motion cannot alter geometric relationships.
- Animate line transforms from a shared world-space phase in useFrame, with geometry invariants checked each frame; speed only advances phase and pause never disables orbit controls.
- Teacher data uses signed-in owner RLS; students use server-validated per-team capabilities, so they need no accounts and cannot read unreleased answers.
- Only the root subscribes to auth identity changes; components refresh verified user state from its notification to prevent competing subscriptions.
- Team capability hashes never leave the server; plaintext links are returned only once to the verified room creator to reduce secret exposure.
- Code-only entry validates an open classroom and selected team server-side, then derives a stable capability from the stored secret hash; this preserves private reads and server clocks without manual team secrets.
- Question clocks are server-authoritative: start/end timestamps live in team timings, start is set once and end is capped at the deadline, so reloads or disconnects never grant extra time.
- Assignment release atomically records the owner's common first-question start for every team; server guards reject starts and saves before release to prevent early access or late-join extra time.
- Teacher updates subscribe to published classroom tables and poll as a fallback, so a dropped realtime connection never requires a manual reload.
- Solid/dashed line parts are computed per frame from the live camera by pure visibility math; points on the plane are never hidden.

## Database migrations
- The migration journal is intentionally empty and the existing schema predates Drizzle; never add CREATE TABLE for tables already in the database, because applying it would fail and mask the real change.
