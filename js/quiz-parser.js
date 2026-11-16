/* ==================== LOAD PDF.JS WORKER ==================== */
if (window.pdfjsLib){
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

/* ==================== READ FILE ==================== */
async function readDocx(file){
  if (!window.mammoth) throw new Error('Thư viện đọc DOCX chưa tải xong. Vui lòng thử lại.');
  const ab = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: ab });
  return result.value || '';
}

async function readPdf(file, onProgress){
  if (!window.pdfjsLib) throw new Error('Thư viện đọc PDF chưa tải xong. Vui lòng thử lại.');
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let pageText = '';
    let lastY = null;
    for (const item of content.items){
      const y = item.transform ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2){
        pageText += '\n';
      }
      pageText += item.str;
      if (item.hasEOL) pageText += '\n';
      lastY = y;
    }
    text += pageText + '\n\n';
    if (onProgress) onProgress(i, pdf.numPages);
  }
  return text;
}

/* ============================================================
   ============ PARSER v3 — FIX TOÀN DIỆN =====================
   Hỗ trợ:
     - Câu X: / Câu X. / Câu X) / Question X: / X. / X)
     - Đáp án A-Z (không chỉ A-D)
     - *A. / * A. / *A) / * A)
     - Dòng riêng: "Đáp án: X" / "Answer: X" / "Đáp án. X" / "Đáp án - X"
     - Duplicate letter merge (E. Năm + *E. Năm → 1 option correct)
     - Câu hỏi dài có dấu chấm, ký tự đặc biệt, emoji
     - Mixed formats trong cùng file
   ============================================================ */

/* ---- Regex patterns ---- */
// Question starts
const RE_Q_CAU = /^(?:Câu|Question)\s+\d+\s*[:.)\]]?\s/i;
const RE_Q_NUM = /^\d+\s*[.):\]]\s*\S/;
// Strip question prefix
const RE_STRIP_CAU = /^(?:Câu|Question)\s+\d+\s*[:.)\]]?\s*/i;
const RE_STRIP_NUM = /^\d+\s*[.):\]]\s*/;
// Answer line: "Đáp án: X", "Answer: X", "Đáp án. X", "Đáp án - X", "Đáp án X"
const RE_ANSWER = /^(?:[Đđ]áp\s*án|Answer)\s*[:.=\-]?\s*([A-Z])\b/i;
// Option line: optional "*", optional space, letter A-Z, one of .):, then space(s), content
const RE_OPTION = /^(\*)?\s*([A-Z])\s*[.):]\s+(.+)$/;

/**
 * Parse toàn bộ đề
 */
function parseQuestions(rawText){
  if (!rawText || !rawText.trim()) return [];

  // 1. Normalize line endings + non-breaking space
  let text = rawText.replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');

  // 2. Insert newline before inline question starts
  //    Ví dụ: "...option D Câu 2: ..." → "...option D\nCâu 2: ..."
  text = text.replace(
    /([^\n])\s+(?=(?:Câu|Question)\s+\d+\s*[:.)\]]?(?=\s|$))/gi,
    '$1\n'
  );

  // 3. Split lines, trim, remove empty
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 4. Group into blocks — each block = 1 question (question text + option lines)
  const blocks = [];
  let cur = null;

  const isQStart = (line) => RE_Q_CAU.test(line) || RE_Q_NUM.test(line);
  const stripQMark = (line) => {
    let result = line.replace(RE_STRIP_CAU, '');
    // Only apply number strip if result is unchanged (i.e. no "Câu/Question" prefix found)
    if (result === line){
      result = line.replace(RE_STRIP_NUM, '');
    }
    return result;
  };

  for (const line of lines){
    if (isQStart(line)){
      if (cur) blocks.push(cur);
      cur = [stripQMark(line)];
    } else if (cur){
      cur.push(line);
    }
    // Lines before the first question are ignored
  }
  if (cur) blocks.push(cur);

  // 5. Parse each block
  const questions = [];
  for (const blockLines of blocks){
    const q = parseBlock(blockLines);
    if (q && q.options.length >= 2) questions.push(q);
  }
  return questions;
}

/**
 * Parse 1 block (question + options + answer line)
 */
function parseBlock(lines){
  if (!lines.length) return null;

  // Step 1: Split any line that combines question + first option
  //   Ví dụ: "What is X? A. Option1" → ["What is X?", "A. Option1"]
  //   Chỉ split nếu option mới bắt đầu bằng A (option đầu tiên)
  const expanded = [];
  for (const line of lines){
    const splitMatch = line.match(/^([\s\S]{3,}?)\s+((?:\*)?\s*A\s*[.):]\s+[\s\S]+)$/);
    if (splitMatch && splitMatch[1].trim()){
      expanded.push(splitMatch[1].trim());
      expanded.push(splitMatch[2].trim());
    } else {
      expanded.push(line);
    }
  }

  // Step 2: Classify lines into question text / options / answer letter
  const questionParts = [];
  const options = []; // [{ letter, content, isCorrect }]
  let correctLetterFromAnswer = null;

  for (const line of expanded){
    // 2a. Answer line: "Đáp án: X" / "Answer: X"
    const am = line.match(RE_ANSWER);
    if (am){
      correctLetterFromAnswer = am[1].toUpperCase();
      continue;
    }

    // 2b. Option line: "*A. content" / "A. content" / "* B) content"
    const om = line.match(RE_OPTION);
    if (om){
      const isCorrect = !!om[1];
      const letter = om[2].toUpperCase();
      const content = om[3].trim();

      // Merge if duplicate letter (e.g. "E. Năm" followed by "*E. Năm")
      const existingIdx = options.findIndex(o => o.letter === letter);
      if (existingIdx >= 0){
        if (isCorrect) options[existingIdx].isCorrect = true;
        // Keep the longer content (in case of splits)
        if (content.length > options[existingIdx].content.length){
          options[existingIdx].content = content;
        }
      } else {
        options.push({ letter, content, isCorrect });
      }
      continue;
    }

    // 2c. Otherwise: question text
    questionParts.push(line);
  }

  if (options.length < 2) return null;

  // Step 3: Sort options by letter (A → Z)
  options.sort((a, b) => a.letter.charCodeAt(0) - b.letter.charCodeAt(0));

  // Step 4: Determine correct index
  let correctIndex = options.findIndex(o => o.isCorrect);
  if (correctIndex === -1 && correctLetterFromAnswer){
    correctIndex = options.findIndex(o => o.letter === correctLetterFromAnswer);
  }

  // Step 5: Build question object
  const qText = questionParts.join(' ').replace(/\s+/g, ' ').trim();

  return {
    questionText: qText || '(Không có nội dung)',
    options: options.map(o => o.content),
    letters: options.map(o => o.letter),   // giữ lại để debug
    correctIndex
  };
}

/* ==================== PROCESS ==================== */
$('processBtn').addEventListener('click', async () => {
  const activeTab = document.querySelector('.input-tab.active').dataset.tab;
  let rawText = '';
  const status = $('statusMsg');
  const progress = $('progressBar');
  const progressFill = $('progressFill');
  const btn = $('processBtn');

  btn.disabled = true;
  progress.classList.remove('hidden');
  progressFill.style.width = '0%';

  try {
    if (activeTab === 'file'){
      const f = fileInput.files[0];
      if (!f){ throw new Error('Vui lòng chọn file trước'); }
      status.className = 'status-msg';
      status.textContent = '⏳ Đang đọc file...';
      if (/\.docx$/i.test(f.name)){
        rawText = await readDocx(f);
        progressFill.style.width = '60%';
      } else {
        rawText = await readPdf(f, (i, total) => {
          const pct = Math.round((i / total) * 60);
          progressFill.style.width = pct + '%';
          status.textContent = `⏳ Đang đọc trang ${i}/${total}...`;
        });
      }
    } else {
      rawText = $('pasteArea').value;
      if (!rawText.trim()) throw new Error('Vui lòng dán nội dung đề thi');
      progressFill.style.width = '60%';
    }

    status.textContent = '🔍 Đang phân tích câu hỏi...';
    progressFill.style.width = '80%';

    const questions = parseQuestions(rawText);
    if (!questions.length){
      throw new Error('Không tìm thấy câu hỏi nào. Kiểm tra lại định dạng (xem Hướng dẫn).');
    }

    showPreview(questions);

    const invalidCount = questions.filter(q => q.correctIndex === -1).length;
    status.className = 'status-msg success';
    if (invalidCount > 0){
      status.className = 'status-msg error';
      status.textContent = `⚠️ Đã tìm thấy ${questions.length} câu, nhưng có ${invalidCount} câu thiếu đáp án đúng. Kiểm tra lại file.`;
    } else {
      status.textContent = `✅ Đã tìm thấy ${questions.length} câu hỏi. Bấm "Bắt đầu làm bài" bên dưới.`;
    }
    progressFill.style.width = '100%';

    // Hiện nút bắt đầu
    let startBtn = $('startQuizBtn');
    if (!startBtn){
      startBtn = document.createElement('button');
      startBtn.id = 'startQuizBtn';
      startBtn.className = 'btn btn-success btn-lg btn-cta';
      startBtn.style.marginTop = '12px';
      startBtn.innerHTML = '<i class="fas fa-play"></i> Bắt đầu làm bài';
      $('previewBox').after(startBtn);
      startBtn.addEventListener('click', () => startQuiz(questions));
    }

    setTimeout(() => {
      progress.classList.add('hidden');
      progressFill.style.width = '0%';
    }, 600);

  } catch (err){
    status.className = 'status-msg error';
    status.textContent = `❌ ${err.message}`;
    progressFill.style.width = '0%';
    setTimeout(() => progress.classList.add('hidden'), 300);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

/* ==================== PREVIEW ==================== */
function showPreview(questions){
  const box = $('previewBox');
  box.classList.remove('hidden');

  const noAnswer = questions.filter(q => q.correctIndex === -1).length;
  const stats = $('previewStats');
  stats.innerHTML = `
    <span class="s"><i class="fas fa-circle-check"></i> ${questions.length} câu hỏi</span>
    ${noAnswer ? `<span class="s warn"><i class="fas fa-triangle-exclamation"></i> ${noAnswer} câu thiếu đáp án</span>` : ''}
  `;

  const list = $('previewList');
  list.innerHTML = questions.slice(0, 50).map((q, i) => {
    const warn = q.correctIndex === -1;
    const preview = q.questionText.length > 80
      ? q.questionText.slice(0, 80) + '…'
      : q.questionText;
    return `<div class="item ${warn ? 'warn' : ''}">Câu ${i+1}: ${escapeHtml(preview)}</div>`;
  }).join('') + (questions.length > 50 ? `<div class="item">… và ${questions.length - 50} câu khác</div>` : '');
}

