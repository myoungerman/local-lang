import './index.css';

const lessonBody = document.getElementById('lesson-body');
const addLessonButton = document.getElementById('add-lesson-btn');
const lessonList = document.getElementById('lesson-list');
const lessonTitle = document.getElementById('lesson-title');
const testButton = document.getElementById('test-btn');
const mainPage = document.getElementById('main-page');
const testPage = document.getElementById('test-page');
const backButton = document.getElementById('back-btn');

const showToast = (message, isError = false) => {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.top = '12px';
  toast.style.right = '12px';
  toast.style.padding = '8px 12px';
  toast.style.background = isError ? '#b91c1c' : '#2563eb';
  toast.style.color = 'white';
  toast.style.zIndex = '1000';
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

testButton.addEventListener('click', () => {
  mainPage.hidden = true;
  testPage.hidden = false;
});

backButton.addEventListener('click', () => {
  testPage.hidden = true;
  mainPage.hidden = false;
});

const renderLessons = async () => {
  const lessons = await window.api.getAllLessons();
  lessonList.innerHTML = lessons.map(lesson => `<div id="${lesson.lesson_id}" class="lesson-item"><h3>${lesson.title}</h3></div>`).join('');
};

renderLessons();

lessonList.addEventListener('click', (event) => {
  const lessonItem = event.target.closest('.lesson-item');

  if (!lessonItem) {
    return;
  }

  const lessonId = lessonItem.id;
  if (lessonId) {
    showToast(`Selected lesson ${lessonId}`);
  }
});