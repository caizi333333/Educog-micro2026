import { GET, POST } from '@/app/api/practice/cards/[...action]/route';
import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { practiceLeaderboard } from '@/lib/practice-cards-server';
import { practiceQuestions } from '@/lib/practice-cards';
import { quizQuestions } from '@/lib/quiz-data';
import { isFinalObjectiveVariantExplanation } from '@/lib/comprehensive-sample';

jest.mock('@/lib/auth',()=>({verifyToken:jest.fn()}));
jest.mock('@/lib/prisma',()=>({prisma:{
  $transaction:jest.fn(),$queryRaw:jest.fn(),
  classGroup:{findMany:jest.fn()},classEnrollment:{findFirst:jest.fn(),findMany:jest.fn()},
  user:{findUnique:jest.fn()},learningProgress:{upsert:jest.fn()},learningEvent:{create:jest.fn()},
  practiceCardAttempt:{findUnique:jest.fn(),findFirst:jest.fn(),findMany:jest.fn(),create:jest.fn()},
  practiceCardProfile:{findUnique:jest.fn(),upsert:jest.fn()},
  practiceReviewCard:{findUnique:jest.fn(),findMany:jest.fn(),upsert:jest.fn()},
  practiceChallenge:{findUnique:jest.fn(),findMany:jest.fn(),create:jest.fn(),update:jest.fn(),aggregate:jest.fn()},
}}));
const p=prisma as unknown as Record<string,Record<string,jest.Mock>> & { $transaction:jest.Mock; $queryRaw:jest.Mock };
const now=new Date('2026-11-17T17:30:00Z');
const payload={userId:'student-a',email:'a@test.local',role:'STUDENT'};
const mc=practiceQuestions.find(q=>q.type==='multiple-choice')!;
const classes=[{id:'class-a',name:'一班'},{id:'class-b',name:'二班'}];
function call(action: string, body?: unknown, authorization='Bearer test') {
  return (body===undefined?GET:POST)(new NextRequest('http://localhost/api/practice/cards/'+action,{
    method:body===undefined?'GET':'POST',headers:{...(authorization?{authorization}:{}),'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  }));
}
const answer=()=>({questionId:mc.id,answer:mc.correctAnswer,mode:'all',requestId:'request-0001'});

describe('authenticated card-practice API',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();jest.useFakeTimers({now});
    (verifyToken as jest.Mock).mockResolvedValue(payload);
    p.$transaction.mockImplementation(fn=>fn(prisma));p.$queryRaw.mockResolvedValue([]);
    p.classEnrollment.findFirst.mockResolvedValue({id:'enrolled',classId:'class-a'});
    p.classEnrollment.findMany.mockResolvedValue([{classId:'class-a'}]);
    p.classGroup.findMany.mockImplementation(({where})=>Promise.resolve(where.OR?[classes[0]]:where.id?classes.filter(c=>where.id.in.includes(c.id)):classes));
    p.practiceCardAttempt.findUnique.mockResolvedValue(null);
    p.practiceCardAttempt.findFirst.mockResolvedValue(null);
    p.practiceCardAttempt.findMany.mockResolvedValue([]);
    p.practiceCardAttempt.create.mockImplementation(({data})=>Promise.resolve({id:'attempt-1',...data}));
    p.practiceReviewCard.findUnique.mockResolvedValue(null);p.practiceReviewCard.findMany.mockResolvedValue([]);
    p.practiceCardProfile.findUnique.mockResolvedValue(null);
    p.practiceChallenge.findMany.mockResolvedValue([]);
    p.practiceChallenge.findUnique.mockResolvedValue(null);
    p.practiceChallenge.aggregate.mockResolvedValue({_max:{correctCount:0}});
    p.user.findUnique.mockResolvedValue({name:'同学甲',username:'student-a'});
    p.classEnrollment.findMany.mockResolvedValue([{classId:'class-a',userId:'student-a',user:{name:'同学甲',username:'a',studentId:'2026001'}}]);
  });
  afterEach(()=>jest.useRealTimers());
  it('returns 401 for unauthenticated/invalid sessions and 403 for unenrolled students',async()=>{
    expect((await call('questions',undefined,'')).status).toBe(401);
    (verifyToken as jest.Mock).mockResolvedValueOnce(null);
    expect((await call('questions')).status).toBe(401);
    p.classEnrollment.findFirst.mockResolvedValue(null);
    expect((await call('questions')).status).toBe(403);
  });
  it('allows teachers/admins and returns a private, answer-free practice bank',async()=>{
    for(const role of ['STUDENT','TEACHER','ADMIN']){
      (verifyToken as jest.Mock).mockResolvedValue({...payload,role});
      const response=await call('questions');
      expect(response.status).toBe(200);
      const data=await response.json();
      expect(data).toHaveLength(practiceQuestions.length);
      expect(JSON.stringify(data)).not.toMatch(/correctAnswer|explanation/);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    }
  });
  it('never permits reserved variants through chapter, retry or direct answers',async()=>{
    const reserved=quizQuestions.find(q=>isFinalObjectiveVariantExplanation(q.explanation))!;
    expect((await call('questions?mode=retry&ids='+reserved.id)).status).toBe(400);
    expect((await call('answer',{...answer(),questionId:reserved.id})).status).toBe(404);
    const rows=await (await call('questions?mode=chapter&chapter='+reserved.chapter)).json();
    expect(rows.some((q:{id:number})=>q.id===reserved.id)).toBe(false);
  });
  it('validates modes, chapter, goals, input format and answer options',async()=>{
    for(const path of ['questions?mode=bad','questions?mode=chapter&chapter=11','questions?mode=retry&ids=nope'])expect((await call(path)).status).toBe(400);
    for(const body of [null,[],{goal:0},{goal:'20'}])expect((await call('me',body)).status).toBe(400);
    for(const body of [{...answer(),answer:'invalid option'},{...answer(),requestId:''},{...answer(),mode:'fake'}])expect((await call('answer',body)).status).toBe(400);
    expect((await call('me',{goal:30})).status).toBe(200);
    expect(p.practiceCardProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({update:{dailyGoal:30}}));
  });
  it('grades server-side, records UTC attempts, schedules review and integrates activity without quiz points',async()=>{
    const response=await call('answer',answer());expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({correct:true,correctAnswer:mc.correctAnswer,xp:10});
    expect(p.practiceCardAttempt.create).toHaveBeenCalledWith({data:expect.objectContaining({userId:payload.userId,classId:'class-a',questionId:mc.id,correct:true,createdAt:now})});
    expect(p.learningEvent.create).toHaveBeenCalledWith({data:expect.objectContaining({eventType:'PRACTICE_CARD_ANSWER',classId:'class-a'})});
    expect(p.learningProgress.upsert).toHaveBeenCalled();
    expect(p.practiceReviewCard.upsert).toHaveBeenCalledWith(expect.objectContaining({update:{box:1,dueAt:new Date(now.getTime()+86400000)}}));
  });
  it('returns wrong feedback, resets review and grants no XP',async()=>{
    const wrong=mc.type==='multiple-choice'?mc.options.find(o=>o!==mc.correctAnswer)!:'wrong';
    p.practiceReviewCard.findUnique.mockResolvedValue({box:3});
    const response=await call('answer',{...answer(),answer:wrong});
    expect(await response.json()).toMatchObject({correct:false,correctAnswer:mc.correctAnswer,xp:0});
    expect(p.practiceReviewCard.upsert).toHaveBeenCalledWith(expect.objectContaining({update:{box:0,dueAt:new Date(now.getTime()+600000)}}));
  });
  it('promotes review boxes and returns only due questions from the review endpoint',async()=>{
    p.practiceReviewCard.findUnique.mockResolvedValue({box:1});
    await call('answer',{...answer(),mode:'review'});
    expect(p.practiceReviewCard.upsert).toHaveBeenCalledWith(expect.objectContaining({update:{box:2,dueAt:new Date(now.getTime()+259200000)}}));
    p.practiceReviewCard.findMany.mockResolvedValue([{questionId:mc.id}]);
    const data=await (await call('review')).json();
    expect(data.map((q:{id:number})=>q.id)).toEqual([mc.id]);
    expect(JSON.stringify(data)).not.toMatch(/correctAnswer|explanation/);
    expect(p.practiceReviewCard.findMany).toHaveBeenLastCalledWith(expect.objectContaining({where:{userId:payload.userId,dueAt:{lte:now}}}));
  });
  it('is idempotent by user/request, rejects conflicting replay and caps XP to once per question/day',async()=>{
    p.practiceCardAttempt.findUnique.mockResolvedValue({userId:payload.userId,classId:'class-a',questionId:mc.id,answer:mc.correctAnswer,correct:true,mode:'all',xp:10});
    expect((await call('answer',answer())).status).toBe(200);
    expect(p.practiceCardAttempt.create).not.toHaveBeenCalled();expect(p.learningEvent.create).not.toHaveBeenCalled();
    expect((await call('answer',{...answer(),mode:'review'})).status).toBe(409);
    p.practiceCardAttempt.findUnique.mockResolvedValue(null);p.practiceCardAttempt.findFirst.mockResolvedValue({id:'rewarded'});
    expect(await (await call('answer',answer())).json()).toMatchObject({xp:0});
    expect(p.practiceCardAttempt.findFirst).toHaveBeenCalledWith({where:expect.objectContaining({createdAt:{gte:new Date('2026-11-17T16:00:00Z'),lt:new Date('2026-11-18T16:00:00Z')}})});
  });
  it('counts distinct questions on Shanghai days, preserves latest wrong state and handles empty progress',async()=>{
    const empty=await (await call('me')).json();expect(empty).toMatchObject({today:0,streak:0,xp:0,goal:20,due:[],wrong:[]});
    p.practiceCardAttempt.findMany.mockResolvedValue([
      {questionId:1,correct:false,xp:0,createdAt:new Date('2026-11-17T15:59:59Z')},
      {questionId:2,correct:true,xp:10,createdAt:new Date('2026-11-17T17:30:00Z')},
      {questionId:2,correct:true,xp:0,createdAt:new Date('2026-11-17T17:31:00Z')},
    ]);
    const data=await (await call('me')).json();
    expect(data).toMatchObject({today:1,streak:2,xp:10,wrong:[1]});
  });
  it('denies student teacher endpoints and teacher access/CSV exports for other classes',async()=>{
    expect((await call('teacher')).status).toBe(403);
    (verifyToken as jest.Mock).mockResolvedValue({...payload,role:'TEACHER'});
    for(const path of ['teacher?classId=class-b','teacher?classId=class-b&export=attempts','leaderboard?classId=class-b']){
      expect((await call(path)).status).toBe(403);
    }
    expect(p.practiceCardAttempt.findMany).not.toHaveBeenCalled();
    expect(p.classGroup.findMany).toHaveBeenCalledWith({where:expect.objectContaining({OR:expect.arrayContaining([{teacherId:payload.userId}])}),select:{id:true}});
  });
  it('scopes teacher stats and BOM exports to an owned class, with zero-attempt roster students',async()=>{
    (verifyToken as jest.Mock).mockResolvedValue({...payload,role:'TEACHER'});
    const data=await (await call('teacher?classId=class-a')).json();
    expect(data.students).toHaveLength(1);expect(data.students[0]).toMatchObject({attempts:0,attempted:0,lastActive:null});
    expect(p.practiceCardAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{classId:'class-a',user:{role:'STUDENT'}}}));
    (Response as unknown as jest.Mock).mockImplementationOnce((body,init)=>({status:200,headers:new Headers(init.headers),text:async()=>body}));
    const csv=await call('teacher?classId=class-a&export=students');
    expect(csv.headers.get('Content-Type')).toContain('text/csv');
    const text=await csv.text();expect(text.charCodeAt(0)).toBe(0xFEFF);expect(text).toContain('同学甲');
  });
  it('lets admins select any active class',async()=>{
    (verifyToken as jest.Mock).mockResolvedValue({...payload,role:'ADMIN'});
    expect((await call('teacher?classId=class-b')).status).toBe(200);
  });
  it('scopes the leaderboard to active class, deduplicates identities, and reveals names only',async()=>{
    p.practiceChallenge.findMany.mockImplementation(({where})=>Promise.resolve(where.classId==='class-a'?[
      {userId:'a',correctCount:8,user:{name:'甲',username:'a'}},
      {userId:'a',correctCount:6,user:{name:'甲',username:'a'}},
      {userId:'b',correctCount:3,user:{name:null,username:'乙'}},
    ]:[]));
    expect(await practiceLeaderboard('class-a')).toEqual([{name:'甲',best:8},{name:'乙',best:3}]);
    expect(await practiceLeaderboard('class-b')).toEqual([]);
    expect(await practiceLeaderboard(null)).toEqual([]);
    expect(await (await call('leaderboard')).json()).toEqual([{name:'甲',best:8},{name:'乙',best:3}]);
    expect(p.practiceChallenge.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{classId:'class-a',finishedAt:{not:null},user:{role:'STUDENT',status:'ACTIVE'}}}));
  });
  it('starts MC-only challenges without answers and uses server time',async()=>{
    p.practiceChallenge.create.mockImplementation(({data})=>Promise.resolve({id:'run-a',...data}));
    const result=await (await call('challenge/start',{})).json();
    expect(result.seconds).toBe(60);expect(new Date(result.deadline)).toEqual(new Date(now.getTime()+60000));
    expect(result.questions.every((q:{type:string})=>q.type==='multiple-choice')).toBe(true);
    expect(JSON.stringify(result.questions)).not.toMatch(/correctAnswer|explanation/);
  });
  it('checks run ownership, sequence, deadline and finished state; challenge answers omit explanations',async()=>{
    const run={id:'run-a',userId:payload.userId,classId:'class-a',questionIds:[mc.id],answeredCount:0,correctCount:0,deadline:new Date(now.getTime()+60000),finishedAt:null};
    p.practiceChallenge.findUnique.mockResolvedValue(run);
    const body={id:run.id,position:0,answer:mc.correctAnswer};
    const result=await (await call('challenge/answer',body)).json();
    expect(result).toEqual({correct:true,xp:10});
    expect(p.practiceChallenge.update).toHaveBeenCalledWith({where:{id:run.id},data:{answeredCount:{increment:1},correctCount:{increment:1}}});
    for(const change of [{userId:'other'},{answeredCount:1},{deadline:now},{finishedAt:now}]){
      p.practiceChallenge.findUnique.mockResolvedValue({...run,...change});
      expect((await call('challenge/answer',body)).status).toBe('userId' in change?404:409);
    }
    p.practiceChallenge.findUnique.mockResolvedValue({...run,classId:'class-b'});
    expect((await call('challenge/answer',body)).status).toBe(403);
  });
  it('finishes from stored scores (not client scores), includes personal best and handles missing runs',async()=>{
    p.practiceChallenge.findUnique.mockResolvedValue({id:'run-a',userId:payload.userId,classId:'class-a',correctCount:3,answeredCount:5,finishedAt:null});
    p.practiceChallenge.aggregate.mockResolvedValue({_max:{correctCount:4}});
    expect(await (await call('challenge/finish',{id:'run-a',score:999})).json()).toMatchObject({score:3,total:5,best:4,leaderboard:[]});
    p.practiceChallenge.findUnique.mockResolvedValue(null);
    expect((await call('challenge/finish',{id:'missing'})).status).toBe(404);
  });
});
