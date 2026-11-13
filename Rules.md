# Project Rules

## E-Commerce Platform — Rules for the Developer and AI

These rules apply to every implementation step, generated change, refactor, test, and documentation update.

The goal is to deliver a correct, explainable PERN MVP in two days. Speed is important, but shortcuts that break security, data integrity, or the primary user journey are not acceptable.

---

## 1. Scope rules

1. Build the assigned e-commerce platform only.
2. Prioritize a complete customer-to-order journey over optional features.
3. Do not begin optional features until the acceptance tests pass.
4. Do not add reviews, wishlists, real payments, email, advanced promotions, or microservices unless all required MVP functionality is already complete.
5. If a feature cannot be completed safely, document it as a limitation instead of pretending it works.
6. Prefer a small working implementation over broad unfinished screens.
7. Do not rewrite existing working code without a clear reason.
8. Preserve existing project conventions when they are reasonable.
9. Do not create planning files other than the requested project documents.

---

## 2. Antigravity execution rules

1. Work in phases.
2. Inspect the repository before changing it.
3. Read related files before editing.
4. Make one coherent change set at a time.
5. After each phase, run the smallest relevant validation command.
6. Do not move to the next phase while the current phase has a known blocking failure.
7. Report changed files and validation results after each phase.
8. Do not claim a feature is complete without verifying its actual user-visible and API behavior.
9. Use existing package scripts before inventing new commands.
10. Keep prompts and implementation decisions aligned with `PRD.md` and `Architecture.md`.
11. Update `Memory.md` after meaningful work.
12. If requirements conflict, prioritize:
    1. Data integrity.
    2. Security and authorization.
    3. Acceptance tests.
    4. Core customer journey.
    5. Admin operations.
    6. UI polish.
    7. Optional enhancements.

---

## 3. Technology rules

1. Use PostgreSQL, Express.js, React, and Node.js.
2. Use TypeScript if the repository supports it or can be configured without delaying the MVP.
3. Use parameterized SQL or a safe ORM query API.
4. Use PostgreSQL migrations rather than manual one-off schema changes.
5. Include repeatable seed data.
6. Use integer minor units for money.
7. Use a single consistent authentication strategy.
8. Use a single consistent API error format.
9. Use a single configured frontend API client.
10. Avoid adding dependencies unless they solve a concrete requirement or a missing build/test problem.
11. Do not introduce microservices, message queues, or infrastructure that cannot be explained and run locally.

---

## 4. Security rules

1. Authentication must be implemented on the server.
2. Authorization must be implemented on the server.
3. Never rely on hidden buttons or frontend route guards for security.
4. Hash passwords with a suitable password hashing algorithm such as bcrypt.
5. Never log passwords, tokens, payment credentials, or full sensitive request bodies.
6. Never commit `.env` files.
7. Never commit secrets, private keys, access tokens, or real credentials.
8. Use `.env.example` with placeholders only.
9. Validate all request bodies, query parameters, and route parameters.
10. Use parameterized database queries.
11. Check customer ownership for profiles, addresses, carts, and orders.
12. Check the admin role for every admin operation.
13. Return safe error messages that do not reveal secrets or internal stack traces.
14. Do not expose password hashes in API responses.
15. Do not store real card numbers or payment credentials.
16. Use secure cookies or a carefully implemented token strategy.
17. Configure CORS intentionally rather than allowing every origin in production-like settings.
18. Use security middleware such as Helmet when compatible with the project.

---

## 5. Database rules

1. Database constraints must enforce important invariants.
2. Add foreign keys for relationships.
3. Add unique constraints for emails, SKUs if used, and idempotency scope.
4. Add check constraints for non-negative stock, positive quantity, and non-negative money values.
5. Add indexes for common search, filter, ownership, and date queries.
6. Use transactions for checkout and other multi-record business operations.
7. Never rely only on application code for non-negative stock.
8. Never delete historical order data just to simplify an update.
9. Store product and address snapshots in orders.
10. Store timestamps consistently.
11. Do not manually edit a database in a way that cannot be reproduced by migration or seed scripts.
12. Keep test data separate from real data.

---

## 6. Checkout and inventory rules

1. The server is the authority for product price, stock, totals, payment state, and order state.
2. The browser must not be trusted for subtotal or total values.
3. Recheck stock at checkout even if it was checked when adding to the cart.
4. Use row locking or an equivalent atomic update for stock-sensitive operations.
5. Stock must never become negative.
6. If any checkout step fails, the transaction must roll back appropriately.
7. Repeated checkout requests must be idempotent.
8. The same customer and idempotency key must not create multiple orders.
9. Do not deduct stock twice when a request is retried.
10. Do not create an order before validating the cart and stock unless the transaction safely rolls back.
11. Record payment state explicitly.
12. Record inventory movements for stock changes.
13. Do not clear the cart before successful order processing unless the design explicitly restores it after failure.
14. Document the chosen behavior for failed and cancelled payment.

---

## 7. Order state rules

1. Order transitions must be validated on the server.
2. Keep the transition map in one shared backend location.
3. Do not allow arbitrary status strings from the frontend.
4. Reject invalid transitions with a predictable business error.
5. Do not allow a delivered order to become placed.
6. Do not allow a cancelled order to become shipped.
7. Record status changes in the audit trail.
8. Update the UI after the server confirms the transition.

---

## 8. API rules

1. Use `/api` as the API prefix.
2. Use nouns and consistent plural resource paths.
3. Use standard HTTP status codes.
4. Return a consistent error shape:

   ```json
   {
     "error": {
       "code": "ERROR_CODE",
       "message": "Human-readable message.",
       "details": {}
     }
   }
   ```

5. Do not return stack traces to the client.
6. Validate query pagination limits.
7. Do not accept client-supplied prices as authoritative.
8. Do not return more data than the requester needs.
9. Use explicit response types.
10. Keep controllers thin and put business rules in services.
11. Do not silently swallow database or validation errors.
12. Do not convert an error into a fake successful response.
13. Do not use broad `catch` blocks that hide the original cause.
14. Log unexpected server errors using the repository's standard logging approach.

---

## 9. Frontend rules

1. The interface must be usable on desktop and mobile widths.
2. Every form must have visible labels.
3. Every async action must have a loading or disabled state.
4. Every major page must handle loading, empty, success, and error states.
5. Do not hide important API errors.
6. Show clear feedback after cart, checkout, inventory, and order actions.
7. Confirm destructive actions such as cancellation and deletion.
8. Use accessible buttons, inputs, headings, and focus states.
9. Do not duplicate business rules in many components.
10. Frontend validation improves usability but never replaces server validation.
11. Do not render admin controls for customers, but still enforce authorization on the API.
12. Avoid large visual rewrites unrelated to the requested feature.

---

## 10. Testing rules

1. Test business rules, not only whether pages render.
2. Include both success and failure cases.
3. Include at least one conflict or concurrency-sensitive case.
4. Test that customers cannot call admin endpoints.
5. Test duplicate checkout.
6. Test insufficient stock.
7. Test failed payment.
8. Test invalid order transitions.
9. Use a test database or isolated test schema.
10. Do not make tests depend on an external paid service.
11. Do not weaken assertions to make a failing test pass.
12. Fix the implementation when a test exposes an actual bug.
13. Keep tests deterministic.
14. Run tests after changes to checkout, authorization, inventory, or order state.

---

## 11. Code quality rules

1. Prefer clear names over clever abstractions.
2. Keep functions focused.
3. Keep SQL readable and parameterized.
4. Avoid `any` unless there is a documented, unavoidable boundary.
5. Avoid unnecessary type casts.
6. Use shared types or schemas where practical.
7. Remove dead code introduced during implementation.
8. Do not leave debugging logs in committed code.
9. Comment only non-obvious decisions.
10. Do not duplicate order transition, pricing, or authorization logic.
11. Follow the existing formatter and linter.
12. Fix errors caused by the current change, but do not expand into unrelated cleanup.

---

## 12. Documentation rules

1. Keep `README.md` executable: a reviewer should be able to follow it line by line.
2. Document all required environment variables.
3. Document migration and seed commands.
4. Document test commands.
5. Document demo credentials using dummy values.
6. Document API endpoints.
7. Document the ER diagram.
8. Document known limitations honestly.
9. Explain the checkout transaction and idempotency strategy.
10. Do not claim real payment processing.
11. Do not claim a feature works if it is only a static screen.
12. Keep documentation consistent with the actual code.

---

## 13. Git and file rules

1. Do not commit secrets.
2. Do not commit generated dependency directories such as `node_modules`.
3. Do not overwrite user changes without inspecting them.
4. Do not use destructive reset or checkout commands without explicit approval.
5. Keep commits or change groups focused when possible.
6. Use meaningful commit messages if commits are requested.
7. Keep generated files out of the repository unless the project requires them.
8. Do not create duplicate documentation files with overlapping purposes.

---

## 14. Definition of done

A phase is complete only when:

- The intended behavior is implemented.
- The relevant API and UI behavior has been checked.
- Relevant tests pass.
- Type-check/build passes where applicable.
- No known critical security or data-integrity issue remains.
- Documentation is updated if the behavior or setup changed.
- `Memory.md` records what changed and what remains.

The whole project is complete only when:

- The end-to-end customer journey works.
- Admin operations work.
- Critical edge cases pass.
- Migrations and seed work from a clean database.
- Tests pass.
- Production build passes.
- README, API documentation, ER diagram, and limitations are present.

