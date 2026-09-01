import { HyperCoursesPage } from '@/components/hyper/HyperCoursesPage';

type HomeSearchParams = Record<string, string | string[] | undefined>;

function firstQueryValue(value: string | string[] | undefined, maxLength: number): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.slice(0, maxLength) : '';
}

export default async function Home({ searchParams }: { searchParams?: Promise<HomeSearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const requestedView = firstQueryValue(params.view, 20);

  return (
    <HyperCoursesPage
      initialFilters={{
        section: firstQueryValue(params.section, 20) === 'labs' ? 'labs' : 'chapters',
        query: firstQueryValue(params.q, 120),
        view: requestedView === 'in-progress' || requestedView === 'completed' ? requestedView : 'all',
        topic: firstQueryValue(params.topic, 60) || 'all',
      }}
    />
  );
}
