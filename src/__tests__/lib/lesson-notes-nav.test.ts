import {
  describeLearningTarget,
  lessonFileForSection,
  resolveLessonDeepLink,
  resolveLessonVisit,
  standaloneCoursewareHref,
} from '@/lib/classroom-sections';

const ALIAS: Readonly<Record<string, string>> = {
  'u3-jump': '#jump',
};

const KNOWN = new Set([
  'u2-cpu-structure',
  'u2-memory',
  'u2-bus',
  'u3-overview',
  'u3-video',
  'u4-classroom',
  'u5-overview',
  'u5-knowledge',
  'u5-lesson-3',
]);

function notesInUnit(unitId: number): readonly string[] {
  if (unitId === 2) return ['u2-cpu-structure', 'u2-memory', 'u2-bus'];
  if (unitId === 3) return ['u3-video', 'u3-overview'];
  if (unitId === 4) return ['u4-classroom'];
  if (unitId === 5) return ['u5-overview', 'u5-knowledge', 'u5-lesson-3'];
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

  it('keeps chapter 5 lesson hashes and sends chapter 3 lesson landings to the overview', () => {
    expect(lessonFileForSection('lesson-a')).toBeNull();
    expect(lessonFileForSection('u3-lesson-b')).toBe('u3-overview');
    expect(resolve('u5-overview', null, '#lesson-a')).toEqual({ file: 'u5-overview', hash: '#lesson-a' });
    expect(resolve('u3-overview', null, '#u3-lesson-b')).toEqual({ file: 'u3-overview', hash: '#u3-lesson-b' });
    expect(resolve(null, 3, '#u3-lesson-a')).toEqual({ file: 'u3-overview', hash: '#u3-lesson-a' });
    expect(standaloneCoursewareHref('/resources/course/courseware/u3', 'u3-overview', 'u3-lesson-a'))
      .toBe('/resources/course/courseware/u3/u3-overview.html#u3-lesson-a');
  });

  it('does not attach a unit 5 anchor to a different note or invent a link with no hash', () => {
    expect(resolve(null, null, '')).toBeNull();
    expect(resolve(null, 5, '')).toEqual({ file: 'u5-overview', hash: '' });
    expect(resolve('u5-knowledge', null, '#int-2')).toEqual({ file: 'u5-knowledge', hash: '' });
    expect(resolve(null, 3, '#int-2')).toEqual({ file: 'u3-video', hash: '' });
    expect(resolve('u3-jump', null, '#int-2')).toEqual({ file: 'u3-jump', hash: '' });
    expect(lessonFileForSection('cpu')).toBe('u2-cpu-structure');
    expect(resolve(null, 2, '#cpu')).toEqual({ file: 'u2-cpu-structure', hash: '#cpu' });
    expect(resolve('u2-cpu-structure', null, '#cpu')).toEqual({ file: 'u2-cpu-structure', hash: '#cpu' });
    expect(lessonFileForSection('memory')).toBe('u2-memory');
    expect(resolve(null, 2, '#memory')).toEqual({ file: 'u2-memory', hash: '#memory' });
    expect(resolve('u2-memory', null, '#memory')).toEqual({ file: 'u2-memory', hash: '#memory' });
    expect(lessonFileForSection('bus')).toBe('u2-bus');
    expect(resolve(null, 2, '#bus')).toEqual({ file: 'u2-bus', hash: '#bus' });
    expect(resolve('u2-bus', null, '#bus')).toEqual({ file: 'u2-bus', hash: '#bus' });
    expect(resolve('u2-bus', null, '#pit')).toEqual({ file: 'u2-bus', hash: '#pit' });
    expect(resolve('u2-memory', null, '#bus')).toEqual({ file: 'u2-memory', hash: '' });
    expect(standaloneCoursewareHref('/resources/course/courseware/u2', 'u2-bus', 'bus'))
      .toBe('/resources/course/courseware/u2/u2-bus.html#bus');
    expect(lessonFileForSection('home')).toBeNull();
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-overview', '')).toBe(
      '/resources/course/courseware/u5/u5-overview.html',
    );
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-knowledge', 'int-2')).toBe(
      '/resources/course/courseware/u5/u5-knowledge.html',
    );
  });

  it('opens #hex-split on lesson 3 and leaves neighboring deep links on their own files', () => {
    expect(lessonFileForSection('hex-split')).toBe('u5-lesson-3');
    expect(lessonFileForSection('#hex-split')).toBe('u5-lesson-3');
    expect(lessonFileForSection('rev-hex')).toBe('u5-lesson-3');
    expect(resolve(null, 5, '#hex-split')).toEqual({ file: 'u5-lesson-3', hash: '#hex-split' });
    expect(resolve('u5-lesson-3', null, '#hex-split')).toEqual({ file: 'u5-lesson-3', hash: '#hex-split' });
    expect(resolve('u5-lesson-3', 5, '#rev-hex')).toEqual({ file: 'u5-lesson-3', hash: '#rev-hex' });
    expect(resolve(null, null, '#hex-split')).toEqual({ file: 'u5-lesson-3', hash: '#hex-split' });
    expect(resolve('u5-overview', null, '#hex-split')).toEqual({ file: 'u5-overview', hash: '' });
    expect(resolve('u5-knowledge', null, '#hex-split')).toEqual({ file: 'u5-knowledge', hash: '' });
    expect(resolve(null, 3, '#hex-split')).toEqual({ file: 'u3-video', hash: '' });
    expect(lessonFileForSection('int-2')).toBe('u5-overview');
    expect(lessonFileForSection('int-5')).toBe('u5-overview');
    expect(lessonFileForSection('int-6')).toBe('u5-overview');
    expect(resolve(null, 5, '#int-5')).toEqual({ file: 'u5-overview', hash: '#int-5' });
    expect(resolve('u5-overview', null, '#int-6')).toEqual({ file: 'u5-overview', hash: '#int-6' });
    expect(lessonFileForSection('s-map')).toBe('u4-classroom');
    expect(resolve(null, 4, '#s-map')).toEqual({ file: 'u4-classroom', hash: '#s-map' });
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-lesson-3', 'hex-split'))
      .toBe('/resources/course/courseware/u5/u5-lesson-3.html#hex-split');
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-lesson-3', 'rev-hex'))
      .toBe('/resources/course/courseware/u5/u5-lesson-3.html#rev-hex');
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-overview', 'hex-split'))
      .toBe('/resources/course/courseware/u5/u5-overview.html');
    expect(resolveLessonVisit({
      unitId: 5,
      noteFile: 'u5-lesson-3',
      pointId: '6.3',
      sectionId: 'hex-split',
    }).targetId).toBe('6.3#hex-split');
    expect(describeLearningTarget('6.3#hex-split')).toContain('÷256 拆字节');
  });

  it.each(['gate-win', 'p-gate', 'gate', 'p19'])('opens the existing #%s GATE page on lesson 3', (id) => {
    const hash = `#${id}`;
    expect(lessonFileForSection(id)).toBe('u5-lesson-3');
    expect(resolve(null, 5, hash)).toEqual({ file: 'u5-lesson-3', hash });
    expect(resolve('u5-lesson-3', null, hash)).toEqual({ file: 'u5-lesson-3', hash });
    expect(standaloneCoursewareHref('/resources/course/courseware/u5', 'u5-lesson-3', id))
      .toBe(`/resources/course/courseware/u5/u5-lesson-3.html${hash}`);
    expect(resolve('u5-overview', null, hash)).toEqual({ file: 'u5-overview', hash: '' });
  });
});
