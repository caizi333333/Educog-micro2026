import { Suspense } from 'react';
import { SubjectiveClient } from './subjective-client';

export default function SubjectivePage() {
  return (
    <Suspense>
      <SubjectiveClient />
    </Suspense>
  );
}
