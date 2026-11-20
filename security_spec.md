# Security Specification — Artigen Firestore Rules

## 1. Data Invariants
1. **Identity Isolation (PII)**: `/users/{userId}` holds `email`, `displayName`, and `photoURL`. Only the verified owner (`request.auth.uid == userId`) can `get`, `create`, or `update` their own profile. Blanket reads and collection `list` queries on `/users` are denied.
2. **Relational Ownership**: Documents in `/users/{userId}/settings/{settingId}` and `/users/{userId}/articles/{articleId}` require `userId == request.auth.uid` and verify parent profile existence via `exists(/databases/$(database)/documents/users/$(userId))`.
3. **Immutable Ownership & Timestamps**: `uid`, `userId`, `id`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` are strictly validated against `request.time`.
4. **Strict Schemas & Size Bounds**: Every string and list has explicit `.size()` ceilings; every `create` uses `hasAll` + `hasOnly`; every `update` uses action-based `affectedKeys().hasOnly(...)` + `isValid[Entity]`.

## 2. Adversarial "Dirty Dozen" Attack Payloads Audited
1. Unauthenticated read/write on `/users/{uid}` -> **DENIED** (`request.auth != null`).
2. Cross-user PII `get` on `/users/{otherUid}` -> **DENIED** (`isOwner(userId)`).
3. Unverified email write (`email_verified == false`) -> **DENIED** (`isVerified()`).
4. Shadow/ghost field injection (`isAdmin: true`, `plan: "enterprise"`) on profile/settings/article create or update -> **DENIED** (`hasOnly` + `affectedKeys().hasOnly()`).
5. Identity spoofing (`userId: otherUid` inside own subcollection) -> **DENIED** (`data.userId == request.auth.uid`).
6. Oversized document/ID poisoning (`>128` char ID or invalid chars) -> **DENIED** (`isValidId`).
7. Oversized text/array exhaustion (`titulo > 300`, `palavrasChave > 20`, `secoes > 15`) -> **DENIED** (bounded `.size()`).
8. Client timestamp tampering (`createdAt` or `updatedAt` != `request.time`) -> **DENIED** (temporal integrity check).
9. Rewriting immutable `createdAt` or `userId` on update -> **DENIED** (`incoming().createdAt == existing().createdAt`).
10. Wrong element types inside lists (`palavrasChave[0] = 123`) -> **DENIED** (element type check).
11. Unconstrained `list` query on `/users/{uid}/articles` without `where('userId', '==', uid)` -> **DENIED** (`resource.data.userId == request.auth.uid`).
12. Orphaned subcollection write before parent `/users/{uid}` exists -> **DENIED** (`userExists(userId)`).
