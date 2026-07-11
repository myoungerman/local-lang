import './index.css';

const lessonBodyInput = document.getElementById('lesson-body-input');
const addLessonButton = document.getElementById('add-lesson-btn');
const lessonList = document.getElementById('lesson-list');
const lessonTitleInput = document.getElementById('lesson-title-input');
const lessonTitleDisplay = document.getElementById('lesson-title-display');
const lessonBodyDisplay = document.getElementById('lesson-body-display');
const mainPage = document.getElementById('main-page');
const lessonPage = document.getElementById('lesson-page');
const backButton = document.getElementById('back-btn');
const wordModal = document.getElementById('word-modal');
const wordModalCloseButton = document.getElementById('word-modal-close');
const wordModalTitle = document.getElementById('word-modal-title');
const wordModalDefinition = document.getElementById('word-modal-definition');
const wordModalFamiliarity = document.getElementById('word-modal-familiarity');
const wordModalNotes = document.getElementById('word-modal-notes');
const wordModalSaveButton = document.getElementById('word-modal-save');

let currentLessonId = null;

const showToast = (message, isError = false) => {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.classList.add('toast');
  toast.style.background = isError ? '#b91c1c' : '#2563eb';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
};

const handleAddLesson = async () => {
  const title = lessonTitleInput.value.trim();
  const lesson = lessonBodyInput.value.trim();
  if (title && lesson) {
    await window.api.addLesson(title, lesson);
    lessonTitleInput.value = '';
    lessonBodyInput.value = '';
    showToast('Lesson added successfully.');
    renderLessons();
  } else {
    showToast('Please fill in both the title and lesson fields.', true);
  }
};

addLessonButton.addEventListener('click', handleAddLesson);

backButton.addEventListener('click', () => {
  lessonPage.hidden = true;
  mainPage.hidden = false;
  renderLessons();
});

const renderLessons = async () => {
  const lessons = await window.api.getAllLessons();
  const sortedLessons = [...lessons].sort((a, b) => {
    const aTime = new Date(a.last_opened || 0).getTime();
    const bTime = new Date(b.last_opened || 0).getTime();
    return bTime - aTime;
  });

  lessonList.innerHTML = sortedLessons.map(lesson => `<div id="${lesson.lesson_id}" class="lesson-item"><h3>${lesson.title}</h3></div>`).join('');
};

renderLessons();

const escapeHtml = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const getFamiliarityClass = (familiarity) => {
  const value = Number(familiarity);
  if (value === 1) return 'familiarity-1';
  if (value === 2) return 'familiarity-2';
  if (value === 3) return 'familiarity-3';
  if (value === 4) return 'familiarity-4';
  return '';
};

const renderLessonBody = async (text) => {
  const parts = text.split(/([A-Za-zÀ-ÖØ-öø-ÿœŒ’'-]+)/g);
  const progressCache = new Map();
  const wordTokens = parts.filter((part) => /^[A-Za-zÀ-ÖØ-öø-ÿœŒ’'-]+$/.test(part));
  const uniqueWords = [...new Set(wordTokens.map((word) => word.toLowerCase()))];

  for (const word of uniqueWords) {
    const progress = await window.api.getWordProgress(word);
    progressCache.set(word, progress?.familiarity ?? 0);
  }

  return parts
    .map((part) => {
      if (/^[A-Za-zÀ-ÖØ-öø-ÿœŒ’'-]+$/.test(part)) {
        const normalized = part.toLowerCase();
        const familiarityClass = getFamiliarityClass(progressCache.get(normalized));
        const className = ['word-token', familiarityClass].filter(Boolean).join(' ');
        return `<span class="${className}" data-word="${escapeHtml(normalized)}">${escapeHtml(part)}</span>`;
      }
      return escapeHtml(part);
    })
    .join('');
};

const getLessonContent = async (lessonId) => {
  const lessonContent = await window.api.getLessonById(lessonId);

  if (lessonContent) {
    lessonTitleDisplay.textContent = lessonContent.title;
    lessonBodyDisplay.innerHTML = await renderLessonBody(lessonContent.body_text);
  } else {
    showToast('Lesson not found.', true);
  }
};

const openWordModal = async (word) => {
  const [translation, progress] = await Promise.all([
    window.api.getTranslationForWord(word),
    window.api.getWordProgress(word),
  ]);

  wordModalTitle.textContent = word;

  if (translation) {
    wordModalDefinition.innerHTML = `
      <div><strong>Definition:</strong> ${escapeHtml(translation.trans_list || '')}</div>
    `;
  } else {
    wordModalDefinition.innerHTML = `<div>No dictionary entry found for this word.</div>`;
  }

  wordModalFamiliarity.value = progress?.familiarity ?? 1;
  wordModalNotes.value = progress?.notes ?? '';
  wordModal.dataset.currentWord = word;
  wordModal.classList.remove('hidden');
};

const closeWordModal = () => {
  wordModal.classList.add('hidden');
  wordModal.dataset.currentWord = '';
};

const saveWordProgress = async () => {
  const word = wordModal.dataset.currentWord;
  if (!word) return;

  const familiarity = parseInt(wordModalFamiliarity.value, 10) || 1;
  const notes = wordModalNotes.value.trim();
  await window.api.saveWordProgress(word, familiarity, notes);
  showToast('Word details saved.');
  closeWordModal();

  if (currentLessonId) {
    await getLessonContent(currentLessonId);
  }
};

wordModalCloseButton.addEventListener('click', closeWordModal);
wordModal.addEventListener('click', (event) => {
  if (event.target === wordModal) {
    closeWordModal();
  }
});
wordModalSaveButton.addEventListener('click', saveWordProgress);

lessonBodyDisplay.addEventListener('click', (event) => {
  const wordToken = event.target.closest('.word-token');
  if (!wordToken) return;
  const word = wordToken.dataset.word;
  if (word) {
    openWordModal(word);
  }
});

const updateLessonContent = async (lessonId, updates) => {
  await window.api.updateLesson(lessonId, updates);
};

lessonList.addEventListener('click', (event) => {
  const lessonItem = event.target.closest('.lesson-item');

  if (!lessonItem) {
    return;
  }

  const lessonId = lessonItem.id;
  if (lessonId) {
    showToast(`Selected lesson ${lessonId}`);
    currentLessonId = lessonId;
    mainPage.hidden = true;
    lessonPage.hidden = false;
    const clickedAt = new Date().toISOString();
    updateLessonContent(lessonId, { last_opened: clickedAt });
    getLessonContent(lessonId);
  }
});

lessonBodyDisplay.addEventListener('mouseup', (event) => {
  const startNode = document.getSelection().anchorNode;
  const endNode = document.getSelection().focusNode;
  const range = document.createRange();

  range.setStart(startNode, 0);
  range.setEndAfter(endNode);

  console.log(`Start node: ${startNode.nodeValue}`);
  console.log(`End node: ${endNode.nodeValue}`);
  console.log(`Range text: ${range.toString()}`)
});