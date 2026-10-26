import {
  lessonFileForSection,
  resolveLessonDeepLink,
  standaloneCoursewareHref,
} from '@/lib/classroom-sections';

const ALIAS: Readonly<Record<string, string>> = {
  'u3-jump': '#jump',
};

const KNOWN = new Set([
  'u2-cpu-structure',
  'u3-overview',
  'u3-video',
  'u4-classroom',
  'u5-overview',
  'u5-knowledge',
]);

function notesInUnit(unitId: number): readonly string[] {
  if (unitId === 2) return ['u2-cpu-structure'];
  if (unitId === 3) return ['u3-video', 'u3-overview'];
  if (unitId === 4) return ['u4-classroom'];
  if (unitId === 5) return ['u5-overview', 'u5-knowledge'];
  return [];
}

function resolve(note: string | null, unitId: number | null, hash: string) {
  return resolveLessonDeepLink({
    note,
    unitId,
    hash,
    alias: ALIAS,
    notesInUnit,
    isKnownNote: (file) => KNOWN.has(file),
  });
}

describe('lesson note deep links', () => {
  it('opens unit 5 #int-2 on the overview pane that holds the R2 clip', () => {
    expect(lessonFileForSection('int-2')).toBe('u5-overview');
    expect(lessonFileForSection('#int-2')).toBe('u5-overview');
    expect(resolve(null, null, '#int-2')).toEqual({ file: 'u5-overview', hash: '#int-2' });
    expect(resolve('u5-overview', null, '#int-2')).toEqual({ file: 'u5-overview', hash: '#int-2' });
    expect(resolve(null, 5, '#int-2')).toEqual({ file: 'u5-overview', hash: '#int-2' });
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-overview', 'int-2'))
      .toBe('/resources/course/courseware/u5/u5-overview.html#int-2');
  });

  it('does not attach a unit 5 anchor to a different note or invent a link with no hash', () => {
    expect(resolve(null, null, '')).toBeNull();
    expect(resolve(null, 5, '')).toEqual({ file: 'u5-overview', hash: '' });
    expect(resolve('u5-knowledge', null, '#int-2')).toEqual({ file: 'u5-knowledge', hash: '' });
    expect(resolve(null, 3, '#int-2')).toEqual({ file: 'u3-video', hash: '' });
    expect(resolve('u3-jump', null, '#int-2')).toEqual({ file: 'u3-jump', hash: '' });
    expect(lessonFileForSection('home')).toBeNull();
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-overview', '')).toBe(
      '/resources/course/courseware/u5/u5-overview.html',
    );
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-knowledge', 'int-2')).toBe(
      '/resources/course/courseware/u5/u5-knowledge.html',
    );
  });
});
