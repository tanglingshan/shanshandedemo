# Implementation Order

This order follows the AGENTS.md流水线 while respecting the user's preference that the dashboard be the first product surface inside the frontend phase.

1. Architecture lock
2. Backend and frontend parallel scaffolding
3. Backend foundation:
   - Prisma schema
   - session auth
   - source registry
   - hot item API
   - Socket.io server
4. Frontend foundation:
   - app shell
   - auth pages
   - dashboard layout
   - API client
   - socket client
5. Test/review pass
6. Merge and deployment wiring for Sealos
