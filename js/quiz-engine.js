/* ==================== QUIZ STATE ==================== */
let quiz = {
  questions: [],
  answers: [],
  startTime: 0,
  elapsed: 0,
  timerId: null,
  showTimer: true,
  submitted: false,
  originalQuestions: []
};

/* ==================== START QUIZ ==================== */
function startQuiz(originalQuestions){
  const doShuffleQ = $('shuffleQ').checked;
  const doShuffleOpt = $('shuffleOpt').checked;

  // Deep copy
  let qs = originalQuestions.map(q => ({
    questionText: q.questionText,
    options: q.options.slice(),
    letters: (q.letters || []).slice(),
    correctIndex: q.correctIndex
  }));

  if (doShuffleQ){
    qs = shuffleArray(qs);
  }
  if (doShuffleOpt){
    qs = qs.map(q => {
      const idxs = q.options.map((_, i) => i);
      const shuffled = shuffleArray(idxs);
      const newOptions = shuffled.map(i => q.options[i]);
      // Gán lại letter theo vị trí mới
      const newLetters = shuffled.map((_, pos) => idxToLetter(pos));
      // Tìm vị trí mới của đáp án đúng
      const newCorrect = q.correctIndex >= 0
        ? shuffled.indexOf(q.correctIndex)
        : -1;
      return {
        questionText: q.questionText,
        options: newOptions,
        letters: newLetters,
        correctIndex: newCorrect
      };
    });
  }

  quiz.questions = qs;
  quiz.originalQuestions = originalQuestions;
  quiz.answers = new Array(qs.length).fill(-1);
  quiz.submitted = false;
  quiz.startTime = Date.now();
  quiz.elapsed = 0;

  $('uploadView').classList.add('hidden');
  $('quizView').classList.remove('hidden');
  $('navigator').classList.remove('hidden');
  $('previewBox').classList.add('hidden');
  const sb = $('startQuizBtn');
  if (sb) sb.remove();

  renderQuiz();
  renderNavigator();
  updateProgress();
  startTimer();
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ==================== RENDER QUIZ ==================== */
function renderQuiz(){
  const c = $('questionsContainer');
  c.innerHTML = quiz.questions.map((q, qi) => {
    const opts = q.options.map((o, oi) => `
      <label class="opt" data-q="${qi}" data-o="${oi}">
        <input type="radio" name="q${qi}" value="${oi}"
               ${quiz.answers[qi] === oi ? 'checked' : ''}>
        <span class="key">${idxToLetter(oi)}.</span>
        <span>${escapeHtml(o)}</span>
      </label>
    `).join('');
    return `
      <article class="question-card" id="qcard-${qi}" data-qi="${qi}">
        <div class="q-title">
          <span class="q-num">Câu ${qi + 1}</span>
          <span>${escapeHtml(q.questionText)}</span>
        </div>
        <div class="q-options">${opts}</div>
      </article>
    `;
  }).join('');

  c.addEventListener('change', e => {
    if (quiz.submitted) return;
    if (e.target.matches('input[type=radio]')){
      const label = e.target.closest('.opt');
      const qi = parseInt(label.dataset.q, 10);
      const oi = parseInt(e.target.value, 10);
      quiz.answers[qi] = oi;
      c.querySelectorAll(`.opt[data-q="${qi}"]`).forEach(el => el.classList.remove('selected'));
      label.classList.add('selected');

      const isPractice = $('practiceMode') && $('practiceMode').checked;
      if (isPractice) {
        const q = quiz.questions[qi];
        c.querySelectorAll(`.opt[data-q="${qi}"]`).forEach((el, idx) => {
          el.classList.remove('correct-answer', 'wrong-answer');
          if (q.correctIndex >= 0 && idx === q.correctIndex) el.classList.add('correct-answer');
          if (q.correctIndex >= 0 && idx === oi && oi !== q.correctIndex) el.classList.add('wrong-answer');
        });
      }

      updateProgress();
      renderNavigator();
      saveSession();
    }
  });
}

/* ==================== NAVIGATOR ==================== */
function renderNavigator(){
  const grid = $('navGrid');
  grid.innerHTML = quiz.questions.map((_, i) => {
    let cls = 'nav-dot';
    if (quiz.submitted){
      const q = quiz.questions[i];
      const ans = quiz.answers[i];
      if (q.correctIndex === -1) cls += ' invalid';
      else if (ans === -1) cls += ' ';
      else if (ans === q.correctIndex) cls += ' correct';
      else cls += ' wrong';
    } else if (quiz.answers[i] !== -1){
      cls += ' answered';
    }
    return `<button class="${cls}" data-nav="${i}">${i + 1}</button>`;
  }).join('');
}

$('navGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-nav]');
  if (!b) return;
  const i = parseInt(b.dataset.nav, 10);
  const card = $('qcard-' + i);
  if (card) card.scrollIntoView({behavior:'smooth', block:'start'});
});

$('navCloseBtn').addEventListener('click', () => {
  $('navigator').classList.add('hidden');
});

/* ==================== PROGRESS ==================== */
function updateProgress(){
  const total = quiz.questions.length;
  const answered = quiz.answers.filter(a => a !== -1).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  $('answeredCount').textContent = answered;
  $('totalCount').textContent = total;
  $('percentDone').textContent = pct + '%';
  $('quizProgressFill').style.width = pct + '%';
}

/* ==================== TIMER ==================== */
function startTimer(){
  stopTimer();
  quiz.timerId = setInterval(() => {
    quiz.elapsed = Math.floor((Date.now() - quiz.startTime) / 1000);
    $('timerText').textContent = fmtTime(quiz.elapsed);
  }, 1000);
  $('timerText').textContent = fmtTime(0);
}
function stopTimer(){
  if (quiz.timerId) clearInterval(quiz.timerId);
  quiz.timerId = null;
}
$('toggleTimerBtn').addEventListener('click', () => {
  quiz.showTimer = !quiz.showTimer;
  $('timerBox').classList.toggle('hidden', !quiz.showTimer);
  $('toggleTimerBtn').innerHTML = quiz.showTimer
    ? '<i class="fas fa-eye"></i>'
    : '<i class="fas fa-eye-slash"></i>';
});

/* ==================== SUBMIT ==================== */
$('submitBtn').addEventListener('click', () => {
  const unanswered = quiz.answers.filter(a => a === -1).length;
  if (unanswered > 0){
    if (!confirm(`Còn ${unanswered} câu chưa làm. Vẫn nộp bài?`)) return;
  }
  submitQuiz();
});

function submitQuiz(){
  quiz.submitted = true;
  stopTimer();

  let correct = 0, wrong = 0, skipped = 0, invalid = 0;
  quiz.questions.forEach((q, i) => {
    const a = quiz.answers[i];
    if (q.correctIndex === -1){ invalid++; return; }
    if (a === -1) skipped++;
    else if (a === q.correctIndex) correct++;
    else wrong++;
  });

  // Update từng câu
  quiz.questions.forEach((q, i) => {
    const card = $('qcard-' + i);
    if (!card) return;
    const a = quiz.answers[i];

    if (q.correctIndex === -1){
      card.classList.add('invalid');
    } else if (a === -1){
      card.classList.add('skipped');
    } else if (a === q.correctIndex){
      card.classList.add('correct');
    } else {
      card.classList.add('wrong');
    }

    card.querySelectorAll('.opt').forEach((el, oi) => {
      el.querySelector('input').disabled = true;
      el.classList.remove('selected');
      if (q.correctIndex >= 0 && oi === q.correctIndex) el.classList.add('correct-answer');
      if (q.correctIndex >= 0 && oi === a && oi !== q.correctIndex) el.classList.add('wrong-answer');
    });

    // Badge
    const badge = document.createElement('div');
    let badgeCls = 'answer-badge';
    let text;
    if (q.correctIndex === -1){
      badgeCls += ' invalid';
      text = '⚠️ Câu hỏi lỗi — không có đáp án đúng trong dữ liệu';
    } else if (a === q.correctIndex){
      badgeCls += ' ok';
      text = `✅ Chính xác`;
    } else if (a === -1){
      badgeCls += ' bad';
      text = `⚠️ Bỏ trống · Đáp án: ${idxToLetter(q.correctIndex)}`;
    } else {
      badgeCls += ' bad';
      text = `❌ Sai · Đáp án đúng: ${idxToLetter(q.correctIndex)}`;
    }
    badge.className = badgeCls;
    badge.innerHTML = text;
    card.appendChild(badge);
  });

  renderNavigator();
  showScore(correct, wrong, skipped, invalid);
  saveSession();
}

/* ==================== SCORE MODAL ==================== */
function showScore(correct, wrong, skipped, invalid){
  const total = quiz.questions.length;
  const gradable = total - (invalid || 0);
  const pct = gradable ? (correct / gradable) * 100 : 0;

  $('scoreNum').textContent = correct;
  $('scoreTotal').textContent = gradable;
  $('scorePct').textContent = pct.toFixed(1) + '%';
  $('statCorrect').textContent = correct;
  $('statWrong').textContent = wrong;
  $('statSkipped').textContent = skipped;

  let rank;
  if (pct >= 90) rank = '🏆 Xuất sắc';
  else if (pct >= 80) rank = '🌟 Giỏi';
  else if (pct >= 65) rank = '👍 Khá';
  else if (pct >= 50) rank = '📚 Trung bình';
  else rank = '💪 Cần cố gắng';
  if (invalid > 0){
    rank += ` · ${invalid} câu lỗi`;
  }
  $('scoreRank').textContent = rank;

  $('scoreModal').classList.add('open');
  if (pct >= 80) shootConfetti();
}

function shootConfetti(){
  const colors = ['#0ea5e9','#6366f1','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6'];
  for (let i = 0; i < 80; i++){
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.top = '-20px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration = (2 + Math.random() * 2) + 's';
    p.style.animationDelay = (Math.random() * 0.5) + 's';
    if (Math.random() > 0.6) p.style.borderRadius = '50%';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4500);
  }
}

/* ==================== MODAL ACTIONS ==================== */
$$('[data-close]').forEach(b => {
  b.addEventListener('click', () => {
    b.closest('.modal-backdrop').classList.remove('open');
  });
});
$$('.modal-backdrop').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) m.classList.remove('open');
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
  }
});

/* ==================== REVIEW ==================== */
$('reviewBtn').addEventListener('click', () => {
  $('scoreModal').classList.remove('open');
  window.scrollTo({top:0, behavior:'smooth'});
  toast('Câu đúng xanh · Câu sai đỏ · Đáp án đúng được tô xanh', 'success');
});

/* ==================== RETRY ==================== */
$('retryBtn').addEventListener('click', () => {
  $('scoreModal').classList.remove('open');
  startQuiz(quiz.originalQuestions);
  toast('Đã bắt đầu lại với đề mới (đã xáo trộn)', 'success');
});

/* ==================== NEW QUIZ ==================== */
$('newQuizBtn').addEventListener('click', () => {
  $('scoreModal').classList.remove('open');
  $('quizView').classList.add('hidden');
  $('uploadView').classList.remove('hidden');
  $('navigator').classList.add('hidden');
  clearSession();
  stopTimer();
  window.scrollTo({top:0, behavior:'smooth'});
});

/* ==================== BACK ==================== */
$('backBtn').addEventListener('click', () => {
  if (quiz.questions.length && !quiz.submitted){
    if (!confirm('Quay lại sẽ mất tiến trình làm bài. Tiếp tục?')) return;
  }
  $('quizView').classList.add('hidden');
  $('uploadView').classList.remove('hidden');
  $('navigator').classList.add('hidden');
  stopTimer();
  clearSession();
});

/* ==================== EXPORT ==================== */
$('exportBtn').addEventListener('click', () => {
  const total = quiz.questions.length;
  const lines = [`KẾT QUẢ LUYỆN TRẮC NGHIỆM`, `Thời gian: ${fmtTime(quiz.elapsed)}`, ``];
  let correct = 0;
  quiz.questions.forEach((q, i) => {
    const a = quiz.answers[i];
    const isCorrect = q.correctIndex >= 0 && a === q.correctIndex;
    if (isCorrect) correct++;
    lines.push(`Câu ${i+1}: ${q.questionText}`);
    q.options.forEach((o, oi) => {
      const marker = oi === q.correctIndex ? '✓' : ' ';
      const chosen = oi === a ? ' ←' : '';
      lines.push(`  ${marker} ${idxToLetter(oi)}. ${o}${chosen}`);
    });
    let status;
    if (q.correctIndex === -1) status = 'Câu lỗi (không có đáp án)';
    else if (a === -1) status = 'Bỏ trống';
    else if (isCorrect) status = 'Đúng';
    else status = 'Sai';
    lines.push(`→ ${status}`);
    lines.push('');
  });
  lines.push(`ĐIỂM: ${correct}/${total} (${(correct/total*100).toFixed(1)}%)`);
  lines.push(`Thời gian: ${fmtTime(quiz.elapsed)}`);

  const blob = new Blob([lines.join('\n')], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ket-qua-trac-nghiem-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Đã xuất kết quả', 'success');
});

/* ==================== KEYBOARD SHORTCUTS ==================== */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === '/'){
    e.preventDefault();
    $('helpModal').classList.add('open');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
    if (!$('quizView').classList.contains('hidden') && !quiz.submitted){
      e.preventDefault();
      $('submitBtn').click();
    }
    return;
  }
  if (!$('quizView').classList.contains('hidden') && !quiz.submitted){
    if (/^[1-9]$/.test(e.key)){
      const cards = Array.from($$('.question-card'));
      const viewportMid = window.innerHeight / 3;
      let currentCard = null;
      for (const c of cards){
        const r = c.getBoundingClientRect();
        if (r.top >= 0 && r.top < viewportMid){ currentCard = c; break; }
      }
      if (!currentCard) currentCard = cards[0];
      if (!currentCard) return;
      const qi = parseInt(currentCard.dataset.qi, 10);
      const oi = parseInt(e.key, 10) - 1;
      if (oi < quiz.questions[qi].options.length){
        const input = currentCard.querySelector(`input[value="${oi}"]`);
        if (input){ input.checked = true; input.dispatchEvent(new Event('change', {bubbles:true})); }
      }
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
      const cards = Array.from($$('.question-card'));
      const viewportTop = 150;
      let current = 0;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        if (r.top < viewportTop) current = i;
      });
      const next = Math.max(0, Math.min(cards.length - 1, current + (e.key === 'ArrowRight' ? 1 : 0) - (e.key === 'ArrowLeft' ? 1 : 0)));
      const target = cards[next];
      if (target) target.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }
});

/* ==================== SESSION SAVE / LOAD ==================== */
function saveSession(){
  try {
    if (!quiz.questions.length) return;
    localStorage.setItem(LS.session, JSON.stringify({
      questions: quiz.questions,
      answers: quiz.answers,
      elapsed: quiz.elapsed,
      submitted: quiz.submitted,
      originalQuestions: quiz.originalQuestions,
      savedAt: Date.now()
    }));
  } catch(e){}
}
function clearSession(){
  localStorage.removeItem(LS.session);
  quiz = { questions: [], answers: [], startTime: 0, elapsed: 0, timerId: null, showTimer: true, submitted: false, originalQuestions: [] };
}
const saveSessionDebounced = (() => {
  let t; return () => { clearTimeout(t); t = setTimeout(saveSession, 400); };
})();

/* ==================== AUTO RESTORE ==================== */
function tryRestoreSession(){
  const raw = localStorage.getItem(LS.session);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (!s.questions || !s.questions.length) return;
    if (Date.now() - (s.savedAt || 0) > 6 * 3600 * 1000){
      localStorage.removeItem(LS.session);
      return;
    }
    if (confirm('Bạn có một bài làm dở chưa hoàn thành. Khôi phục lại?')){
      quiz.questions = s.questions;
      quiz.originalQuestions = s.originalQuestions || s.questions;
      quiz.answers = s.answers || new Array(s.questions.length).fill(-1);
      quiz.submitted = !!s.submitted;
      quiz.elapsed = s.elapsed || 0;
      quiz.startTime = Date.now() - (quiz.elapsed * 1000);

      $('uploadView').classList.add('hidden');
      $('quizView').classList.remove('hidden');
      $('navigator').classList.remove('hidden');

      renderQuiz();
      renderNavigator();
      updateProgress();
      if (!quiz.submitted) startTimer();
      else submitQuiz();
    } else {
      localStorage.removeItem(LS.session);
    }
  } catch(e){
    localStorage.removeItem(LS.session);
  }
}

/* ==================== HELP ==================== */
$('helpBtn').addEventListener('click', () => {
  $('helpModal').classList.add('open');
});


/* ==================== SAMPLE QUIZZES & PRACTICE MODE ==================== */
const SAMPLES = {
  eng: `Câu 1: If I _______ you, I would study harder for the upcoming exam.
A. was
B. were
C. had been
D. would be
Đáp án: B

Câu 2: The bridge was built _______ 1998 by a famous French architect.
A. on
B. at
C. in
D. for
Đáp án: C

Câu 3: She suggested _______ a short break before continuing the project.
A. take
B. taking
C. to take
D. took
Đáp án: B

Câu 4: Neither Peter nor his friends _______ present at yesterday's meeting.
A. is
B. was
C. are
D. were
Đáp án: D

Câu 5: It is essential that every student _______ the regulations carefully.
A. follows
B. follow
C. followed
D. to follow
Đáp án: B`,

  web: `Câu 1: Thẻ HTML nào dùng để tạo một danh sách có thứ tự?
A. <ul>
B. <ol>
C. <li>
D. <dl>
Đáp án: B

Câu 2: Trong CSS, thuộc tính nào dùng để căn giữa phần tử dạng flexbox theo trục chính?
A. align-items
B. justify-content
C. text-align
D. align-content
Đáp án: B

Câu 3: Kết quả của biểu thức typeof null trong JavaScript là gì?
A. "null"
B. "undefined"
C. "object"
D. "boolean"
Đáp án: C

Câu 4: Cú pháp nào dùng để khai báo hằng số không thể gán lại trong JavaScript hiện đại?
A. var
B. let
C. const
D. static
Đáp án: C

Câu 5: Giao thức bảo mật mã hóa SSL/TLS truyền tải web an toàn có tên viết tắt là:
A. HTTP
B. FTP
C. HTTPS
D. SMTP
Đáp án: C`,

  gen: `Câu 1: Kim loại nào có khả năng dẫn điện và dẫn nhiệt tốt nhất ở điều kiện thường?
A. Vàng (Au)
B. Đồng (Cu)
C. Bạc (Ag)
D. Nhôm (Al)
Đáp án: C

Câu 2: Hành tinh nào lớn nhất trong Hệ Mặt Trời của chúng ta?
A. Sao Hỏa
B. Sao Thổ
C. Sao Mộc
D. Sao Kim
Đáp án: C

Câu 3: Tác phẩm "Truyện Kiều" bất hủ của đại thi hào Nguyễn Du gồm bao nhiêu câu thơ lục bát?
A. 3.254 câu
B. 3.000 câu
C. 3.148 câu
D. 3.500 câu
Đáp án: A

Câu 4: Quốc gia nào có diện tích tự nhiên lớn nhất thế giới?
A. Canada
B. Trung Quốc
C. Hoa Kỳ
D. Liên bang Nga
Đáp án: D

Câu 5: Đỉnh núi Fansipan - nóc nhà Đông Dương có độ cao chính xác là bao nhiêu mét?
A. 3.143 m
B. 3.147 m
C. 3.150 m
D. 3.140 m
Đáp án: A`
};

function loadSample(key){
  const pasteTab = document.querySelector('[data-tab="paste"]');
  if (pasteTab) pasteTab.click();
  const textarea = $('pasteText') || $('pasteArea');
  if (textarea && SAMPLES[key]) {
    textarea.value = SAMPLES[key].trim();
    if ($('processBtn')) $('processBtn').click();
    toast('Đã nạp đề thi mẫu! Bạn có thể xem trước hoặc bấm bắt đầu làm bài.', 'info');
  }
}

if ($('sampleEngBtn')) $('sampleEngBtn').addEventListener('click', () => loadSample('eng'));
if ($('sampleWebBtn')) $('sampleWebBtn').addEventListener('click', () => loadSample('web'));
if ($('sampleGenBtn')) $('sampleGenBtn').addEventListener('click', () => loadSample('gen'));


/* ==================== REVIEW FILTERS & RETRY WRONG ==================== */
document.addEventListener('DOMContentLoaded', () => {
  const retryWrongBtn = $('retryWrongBtn');
  if (retryWrongBtn) {
    retryWrongBtn.addEventListener('click', () => {
      const wrongList = quiz.questions.filter((q, i) => {
        const a = quiz.answers[i];
        return a === -1 || a !== q.correctIndex;
      });

      if (!wrongList.length) {
        toast('🎉 Xuất sắc! Bạn không làm sai câu nào cả.', 'success');
        return;
      }

      $('scoreModal').classList.remove('open');
      startQuiz(wrongList);
      toast(`Đang làm lại ${wrongList.length} câu chưa đúng / bỏ qua!`, 'info');
    });
  }

  // Filter questions on review
  const rfBar = $('reviewFilterBar');
  const rfAll = $('rfAll');
  const rfWrong = $('rfWrong');
  const rfCorrect = $('rfCorrect');

  function setFilter(type) {
    [rfAll, rfWrong, rfCorrect].forEach(b => b && b.classList.remove('active'));
    if (type === 'all' && rfAll) rfAll.classList.add('active');
    if (type === 'wrong' && rfWrong) rfWrong.classList.add('active');
    if (type === 'correct' && rfCorrect) rfCorrect.classList.add('active');

    quiz.questions.forEach((q, i) => {
      const card = $('qcard-' + i);
      if (!card) return;
      const isCorrect = (quiz.answers[i] === q.correctIndex && q.correctIndex >= 0);
      if (type === 'all') {
        card.style.display = 'block';
      } else if (type === 'wrong') {
        card.style.display = !isCorrect ? 'block' : 'none';
      } else if (type === 'correct') {
        card.style.display = isCorrect ? 'block' : 'none';
      }
    });
  }

  if (rfAll) rfAll.onclick = () => setFilter('all');
  if (rfWrong) rfWrong.onclick = () => setFilter('wrong');
  if (rfCorrect) rfCorrect.onclick = () => setFilter('correct');
});

/* ==================== INIT ==================== */
tryRestoreSession();

window.addEventListener('beforeunload', () => {
  if (quiz.questions.length && !quiz.submitted) saveSession();
});

document.addEventListener('input', e => {
  if (e.target.matches('input[type=radio]') && quiz.questions.length) saveSessionDebounced();
});