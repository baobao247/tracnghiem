(function(){
'use strict';

/* ==================== DOM ==================== */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const LS = {
  dark: 'quiz_dark_v3',
  session: 'quiz_session_v3'
};

/* ==================== UTILS ==================== */
function toast(msg, type){
  const wrap = $('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  const icon = type === 'error' ? 'fa-triangle-exclamation' :
               type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
  el.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastIn .3s reverse forwards';
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function fmtTime(sec){
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function shuffleArray(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function idxToLetter(i){
  return String.fromCharCode(65 + i);
}
function letterToIdx(ch){
  return ch.charCodeAt(0) - 65;
}

/* ==================== THEME ==================== */
function applyTheme(dark){
  document.body.classList.toggle('dark', dark);
  $('themeIcon').className = dark ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem(LS.dark, dark ? '1' : '0');
}
const initialDark = localStorage.getItem(LS.dark) === '1';
applyTheme(initialDark);
$('themeBtn').addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('dark'));
});

/* ==================== INPUT TABS ==================== */
$$('.input-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.input-tab').forEach(t => t.classList.toggle('active', t === tab));
    const target = tab.dataset.tab;
    $('tabFile').classList.toggle('hidden', target !== 'file');
    $('tabPaste').classList.toggle('hidden', target !== 'paste');
  });
});

/* ==================== FILE / DROP ==================== */
const dropzone = $('dropzone');
const fileInput = $('fileInput');
const fileInfo = $('fileInfo');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (!/\.(docx|pdf)$/i.test(f.name)) return toast('Chỉ nhận file .docx hoặc .pdf', 'error');
  fileInput.files = e.dataTransfer.files;
  showFileInfo(f);
});
fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (f) showFileInfo(f);
});
function showFileInfo(f){
  fileInfo.innerHTML = `<i class="fas fa-file"></i> ${escapeHtml(f.name)} · ${(f.size/1024).toFixed(1)} KB`;
}
})();
