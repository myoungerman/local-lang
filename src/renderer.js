import './index.css';
import "./assets/fonts/Inter-VariableFont_opsz,wght.ttf";
import path from 'node:path';

const lessonBodyInput = document.getElementById('lesson-body-input');
const addLessonButton = document.getElementById('add-lesson-btn');
const lessonList = document.getElementById('lesson-list');
const lessonTitleInput = document.getElementById('lesson-title-input');
const lessonTitleDisplay = document.getElementById('lesson-title-display');
const lessonBodyDisplay = document.getElementById('lesson-body-display');
const lessonModal = document.getElementById('lesson-modal');
const importModal = document.getElementById('import-modal');
const downloadModal = document.getElementById('download-modal');
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
const downloadTranslationModelButton = document.getElementById('download-translation-model-btn');
const downloadPronunciationModelButton = document.getElementById('download-pronunciation-model-btn');
const status = document.getElementById('status');
const libraryToolbarButton = document.getElementById('library-toolbar-btn');
const aiModelsToolbarButton = document.getElementById('ai-models-toolbar-btn');
const ttsModelCard = document.getElementById('tts-model-card');
const translationModelCard = document.getElementById('translation-model-card');

let currentLessonId = null;
let checkedForTranslationModel = false;
let translationModelInstalled = false;
let checkedForTtsModel = false;
let ttsModelInstalled = false;
let prevX;
let prevY;
let blockClick = false;

status.textContent = 'Status: Starting download.';

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
  lessonModal.hidden = false;
  renderLessons();
});

libraryToolbarButton.addEventListener('click', () => {
  lessonPage.hidden = true;
  downloadModal.hidden = true;
  importModal.hidden = true;
  lessonModal.hidden = false;
  renderLessons();
});

aiModelsToolbarButton.addEventListener('click', async () => {
  lessonPage.hidden = true;
  lessonModal.hidden = true;
  importModal.hidden = true;

  if (!checkedForTranslationModel) {
    translationModelInstalled = await window.api.checkTranslationModelExists();
    checkedForTranslationModel = true;
  }

  if (!checkedForTtsModel) {
    ttsModelInstalled = await window.api.checkTtsModelExists();
    checkedForTtsModel = true;
  }

  // Update the UI for already installed models.
  if (ttsModelInstalled) {
    ttsModelCard.querySelector('.installation-status').hidden = false;
    const ttsButton = ttsModelCard.querySelector('button');
    if (ttsButton) ttsButton.disabled = true;
  }
  if (translationModelInstalled) {
    translationModelCard.querySelector('.installation-status').hidden = false;
    const translationButton = translationModelCard.querySelector('button');
    if (translationButton) translationButton.disabled = true;
  }

  downloadModal.hidden = false;
});

const renderLessons = async () => {
  const lessons = await window.api.getAllLessons();
  const sortedLessons = [...lessons].sort((a, b) => {
    const aTime = new Date(a.last_opened || 0).getTime();
    const bTime = new Date(b.last_opened || 0).getTime();
    return bTime - aTime;
  });

  lessonList.innerHTML = sortedLessons.map(lesson => 
    `<div id="${lesson.lesson_id}" class="lesson-item">
    <h3>${lesson.title}</h3>
    <button data-action="edit">Edit lesson</button>
    <button data-action="delete">Delete lesson</button>
    </div>`
  ).join('');
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
  if (value === 5) return 'familiarity-5';
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
  const normalizedText = text.toLowerCase();
  const compoundWordsInText = compoundWords.filter((el) => normalizedText.includes(el.word.toLowerCase()));

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
      // The data-word attribute is already escaped when it was inserted into the HTML, so
      // re-escaping it here would turn entities like &#39; into &amp;#39;.
      const matchWordValue = match ? match[1] : null;
      const escapedPartToMatch = escapeHtml(compoundParts[partToMatch]);

      // Runs when there's a match with part of the compound word we're searching for.
      if (matchWordValue == escapedPartToMatch) { 
        indicesOfCompoundWords.push(j);
        // If there are no more substrings to match, then we've found the entire compound word at index j of the individualWordsHtml array.
        if (partToMatch === compoundParts.length - 1) {
          // Get the familiarity level for the compound word
          const wordInDb = await window.api.getWordProgress(compoundWord.word);
          const familiarityClass = getFamiliarityClass(wordInDb.familiarity);
          // Wrap the first and last indices in a compound word span
          const firstSpanOfCompoundWord = individualWordsHtml[indicesOfCompoundWords[0]];
          individualWordsHtml[indicesOfCompoundWords[0]] = `<span class="compound-word word-token ${familiarityClass}" data-word="${escapeHtml(compoundWord.word)}">${firstSpanOfCompoundWord}`;
          individualWordsHtml[indicesOfCompoundWords[indicesOfCompoundWords.length - 1]] += `</span>`;

          // Reset the part of the word that we're looking for and empty the indices array
          partToMatch = 0;
          indicesOfCompoundWords = [];

          // If we've searched the entire array of individual words, then there are no more possible instances of the current compound word, so continue to the next compound word.
          if (j == individualWordsHtml.length - 1) {
            break;
          }
        }
        partToMatch++;
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
  // If the translation definition exists in either table, display that. Otherwise translate using the LLM.
  const definition = translation?.trans_list ?? translation?.definition;
  if (definition) {
    wordModalDefinition.innerHTML = `
    <div><strong>Definition:</strong> ${definition}</div>
    `;
  } else if (translationModelInstalled) {
    try {
      wordModalDefinition.innerHTML = `<div>Translating...</div>`;
      const translation = await window.api.translateText(word);
      wordModalDefinition.innerHTML = `<div>${translation}</div>`;
    } catch (error) {
      showToast('Translation failed. Check console for details.', true);
    }
  } else {
    wordModalDefinition.innerHTML = `<div>No dictionary entry found for this word.</div>`;
  }

  wordModalFamiliarity.value = progress?.familiarity ?? 1;
  wordModalNotes.value = progress?.notes ?? '';
  wordModal.dataset.currentWord = word;
  wordModal.classList.remove('hidden');
};

const closeWordModal = () => {
  wordModal.dataset.currentWord = '';
  wordModal.classList.add('hidden');
};

const saveWordProgress = async () => {
  const word = wordModal.dataset.currentWord.toLowerCase();
  if (!word) return;

  const definition = wordModalDefinition.textContent
    .replace(/^Definition:\s*/, '')
    .trim();
  const familiarity = parseInt(wordModalFamiliarity.value, 10) || 1;
  const notes = wordModalNotes.value.trim();
  const isCompound = word.includes(' ') ? 1 : 0;
  await window.api.saveWordProgress(word, definition, familiarity, notes, isCompound);
  showToast('Word details saved.');

  if (currentLessonId) {
    await getLessonContent(currentLessonId);
  }
};

wordModalCloseButton.addEventListener('click', () => {
  saveWordProgress();
  closeWordModal();
});

// Open the word modal when an individual word is clicked.
lessonBodyDisplay.addEventListener('click', (event) => {
  if (!blockClick) {
    const wordToken = event.target.closest('.word-token');
    if (!wordToken) return;
    const word = wordToken.dataset.word;
    if (word) {
      openWordModal(word);
    }
  }
});

const updateLessonContent = async (lessonId, updates) => {
  await window.api.updateLesson(lessonId, updates);
};

// Load the clicked lesson.
lessonList.addEventListener('click', async (event) => {
  const lessonItem = event.target.closest('.lesson-item');
  // There's another listener for each div in the list that handles when the user clicks the delete or edit buttons.
  // But clicking those buttons still triggers this listener, which we don't want. 
  const wasButton = event.target instanceof HTMLButtonElement;
  if (!lessonItem || wasButton) {
    return;
  }

  const lessonId = lessonItem.id;
  if (lessonId) {
    currentLessonId = lessonId;
    lessonModal.hidden = true;
    importModal.hidden = true;
    lessonPage.hidden = false;
    const clickedAt = new Date().toISOString();
    updateLessonContent(lessonId, { last_opened: clickedAt });
    getLessonContent(lessonId);

    if (!checkedForTranslationModel) {
      translationModelInstalled = await window.api.checkTranslationModelExists();
      checkedForTranslationModel = true;
    }
  }
});

lessonBodyDisplay.addEventListener('mousedown', (e) => {
  prevX = e.clientX;
  prevY = e.clientY;
});

// Lets you select more than one word by clicking and dragging over the words that should be translated. 
lessonBodyDisplay.addEventListener('mouseup', (e) => {
  // If the mouse position has changed since mousedown, the user is selecting multiple words, so stop
  // the default click event from firing since that's only used for individual words.
  if (e.clientX !== prevX || e.clientY !== prevY) {
    blockClick = true;
    const startNode = document.getSelection().anchorNode;
    const endNode = document.getSelection().focusNode;
    const range = document.createRange();

    range.setStart(startNode, 0);
    range.setEndAfter(endNode);
    const rangeText = range.toString().trim();
    openWordModal(rangeText);
  } else {
    blockClick = false;
  }
});

downloadTranslationModelButton.addEventListener('click', async () => {
  try {
    const result = await window.api.downloadTranslationModel();
    showToast('Translation model downloaded successfully.');
  } catch (error) {
    showToast('Translation model download failed. Check console for details.', true);}
});

lessonList.addEventListener('click', async (e) => {
  try {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const lessonDiv = button.closest('.lesson-item');
    const lessonId = lessonDiv.id;
    const action = button.dataset.action;
    
    if (action.toString() == 'delete') {
      await window.api.deleteLesson(lessonId);
      renderLessons();
    }
  } catch (error) {
    console.log(`Error: ${error}`);
  }
});

lessonPage.addEventListener('click', (e) => {
  // If the word modal is visible and the user clicked anything that's not a span, close the modal.
  // Note: The modal should remain visible if they click a span because the new word will use the modal anyhow.
  const wordModalIsVisible = !wordModal.classList.contains('hidden');
  const tagName = e.target.tagName.toUpperCase();
  console.log(`clicked ${tagName}`);
  if (wordModalIsVisible && tagName !== 'SPAN') {
    saveWordProgress();
    closeWordModal();
  }
  if (wordModalIsVisible && tagName === 'SPAN') {
    saveWordProgress();
  }
}, {capture: true});