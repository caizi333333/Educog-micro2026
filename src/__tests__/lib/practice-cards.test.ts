import { quizQuestions, toPublicQuestion } from '@/lib/quiz-data';
import { ACTIVITY_EVENT_TYPES, buildClassActivity } from '@/lib/learning-presence-shared';
import { isFinalObjectiveVariantExplanation } from '@/lib/comprehensive-sample';
import { campusDateKey, campusDayBounds } from '@/lib/campus-time';
import { summarizeStudyActivity } from '@/lib/study-activity';
import { chapterProgress, csvCell, gradePractice, practiceQuestions, scheduleReview } from '@/lib/practice-cards';

describe('card-practice policy', () => {
  it('reuses public questions without answers or explanations, excluding reserved variant seats', () => {
    const reserved=quizQuestions.filter(q=>isFinalObjectiveVariantExplanation(q.explanation));
    expect(reserved.length).toBeGreaterThan(0);
    expect(practiceQuestions.length+reserved.length).toBe(quizQuestions.length);
    for(const q of practiceQuestions){
      expect(toPublicQuestion(q)).not.toHaveProperty('correctAnswer');
      expect(toPublicQuestion(q)).not.toHaveProperty('explanation');
    }
    expect(practiceQuestions.some(q=>q.source)).toBe(true);
  });
  it('grades with the same case, whitespace and comma normalization as quiz submit', () => {
    const mc=practiceQuestions.find(q=>q.type==='multiple-choice')!;
    const code={...practiceQuestions.find(q=>q.type==='code-completion')!,correctAnswer:'MOV A, R0'};
    expect(gradePractice(mc,mc.correctAnswer)).toBe(true);
    expect(gradePractice(mc,'wrong')).toBe(false);
    expect(gradePractice(code,'  mov   a,r0  ')).toBe(true);
    expect(gradePractice(code,'MOVA,R0')).toBe(false);
    expect(gradePractice(code,'')).toBe(false);
  });
  it('schedules wrong, new correct, ordinary correct, review promotion and box caps', () => {
    const now=new Date('2026-11-17T17:30:00Z');
    expect(scheduleReview(3,false,true,now)).toEqual({box:0,dueAt:new Date(now.getTime()+600000)});
    expect(scheduleReview(null,true,false,now).box).toBe(1);
    expect(scheduleReview(1,true,false,now).box).toBe(1);
    for(const [old,box,seconds] of [[0,1,86400],[1,2,259200],[2,3,604800],[3,3,604800]]){
      expect(scheduleReview(old,true,true,now)).toEqual({box,dueAt:new Date(now.getTime()+seconds*1000)});
    }
  });
  it('uses Shanghai midnight for goals and streaks, not the UTC calendar date', () => {
    const now=new Date('2026-11-17T17:30:00Z');
    expect(campusDateKey(now)).toBe('2026-11-18');
    expect(campusDayBounds(now)).toEqual({dateKey:'2026-11-18',start:new Date('2026-11-17T16:00:00Z'),end:new Date('2026-11-18T16:00:00Z')});
    expect(summarizeStudyActivity([new Date('2026-11-16T17:30:00Z'),now],now).streakDays).toBe(2);
    expect(summarizeStudyActivity([],now).streakDays).toBe(0);
    expect(summarizeStudyActivity([now],new Date('2026-11-19T16:00:00Z')).streakDays).toBe(0);
  });
  it('uses latest answers for coverage and stars, and handles empty progress', () => {
    expect(chapterProgress([])).toHaveLength(10);
    expect(chapterProgress([]).every(c=>c.coverage===0&&c.stars===0)).toBe(true);
    const q=practiceQuestions[0];
    const chapter=chapterProgress([{questionId:q.id,correct:false},{questionId:q.id,correct:true}]).find(c=>c.chapter===q.chapter)!;
    expect(chapter.answered).toBe(1);
    expect(chapter.accuracy).toBe(100);
    expect(chapterProgress(practiceQuestions.map(q=>({questionId:q.id,correct:true}))).every(c=>c.stars===3)).toBe(true);
  });
  it('counts practice as studied in teacher activity without quiz completions or invented time', () => {
    const now = new Date('2026-11-17T17:30:00Z');
    expect(ACTIVITY_EVENT_TYPES).toContain('PRACTICE_CARD_ANSWER');
    const summary = buildClassActivity([
      { id: 'student', name: '同学', username: 'student', studentId: null, lastLoginAt: null },
    ], [
      { userId: 'student', eventType: 'PRACTICE_CARD_ANSWER', targetId: '1', chapterId: '2', lastAt: now, durationSeconds: 0, count: 1 },
    ], { since: new Date(now.getTime() - 86400000), asOf: now });
    expect(summary.studied).toBe(1);
    expect(summary.students[0]).toMatchObject({ studied: true, lastActiveAt: now.toISOString(), quizCompletions: 0, durationSeconds: 0 });
  });
  it('escapes CSV formulas, quotes and multiline answers', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell(null)).toBe('""');
  });
});
