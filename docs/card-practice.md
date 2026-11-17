# 刷题卡片

- Entry: `/practice` beside 在线测评; teacher entry: `/teacher/practice`.
- Every `/api/practice/cards/...` request uses the live `requireClassroomApiAccess` gate plus the existing Bearer/cookie bridge. User identity is never accepted from the body.
- Endpoints: GET `questions?mode=all|chapter|random|review|wrong|retry` (chapter/ids as appropriate), `review`, `me`, `leaderboard`, `teacher?classId=...`; POST `answer`, `me` (goal), `challenge/start|answer|finish`. Teacher exports use `teacher?classId=...&export=attempts|students`.
- Active class defaults to `getActiveClassIdForUser`. Class selection is checked against live accessible class IDs. Attempts/challenges snapshot the class at submission/start. Teacher stats and exports filter this historical class, include the current student roster (including zero-attempt students), and use `getAccessibleClassIds`. Admins can select all active classes. Leaderboards filter class, deduplicate account IDs, and return names/scores only.
- The bank has 626 questions at base commit `0c6e61c`. Only the `isFinalObjectiveVariantExplanation` prefix (`[source: 期末客观模拟变体`) is excluded. Ordinary questions that can also be sampled into mock exams are not reserved; slide/guide examples remain useful practice material. Both list and answer/challenge routes enforce the same pool. This base has no figure field/assets in quiz-data; the practice renderer forwards/displays optional local-image figure strings or `{src,alt,caption}` without inventing bank content.
- Public lists use `toPublicQuestion`. Correct answer/explanation is returned only after an ordinary answer; challenge answer returns correctness/XP only. Grading exactly mirrors quiz-submit normalization (trim, lowercase, collapse whitespace, normalize comma spacing); unlike the standalone app it does not erase all spaces.
- Daily goal (20 default, 5–100 configurable), count, XP reward windows and streaks use existing `campus-time` / `study-activity` helpers, fixed to Asia/Shanghai. Stored timestamps and CSV instants remain UTC.
- Review boxes: wrong → box 0 / 10 minutes; new correct → box 1 / 1 day; correct review advances to 3 days and 7 days, capped at box 3. Ordinary correct retains the existing box. Wrong-book uses the latest answer per question.
- XP is practice-only, not platform points: first correct question per campus day gives 10 plus a consecutive-correct bonus (2 per group of 3, capped at 10). User row locks serialize XP/review updates; `userId+requestId` makes normal answers idempotent. Challenge row locks enforce sequence, ownership, server deadline and stored scoring. Finishing early is allowed; finish is idempotent.
- Student attempts emit `PRACTICE_CARD_ANSWER` LearningEvents and update the existing chapter LearningProgress.lastAccessAt, without claiming chapter completion or inventing study time. Existing streak readers and teacher activity views see practice. QuizAttempt, quiz scoring and platform points are unchanged.
- Migration is additive. Both Vercel's build override and `vercel-build` now run the migration-deploy entry point; the fetched base did not actually run migrate deploy in either place.
- UI inherits the platform shell/theme tokens, including light/dark mode. Front/back cards, pointer-following swipe, keyboard (1–4/A–D, Enter, arrows), focusable feedback and reduced-motion styles are scoped to practice.

## Local demo (never a production URL)

```sh
docker run -d --name educog-practice-postgres -e POSTGRES_USER=educog -e POSTGRES_PASSWORD=local-practice-only -e POSTGRES_DB=educog_practice -p 127.0.0.1:55432:5432 postgres:16
export DATABASE_URL=postgresql://educog:local-practice-only@127.0.0.1:55432/educog_practice
npx prisma generate
npx prisma migrate deploy
PRACTICE_DEMO_PASSWORD='<choose a local demo password>' npx tsx scripts/seed-practice-demo.ts
npm run dev
```

The seed script rejects non-loopback database hosts. It creates `cards_teacher` (01班), `cards_teacher_b` (02班), `cards_student`, `cards_student_2` (01班), `cards_student_b` (02班), and `cards_admin`. All data is explicitly local demo data.
