import './index.css';

const lessonBody = document.getElementById('lesson-body');
const addLessonButton = document.getElementById('add-lesson-btn');
const lessonList = document.getElementById('lesson-list');
const lessonTitle = document.getElementById('lesson-title');

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

const renderLessons = async () => {
  const lessons = await window.api.getAllLessons();
  lessonList.innerHTML = lessons.map(lesson => `<div><h3>${lesson.title}</h3></div>`).join('');
};

renderLessons();