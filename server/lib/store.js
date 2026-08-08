// Tiny file-based JSON store. Good enough to start with — swap for a real DB later
// without changing the routes, since everything goes through these functions.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const ANSWERS_FILE = path.join(DATA_DIR, 'answers.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

function ensureFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJSON(filePath) {
  ensureFile(filePath, []);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw || '[]');
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function nextId(items) {
  return items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
}

// ---- Questions ----

function getQuestions() {
  return readJSON(QUESTIONS_FILE);
}

function addQuestion({ text, category, idealAnswer, difficulty }) {
  const questions = getQuestions();
  const question = {
    id: nextId(questions),
    text,
    category: category || 'General',
    idealAnswer: idealAnswer || '',
    difficulty: difficulty || 'medium',
    createdAt: new Date().toISOString(),
  };
  questions.push(question);
  writeJSON(QUESTIONS_FILE, questions);
  return question;
}

function deleteQuestion(id) {
  const questions = getQuestions().filter((q) => q.id !== Number(id));
  writeJSON(QUESTIONS_FILE, questions);
}

// ---- Answers ----

function getAnswers() {
  return readJSON(ANSWERS_FILE);
}

function getAnswerById(id) {
  return getAnswers().find((a) => a.id === Number(id));
}

function addAnswer({ questionId, candidateName, answerText }) {
  const answers = getAnswers();
  const answer = {
    id: nextId(answers),
    questionId: Number(questionId),
    candidateName: candidateName || 'Anonymous',
    answerText,
    aiScore: null,
    aiFeedback: null,
    adminScore: null,
    adminNotes: null,
    status: 'pending', // pending -> ai_scored -> reviewed
    submittedAt: new Date().toISOString(),
  };
  answers.push(answer);
  writeJSON(ANSWERS_FILE, answers);
  return answer;
}

function updateAnswer(id, updates) {
  const answers = getAnswers();
  const idx = answers.findIndex((a) => a.id === Number(id));
  if (idx === -1) return null;
  answers[idx] = { ...answers[idx], ...updates };
  writeJSON(ANSWERS_FILE, answers);
  return answers[idx];
}

// ---- Applications ----

function getApplications() {
  return readJSON(APPLICATIONS_FILE);
}

function getApplicationById(id) {
  return getApplications().find((a) => a.id === Number(id));
}

function getApplicationByInterviewId(interviewId) {
  return getApplications().find((a) => a.interviewId === interviewId);
}

function addApplication({ name, lastName, email, phone, city, gender, type, subject, resumeText, resumeUrl }) {
  const applications = getApplications();
  const application = {
    id: nextId(applications),
    name,
    lastName: lastName || '',
    email,
    phone: phone || '',
    city: city || '',
    gender: gender || '',
    type: type || '',
    subject,
    resumeText: resumeText || '',
    resumeUrl: resumeUrl || null,
    status: 'pending', // pending, approved, rejected
    interviewId: null,
    submittedAt: new Date().toISOString(),
  };
  applications.push(application);
  writeJSON(APPLICATIONS_FILE, applications);
  return application;
}

function updateApplication(id, updates) {
  const applications = getApplications();
  const idx = applications.findIndex((a) => a.id === Number(id));
  if (idx === -1) return null;
  applications[idx] = { ...applications[idx], ...updates };
  writeJSON(APPLICATIONS_FILE, applications);
  return applications[idx];
}

module.exports = {
  getQuestions,
  addQuestion,
  deleteQuestion,
  getAnswers,
  getAnswerById,
  addAnswer,
  updateAnswer,
  getApplications,
  getApplicationById,
  getApplicationByInterviewId,
  addApplication,
  updateApplication,
};
