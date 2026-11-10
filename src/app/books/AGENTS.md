# Book feature instructions

- The list remains at `/`; details use `/books/:isbn` before the wildcard redirect. Use `book.isbn` for navigation and `getBookByIsbn()`; `id` is the list tracking key, not an interchangeable API key.
- Detail requests use the encoded ISBN and work independently of list data, navigation state, or a cache. Preserve direct navigation and local reload. Production SPA fallback remains unverified.
- Preserve loading, success, not-found (HTTP 404), and other HTTP/network error states. Keep the link to `/` available in every detail state. New parameters must cancel old requests, clear stale data, and remain usable after an error.
- Keep the whole book card as one native router link with the book title as its accessible name and a visible keyboard focus. Do not add nested links or click-only containers.
- Render book descriptions as escaped text. Keep price as the API string without inventing a currency. Omit absent optional metadata and preserve missing/broken detail-cover fallback. Do not display technical IDs as bibliographic data.
- Preserve the existing 300 ms search behavior and list page-size contract. The search lifecycle risks are documented in `REFACTORING.md`; documenting them does not authorize changing them.
- Use deterministic API interception for feature tests, including fixtures with different `id` and `isbn`. Preserve coverage for direct/reload navigation, parameter changes, failures, keyboard operation, and optional data. Mocks do not establish real server behavior.
