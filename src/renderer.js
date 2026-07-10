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
  console.log('Rendering lessons...');
  const lessons = await window.api.getAllLessons();
  const sortedLessons = [...lessons].sort((a, b) => {
    const aTime = new Date(a.last_opened || 0).getTime();
    const bTime = new Date(b.last_opened || 0).getTime();
    return bTime - aTime;
  });

  lessonList.innerHTML = sortedLessons.map(lesson => `<div id="${lesson.lesson_id}" class="lesson-item"><h3>${lesson.title}</h3></div>`).join('');
};

renderLessons();

const getLessonContent = async (lessonId) => {
  const lessonContent = await window.api.getLessonById(lessonId);

  if (lessonContent) {
    lessonTitleDisplay.textContent = lessonContent.title;
    lessonBodyDisplay.textContent = lessonContent.body_text;
  } else {
    showToast('Lesson not found.', true);
  }
};

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
    mainPage.hidden = true;
    lessonPage.hidden = false;
    const clickedAt = new Date().toISOString();
    updateLessonContent(lessonId, { last_opened: clickedAt });
    getLessonContent(lessonId);
  }

});