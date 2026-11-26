-- Open in DataGrip and run against elearning_lms.
BEGIN TRANSACTION READ ONLY;

-- Row counts for all tables in the main schema.
SELECT * FROM (
  SELECT 'users' AS table_name, count(*) AS row_count FROM public.users
  UNION ALL SELECT 'courses', count(*) FROM public.courses
  UNION ALL SELECT 'sections', count(*) FROM public.sections
  UNION ALL SELECT 'lessons', count(*) FROM public.lessons
  UNION ALL SELECT 'enrolments', count(*) FROM public.enrolments
  UNION ALL SELECT 'lesson_progress', count(*) FROM public.lesson_progress
  UNION ALL SELECT 'quizzes', count(*) FROM public.quizzes
  UNION ALL SELECT 'quiz_questions', count(*) FROM public.quiz_questions
  UNION ALL SELECT 'quiz_options', count(*) FROM public.quiz_options
  UNION ALL SELECT 'quiz_attempts', count(*) FROM public.quiz_attempts
  UNION ALL SELECT 'quiz_answers', count(*) FROM public.quiz_answers
  UNION ALL SELECT 'certificates', count(*) FROM public.certificates
  UNION ALL SELECT 'qna_threads', count(*) FROM public.qna_threads
  UNION ALL SELECT 'qna_posts', count(*) FROM public.qna_posts
  UNION ALL SELECT 'notifications', count(*) FROM public.notifications
  UNION ALL SELECT 'migrations', count(*) FROM public.migrations
) AS summary
ORDER BY table_name;

-- Registered accounts and seed accounts. The password hash is omitted.
SELECT id, email, "fullName", role, "createdAt", "updatedAt"
FROM public.users
ORDER BY "createdAt" DESC;

SELECT * FROM public.courses ORDER BY "createdAt" DESC;
SELECT * FROM public.sections ORDER BY "courseId", position;
SELECT * FROM public.lessons ORDER BY "sectionId", position;

SELECT enrolment.*, account.email, course.title AS course_title
FROM public.enrolments enrolment
JOIN public.users account ON account.id = enrolment."userId"
JOIN public.courses course ON course.id = enrolment."courseId"
ORDER BY enrolment."enrolledAt" DESC;

SELECT * FROM public.lesson_progress;
SELECT * FROM public.quizzes ORDER BY "lessonId";
SELECT * FROM public.quiz_questions ORDER BY "quizId", position;
SELECT * FROM public.quiz_options ORDER BY "questionId", position;
SELECT * FROM public.quiz_attempts ORDER BY "startedAt" DESC;
SELECT * FROM public.quiz_answers;
SELECT * FROM public.certificates ORDER BY "issuedAt" DESC;
SELECT * FROM public.qna_threads ORDER BY "createdAt" DESC;
SELECT * FROM public.qna_posts ORDER BY "createdAt" DESC;
SELECT * FROM public.notifications ORDER BY "createdAt" DESC;
SELECT * FROM public.migrations ORDER BY id;

COMMIT;
