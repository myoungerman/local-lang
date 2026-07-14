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

  // Take the words (which have been validated as words and converted to lowercase), check their progress, and make a map.
  for (const word of uniqueWords) {
    const progress = await window.api.getWordProgress(word);
    progressCache.set(word, progress?.familiarity ?? 0);
  }

  // Get list of compound words
  const compoundWords = await window.api.getCompoundWords();
  const compoundWordsInText = compoundWords.filter((el) => text.includes(el.word.toLowerCase()));

  // Parse individual words into strings of styled HTML spans
  const individualWordsHtml = parts.map((part) => {
    if (/^[A-Za-zÀ-ÖØ-öø-ÿœŒ’'-]+$/.test(part)) {
      const normalized = part.toLowerCase();
      const familiarityClass = getFamiliarityClass(progressCache.get(normalized));
      const className = ['word-token', familiarityClass].filter(Boolean).join(' ');
      return `<span class="${className}" data-word="${escapeHtml(normalized)}">${escapeHtml(part)}</span>`;
    }
    return escapeHtml(part);
    })
    //.join('');

  const spanRegex = new RegExp(`<span[^>]*data-word="([^"]*)"[^>]*>`); // Looks for a <span> tag and captures the value of its data-word attribute

  // Iterate over the compound words found in the text
  for (let i = 0; i < compoundWordsInText.length; i++) {
    const compoundWord = compoundWordsInText[i];
    const compoundParts = compoundWord.word.split(' '); // Ex. "je m'appelle" becomes "je" and "m'appelle"
    let partToMatch = 0; // 0 , 1
    let indicesOfCompoundWords = [];

    // Iterate over the individual words
    for (let j = 0; j < individualWordsHtml.length; j++) { 
      const individualWord = individualWordsHtml[j]; // ex. `<span class=".level_1" data-word="bonjour">Bonjour</span>`;
      // Check its data-word attribute to see if it matches the nth part of the compound word we're searching for.
      // Ex. Does the individual word "Je" match the substring "Je" of the compound word "Je m'appelle"?
      const match = spanRegex.exec(individualWord);
      const matchWordValue = match ? match[1] : null;

      //if (matchWordValue !== null) {
    console.log(`Comparing ${matchWordValue} with ${compoundParts[partToMatch]}, partToMatch: ${partToMatch}`);
      //}

      if (matchWordValue == compoundParts[partToMatch]) { 
        console.log(`Found match for substring ${compoundParts[partToMatch]} at index ${j}, word: ${matchWordValue}`);
        indicesOfCompoundWords.push(j);
        // If there are no more parts to match, we've found the entire compound word at index j of the individualWordsHtml array.
        if (partToMatch === compoundParts.length - 1) {
          // Get the familiarity level for the compound word
          const wordInDb = await window.api.getWordProgress(compoundWord.word);
          const familiarityClass = getFamiliarityClass(wordInDb.familiarity);
          // Wrap the first and last indices in a compound word span
          const firstSpanOfCompoundWord = individualWordsHtml[indicesOfCompoundWords[0]];
          individualWordsHtml[indicesOfCompoundWords[0]] = `<span class="compound-word word-token ${familiarityClass}" data-word="${escapeHtml(compoundWord.word)}">${firstSpanOfCompoundWord}`;
          individualWordsHtml[indicesOfCompoundWords[indicesOfCompoundWords.length - 1]] += `</span>`;
          break;
        }
        partToMatch++; // 0 -> 1 -> 2 etc

      } else {
        if (matchWordValue !== null) {
          // Empty the indices array and reset the part counter
          indicesOfCompoundWords = [];
          partToMatch = 0;
        }
      }
    }
  }

  return individualWordsHtml.join('');
  //return individualWordsHtml;
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
  const isCompound = word.includes(' ') ? 1 : 0;
  console.log(`Saving progress for word: ${word}, isCompound: ${isCompound}`);
  await window.api.saveWordProgress(word, familiarity, notes, isCompound);
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

// Lets you select compound words by highlighting them
lessonBodyDisplay.addEventListener('mouseup', (event) => {
  const startNode = document.getSelection().anchorNode;
  const endNode = document.getSelection().focusNode;
  const range = document.createRange();

  range.setStart(startNode, 0);
  range.setEndAfter(endNode);
  const rangeText = range.toString();
  openWordModal(rangeText);
});