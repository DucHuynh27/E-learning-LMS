"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  LoaderCircle,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  ApiError,
  type Attempt,
  type AttemptResult,
  type Certificate,
  type CourseProgress,
  type Health,
  type LessonProgress,
  type Quiz,
  type Session,
} from "@/lib/learning-api";
import { demoAccount, demoCourse } from "@/lib/learning-demo";

import {
  loadLearningSnapshot,
  restoreAttempt,
  forgetAttempt,
  rememberAttempt,
  type ActiveAttempt,
} from "@/lib/learning-state";
import styles from "./learning-dashboard.module.css";

function css(names: string): string {
  return names
    .split(/\s+/)
    .map(
      (name) =>
        styles[name.startsWith("learning-") ? name : `learning-${name}`],
    )
    .filter(Boolean)
    .join(" ");
}
const emptyProgress: CourseProgress = { progressPct: 0, lessons: [] };

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Thông tin đăng nhập chưa đúng hoặc phiên đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.message.startsWith("Maximum of "))
      return "Bạn đã dùng hết lượt làm bài của quiz này.";
    if (error.message.includes("active attempt"))
      return "Bạn đang có một lượt làm bài chưa nộp. Hãy hoàn tất lượt đang mở hoặc chờ hết thời gian.";
    if (error.message.includes("time limit"))
      return "Lượt làm bài đã hết thời gian. Bạn có thể bắt đầu lượt mới nếu còn lượt.";
    if (error.message.includes("already been submitted"))
      return "Lượt này đã được nộp. Hãy bắt đầu một lượt mới.";
    if (error.status === 503)
      return "Dữ liệu học tập hoặc dịch vụ backend chưa sẵn sàng. Vui lòng thử tải lại.";
  }
  return error instanceof Error
    ? error.message
    : "Có lỗi xảy ra. Vui lòng thử lại.";
}

export function LearningDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(demoAccount.email);
  const [password, setPassword] = useState(demoAccount.password);
  const [progress, setProgress] = useState<CourseProgress>(emptyProgress);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<Health | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    api<Health>("/health")
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) setHealthFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!attempt?.deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [attempt]);

  async function loadSnapshot(token: string) {
    const snapshot = await loadLearningSnapshot(
      token,
      demoCourse.id,
      demoCourse.quizLessonId,
    );
    setProgress(snapshot.course);
    setCertificates(snapshot.certificates);
    setQuiz(snapshot.quiz);
  }

  async function task(name: string, work: () => Promise<void>) {
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (caught) {
      if (
        session &&
        caught instanceof ApiError &&
        caught.status === 409 &&
        caught.message.includes("already been submitted")
      ) {
        forgetAttempt(session.user.id);
        setAttempt(null);
      }
      setError(messageFor(caught));
    } finally {
      setBusy("");
    }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void task("login", async () => {
      const data = await api<Session>("/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(data);
      await loadSnapshot(data.accessToken);
      setAttempt(restoreAttempt(data.user.id));
      setNow(Date.now());
      setNotice(`Chào ${data.user.fullName}, lớp học đã sẵn sàng.`);
    });
  }

  function signOut() {
    if (session) forgetAttempt(session.user.id);
    setSession(null);
    setProgress(emptyProgress);
    setCertificates([]);
    setQuiz(null);
    setAttempt(null);
    setResult(null);
    setAnswers({});
    setDrafts({});
    setError("");
    setNotice("");
  }

  function saveProgress(lessonId: string, watchedSec: number) {
    if (!session) return;
    void task(lessonId, async () => {
      const updated = await api<LessonProgress>(
        `/lessons/${lessonId}/progress`,
        session.accessToken,
        { method: "PATCH", body: JSON.stringify({ watchedSec }) },
      );
      setDrafts((current) => ({ ...current, [lessonId]: updated.watchedSec }));
      await loadSnapshot(session.accessToken);
      setNotice(
        updated.completed
          ? "Đã hoàn thành bài học. Tiến độ khóa học đã được cập nhật."
          : "Đã lưu tiến độ. Mỗi bước nhỏ đều được ghi nhận.",
      );
    });
  }

  function startQuiz() {
    if (!session || !quiz) return;
    void task("start", async () => {
      const started = await api<Attempt>(
        `/lessons/${demoCourse.quizLessonId}/quiz/attempts`,
        session.accessToken,
        { method: "POST" },
      );
      const active = {
        ...started,
        deadline: started.expiresAt ? Date.parse(started.expiresAt) : null,
      };
      setAttempt(active);
      setAnswers({});
      setResult(null);
      setNow(Date.now());
      rememberAttempt(session.user.id, started);
    });
  }

  function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !attempt) return;
    void task("submit", async () => {
      const submitted = await api<AttemptResult>(
        `/quiz-attempts/${attempt.attemptId}/submit`,
        session.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            answers: Object.entries(answers).map(([questionId, optionId]) => ({
              questionId,
              optionId,
            })),
          }),
        },
      );
      setResult(submitted);
      setAttempt(null);
      forgetAttempt(session.user.id);
      setNotice("Bài làm đã được chấm trên server.");
    });
  }

  const completed = progress.lessons.filter(
    (lesson) => lesson.completed,
  ).length;
  const remaining = attempt?.deadline
    ? Math.max(0, Math.ceil((attempt.deadline - now) / 1000))
    : null;
  const expired = remaining === 0;
  const courseCertificates = certificates.filter(
    (certificate) => certificate.courseId === demoCourse.id,
  );

  return (
    <div className={css("learning-app")}>
      <div className={css("dashboard-shell")}>
        <div className={css("account-bar")}>
          <span>{session ? session.user.fullName : "Không gian Learning"}</span>
          {session && (
            <button
              className={css("button outline")}
              onClick={signOut}
              disabled={!!busy}
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          )}
        </div>
      </div>

      <div className={css("dashboard-shell")}>
        <div className={css("breadcrumb")}>
          Không gian học tập <ChevronRight size={14} />
          <span>Learning demo</span>
        </div>
        <section className={css("welcome-section")}>
          <div>
            <p className={css("eyebrow")}>MỖI NGÀY, MỘT BƯỚC TIẾN</p>
            <h1>
              Học một chút.
              <br />
              Tiến xa hơn.
            </h1>
            <p className={css("welcome-copy")}>
              Tiếp tục bài học, kiểm tra kiến thức và ghi nhận
              <br className={css("desktop-break")} /> từng cột mốc trên hành
              trình của bạn.
            </p>
            <a href="#lessons" className={css("text-link")}>
              Vào lớp học <ArrowRight size={17} />
            </a>
          </div>
          <div className={css("journey-card")}>
            <div className={css("journey-top")}>
              <span>HÀNH TRÌNH CỦA BẠN</span>
              <GraduationCap size={25} />
            </div>
            <div className={css("journey-content")}>
              <div
                className={css("progress-ring")}
                style={{
                  background: `conic-gradient(#ffffff ${progress.progressPct * 3.6}deg, #ffffff26 0deg)`,
                }}
              >
                <div>
                  <strong>
                    {progress.progressPct}
                    <span>%</span>
                  </strong>
                  <small>HOÀN THÀNH</small>
                </div>
              </div>
              <div>
                <h2>
                  Từng bài học,
                  <br />
                  một thành quả mới.
                </h2>
                <p>
                  {completed}/{demoCourse.lessons.length} bài học đã hoàn thành
                </p>
              </div>
            </div>
            <div className={css("journey-bottom")}>
              <span>
                <span className={css("status-dot")} /> Tiến độ được lưu tự động
                sau khi cập nhật
              </span>
              <ArrowUpRight size={18} />
            </div>
          </div>
        </section>

        <section className={css("overview")} aria-label="Tổng quan học tập">
          <div>
            <span className={css("stat-icon")}>
              <BookOpen size={20} />
            </span>
            <span>
              <strong>02</strong>
              <small>Bài học trong khóa</small>
            </span>
          </div>
          <div>
            <span className={css("stat-icon green")}>
              <CheckCircle2 size={20} />
            </span>
            <span>
              <strong>{String(completed).padStart(2, "0")}</strong>
              <small>Bài học đã hoàn thành</small>
            </span>
          </div>
          <div>
            <span className={css("stat-icon orange")}>
              <Award size={20} />
            </span>
            <span>
              <strong>
                {String(courseCertificates.length).padStart(2, "0")}
              </strong>
              <small>Chứng chỉ đạt được</small>
            </span>
          </div>
          <div className={css("connection")}>
            <span
              className={css(
                `status-dot ${health ? "online" : healthFailed ? "offline" : "pending"}`,
              )}
            />
            <span>
              <strong>
                {health
                  ? "Đã kết nối"
                  : healthFailed
                    ? "Chưa kết nối"
                    : "Đang kết nối…"}
              </strong>
              <small>Hệ thống học tập</small>
            </span>
          </div>
        </section>

        {!session && (
          <section
            className={css("login-card")}
            aria-labelledby="login-heading"
          >
            <div>
              <span className={css("section-kicker")}>BẮT ĐẦU TẠI ĐÂY</span>
              <h2 id="login-heading">Vào lớp học demo</h2>
              <p>
                Tài khoản mẫu đã được điền sẵn. Đăng nhập để lưu tiến độ và làm
                bài.
              </p>
            </div>
            <form onSubmit={signIn} className={css("login-form")}>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                Mật khẩu
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <button className={css("button primary")} disabled={!!busy}>
                {busy === "login" ? (
                  <LoaderCircle size={17} className={css("spin")} />
                ) : (
                  <LogIn size={17} />
                )}
                Đăng nhập
              </button>
            </form>
          </section>
        )}

        <div className={css("feedback-region")} aria-live="polite">
          {error && (
            <div className={css("feedback error")} role="alert">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className={css("feedback success")} role="status">
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}
        </div>

        <div className={css("learning-grid")}>
          <section className={css("lesson-section")} id="lessons">
            <div className={css("section-heading")}>
              <div>
                <span className={css("section-kicker")}>KHÓA HỌC CỦA BẠN</span>
                <h2>{demoCourse.title}</h2>
              </div>
              <button
                className={css("icon-button")}
                title="Tải lại tiến độ"
                aria-label="Tải lại tiến độ"
                disabled={!session || !!busy}
                onClick={() => {
                  if (session)
                    void task("refresh", async () => {
                      setDrafts({});
                      await loadSnapshot(session.accessToken);
                      setNotice("Đã cập nhật dữ liệu mới nhất.");
                    });
                }}
              >
                <RefreshCw
                  size={18}
                  className={busy === "refresh" ? "spin" : ""}
                />
              </button>
            </div>
            <div className={css("course-progress")}>
              <div>
                <span>Tiến độ khóa học</span>
                <strong>{progress.progressPct}%</strong>
              </div>
              <progress
                max={100}
                value={progress.progressPct}
                aria-label="Tiến độ khóa học"
              />
            </div>
            <div className={css("lesson-list")}>
              {demoCourse.lessons.map((lesson, index) => {
                const saved = progress.lessons.find(
                  (item) => item.lessonId === lesson.id,
                );
                const watched = drafts[lesson.id] ?? saved?.watchedSec ?? 0;
                return (
                  <article
                    className={css(
                      `lesson-card ${saved?.completed ? "is-complete" : ""}`,
                    )}
                    key={lesson.id}
                  >
                    <div className={css("lesson-title")}>
                      <span className={css("lesson-number")}>
                        {saved?.completed ? (
                          <Check size={20} />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <h3>{lesson.title}</h3>
                        <p>{lesson.description}</p>
                      </div>
                      <span
                        className={css(
                          `lesson-badge ${saved?.completed ? "complete" : ""}`,
                        )}
                      >
                        {saved?.completed ? "Hoàn thành" : "Chưa hoàn thành"}
                      </span>
                    </div>
                    <div className={css("watch-control")}>
                      <label htmlFor={`watch-${lesson.id}`}>
                        Mô phỏng thời gian xem{" "}
                        <span>
                          {watched}
                          <small> / {lesson.durationSec} giây</small>
                        </span>
                      </label>
                      <input
                        id={`watch-${lesson.id}`}
                        type="range"
                        min={0}
                        max={lesson.durationSec}
                        step={1}
                        value={watched}
                        disabled={!session || !!busy}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [lesson.id]: Number(event.target.value),
                          }))
                        }
                      />
                      <div className={css("lesson-actions")}>
                        <span>
                          <Clock3 size={14} />
                          Hoàn thành khi xem từ 90 giây
                        </span>
                        <div>
                          <button
                            className={css("button subtle")}
                            disabled={!session || !!busy}
                            onClick={() => saveProgress(lesson.id, watched)}
                          >
                            {busy === lesson.id ? (
                              <LoaderCircle className={css("spin")} size={15} />
                            ) : null}
                            Lưu tiến độ
                          </button>
                          <button
                            className={css("button outline")}
                            disabled={!session || !!busy || saved?.completed}
                            onClick={() =>
                              saveProgress(
                                lesson.id,
                                Math.ceil(lesson.durationSec * 0.9),
                              )
                            }
                          >
                            <Check size={15} />
                            Hoàn thành bài
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className={css("section-note")}>
              <ShieldCheck size={15} />
              Tiến độ đã lưu không bị giảm khi bạn gửi lại thời gian thấp hơn.
            </p>
          </section>

          <section className={css("quiz-section")} id="quiz">
            <div className={css("section-heading")}>
              <div>
                <span className={css("section-kicker")}>
                  KIỂM TRA KIẾN THỨC
                </span>
                <h2>Một quiz nhỏ, hiểu hơn một chút.</h2>
              </div>
              <span className={css("quiz-icon")}>
                <GraduationCap size={24} />
              </span>
            </div>
            <div className={css("quiz-meta")}>
              <span>{quiz?.questions.length ?? 0} câu hỏi</span>
              <span>
                {quiz
                  ? quiz.timeLimitSec
                    ? `${Math.round(quiz.timeLimitSec / 60)} phút`
                    : "Không giới hạn thời gian"
                  : "3 phút"}
              </span>
              <span>Đạt từ {quiz?.passScore ?? 70} điểm</span>
            </div>
            {result && (
              <div
                className={css(`quiz-result ${result.passed ? "passed" : ""}`)}
                role="status"
              >
                <Award size={28} />
                <div>
                  <strong>
                    {result.score}
                    <small>/100 điểm</small>
                  </strong>
                  <span>
                    {result.passed
                      ? "Làm tốt lắm! Bạn đã vượt qua quiz."
                      : "Chưa đạt lần này. Bạn có thể thử lại nếu còn lượt."}
                  </span>
                </div>
              </div>
            )}
            {session && !quiz ? (
              <p className={css("section-note")}>Bài học này chưa có quiz.</p>
            ) : attempt ? (
              <form onSubmit={submitQuiz} className={css("quiz-form")}>
                <div
                  className={css(`quiz-timer ${expired ? "expired" : ""}`)}
                  role="timer"
                  aria-label="Thời gian còn lại"
                >
                  <Clock3 size={16} />
                  {remaining === null
                    ? "Không giới hạn thời gian"
                    : `${Math.floor(remaining / 60)
                        .toString()
                        .padStart(
                          2,
                          "0",
                        )}:${(remaining % 60).toString().padStart(2, "0")} còn lại`}
                </div>
                {attempt.questions.map((question, index) => (
                  <fieldset key={question.id}>
                    <legend>
                      <span>Câu {index + 1}.</span> {question.content}
                    </legend>
                    {question.options.map((option) => (
                      <label
                        className={css(
                          `quiz-option ${answers[question.id] === option.id ? "selected" : ""}`,
                        )}
                        key={option.id}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.id}
                          checked={answers[question.id] === option.id}
                          onChange={() =>
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: option.id,
                            }))
                          }
                          disabled={!!busy || expired}
                        />
                        <span>{option.content}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                {expired ? (
                  <>
                    <p className={css("expired-note")}>
                      Lượt làm bài đã hết giờ.
                    </p>
                    <button
                      type="button"
                      className={css("button primary full-width")}
                      onClick={startQuiz}
                      disabled={!!busy}
                    >
                      Bắt đầu lượt mới
                      <ArrowRight size={17} />
                    </button>
                  </>
                ) : (
                  <button
                    className={css("button primary full-width")}
                    disabled={!!busy}
                  >
                    {busy === "submit" ? (
                      <LoaderCircle className={css("spin")} size={17} />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    Nộp bài & xem kết quả
                  </button>
                )}
              </form>
            ) : (
              <div className={css("quiz-ready")}>
                <div className={css("quiz-illustration")}>
                  <BookOpen size={38} />
                  <span>
                    <Check size={18} />
                  </span>
                </div>
                <h3>
                  {result
                    ? "Sẵn sàng thử thêm một lần?"
                    : "Bạn đã sẵn sàng chưa?"}
                </h3>
                <p>
                  Chọn một đáp án cho mỗi câu.
                  <br />
                  Kết quả được chấm ngay sau khi nộp.
                </p>
                <button
                  className={css("button primary full-width")}
                  onClick={startQuiz}
                  disabled={!session || !quiz || !!busy}
                >
                  {busy === "start" ? (
                    <LoaderCircle size={17} className={css("spin")} />
                  ) : (
                    <Play size={16} />
                  )}
                  {result ? "Làm lại quiz" : "Bắt đầu làm quiz"}
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
            <p className={css("quiz-footnote")}>
              <ShieldCheck size={14} />
              Chấm trên server · Tối đa 3 lượt làm bài
            </p>
          </section>
        </div>

        <section id="certificates" className={css("certificate-section")}>
          <div className={css("certificate-symbol")}>
            <Award size={34} />
          </div>
          <div className={css("certificate-copy")}>
            <span className={css("section-kicker")}>THÀNH QUẢ CỦA BẠN</span>
            <h2>
              {courseCertificates.length
                ? "Một cột mốc đáng nhớ."
                : "Học trọn vẹn. Nhận chứng chỉ."}
            </h2>
            <p>
              {courseCertificates.length
                ? "Chứng chỉ đã được cấp và lưu lại. Bạn có thể mở trang xác thực bất cứ lúc nào."
                : "Hoàn thành cả hai bài học để nhận chứng chỉ tự động. Mỗi khóa học chỉ cấp một chứng chỉ."}
            </p>
            {courseCertificates.map((certificate) => (
              <a
                className={css("button certificate-link")}
                key={certificate.serialNo}
                href={`/api/certificates/${encodeURIComponent(certificate.serialNo)}/verify`}
                target="_blank"
                rel="noreferrer"
              >
                Xem chứng chỉ <ArrowUpRight size={17} />
              </a>
            ))}
          </div>
          <div className={css("certificate-status")}>
            {courseCertificates.length ? (
              <>
                <CheckCircle2 size={22} />
                <strong>Đã cấp chứng chỉ</strong>
                <small>
                  {new Date(courseCertificates[0].issuedAt).toLocaleDateString(
                    "vi-VN",
                  )}
                </small>
              </>
            ) : (
              <>
                <span>
                  {completed}
                  <small> / 2</small>
                </span>
                <small>BÀI HỌC HOÀN THÀNH</small>
              </>
            )}
          </div>
        </section>

        <footer className={css("site-footer")}>
          <span>
            <BookOpen size={16} /> E-learning LMS{" "}
            <span className={css("footer-separator")}>/</span> Không gian
            Learning
          </span>
          <p>
            Bản demo local · Course/Lesson dùng dữ liệu mẫu · Progress, Quiz và
            Certificate dùng API NestJS thật.
          </p>
        </footer>
      </div>
    </div>
  );
}
