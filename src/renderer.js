import './index.css';

const lessonBody = document.getElementById('lesson-body-field');
const addLessonButton = document.getElementById('add-lesson-btn');
const lessonList = document.getElementById('lesson-list');
const lessonTitle = document.getElementById('lesson-title-field');
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
  const title = lessonTitle.value.trim();
  const lesson = lessonBody.value.trim();
  if (title && lesson) {
    await window.api.addLesson(title, lesson);
    lessonTitle.value = '';
    lessonBody.value = '';
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
});

const renderLessons = async () => {
  console.log('Rendering lessons...');
  const lessons = await window.api.getAllLessons();
  lessonList.innerHTML = lessons.map(lesson => `<div id="${lesson.lesson_id}" class="lesson-item"><h3>${lesson.title}</h3></div>`).join('');
};

renderLessons();

const getLessonContent = async (lessonId) => {
  const lessonContent = await window.api.getLessonById(lessonId);

  if (lessonContent) {
    lessonTitle.textContent = lessonContent.title;
    lessonBody.textContent = lessonContent.body_text;
  } else {
    showToast('Lesson not found.', true);
  }
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
    getLessonContent(lessonId);
  }

  /*
  In the database, look up the given lesson ID and then display its title and body text in the "lesson-title" and "lesson-body" elements.
  To do this, I need a new method in the database, the preload, and the ipcHandlers.
  */


});