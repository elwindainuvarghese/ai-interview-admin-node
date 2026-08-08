require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

const store = require('./lib/store');
const { scoreAnswer } = require('./lib/aiScore');
const { login, logout, requireAuth } = require('./lib/auth');

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// Serve uploads directory statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// WebSocket Telemetry Handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // When candidate frontend sends a video frame or telemetry
  socket.on('telemetry_update', (data) => {
    // Expected data: { frameBase64, attentionScore, phoneDetected, gazeLabel }
    
    // Broadcast the telemetry down to any connected Admin panels
    io.emit('admin_feed_update', data);
    
    // Auto-kill logic has been removed to allow the client-side strike system 
    // to handle warnings and terminations gracefully.
  });

  // Manual kill from admin dashboard
  socket.on('manual_kill', () => {
    console.log('[MANUAL-KILL TRIGGERED by Admin]');
    io.emit('kill_interview', { reason: "Interview manually terminated by Proctor." });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


// Serve the login page, admin page, and static assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Auth ----------

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const token = login(email, password);
    if (!token) return res.status(401).json({ error: 'Incorrect email or password.' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) logout(token);
  res.status(204).end();
});

// Public: distinct categories in the question bank, used to populate the
// category picker on the login page (not sensitive, so no auth required).
app.get('/api/categories', (req, res) => {
  const categories = [...new Set(store.getQuestions().map((q) => q.category))].sort();
  res.json(categories);
});

// Public: Submit an application
app.post('/api/applications', upload.single('resumeFile'), (req, res) => {
  const { name, lastName, email, phone, city, gender, type, subject } = req.body;

  if (!name || !email || !subject) {
    return res.status(400).json({ error: 'Name, email, and subject are required.' });
  }

  const resumeUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const appData = store.addApplication({ 
    name, lastName, email, phone, city, gender, type, subject, resumeUrl 
  });
  res.status(201).json(appData);
});

// Public: Validate an interview ID and get subject
app.get('/api/interviews/:id', (req, res) => {
  const application = store.getApplicationByInterviewId(req.params.id);
  if (!application) return res.status(404).json({ error: 'Invalid interview ID.' });
  if (application.status === 'completed') return res.status(403).json({ error: 'This Interview ID has already been used and is completed.' });
  res.json({ subject: application.subject, name: application.name });
});

// Allow public access to GET /api/questions so candidate frontend can fetch them
app.use('/api/questions', (req, res, next) => {
  if (req.method === 'GET') return next();
  return requireAuth(req, res, next);
});
app.use('/api/answers', requireAuth);
app.use('/api/applications', (req, res, next) => {
  // Public routes for applications
  if (req.method === 'POST' && req.url === '/') return next(); // creation
  if (req.method === 'GET' && req.url.match(/^\/[^/]+$/)) return next(); // get by id (if handled above)
  if (req.method === 'POST' && req.url.includes('/results')) return next(); // post results from frontend
  
  if (req.method === 'GET' || req.method === 'POST' && req.url.includes('/approve')) {
    return requireAuth(req, res, next);
  }
  next();
});

// ---------- Applications (Admin) ----------

app.get('/api/applications', (req, res) => {
  res.json(store.getApplications());
});

app.get('/api/applications/:id', (req, res) => {
  const application = store.getApplicationById(req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found.' });
  res.json(application);
});

app.post('/api/applications/:id/approve', (req, res) => {
  const application = store.getApplicationById(req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found.' });
  
  if (application.status === 'approved' && application.interviewId) {
    return res.json(application);
  }

  // Generate a random 6-character ID (e.g. JS-A1B2C3)
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const prefix = application.subject.substring(0, 2).toUpperCase();
  const interviewId = `${prefix}-${code}`;

  const updated = store.updateApplication(application.id, {
    status: 'approved',
    interviewId,
  });

  res.json(updated);
});

// Candidate: submit final interview results (AI score and feedback)
app.post('/api/applications/:id/results', (req, res) => {
  const application = store.getApplicationByInterviewId(req.params.id);
  if (!application) return res.status(404).json({ error: 'Invalid interview ID.' });

  const { overallScore, feedback, transcript, passed } = req.body;
  
  const updated = store.updateApplication(application.id, {
    finalScore: overallScore,
    feedback: feedback,
    transcript: transcript,
    passed: passed,
    status: 'completed'
  });

  // Send email unconditionally
  const { sendResultEmail } = require('./lib/email');
  sendResultEmail(updated.email, updated.name, overallScore, passed);

  res.json(updated);
});

// ---------- Questions ----------

app.get('/api/questions', (req, res) => {
  res.json(store.getQuestions());
});

app.post('/api/questions', (req, res) => {
  const { text, category, idealAnswer, difficulty } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Question text is required.' });
  }
  const question = store.addQuestion({ text: text.trim(), category, idealAnswer, difficulty });
  res.status(201).json(question);
});

app.delete('/api/questions/:id', (req, res) => {
  store.deleteQuestion(req.params.id);
  res.status(204).end();
});

// ---------- Answers ----------

// Candidate-facing endpoint (for whenever the interview side sends answers in)
app.post('/api/answers', (req, res) => {
  const { questionId, candidateName, answerText } = req.body;
  if (!questionId || !answerText) {
    return res.status(400).json({ error: 'questionId and answerText are required.' });
  }
  const answer = store.addAnswer({ questionId, candidateName, answerText });
  res.status(201).json(answer);
});

// Admin: list all answers, with their linked question attached
app.get('/api/answers', (req, res) => {
  const questions = store.getQuestions();
  const answers = store.getAnswers().map((a) => ({
    ...a,
    question: questions.find((q) => q.id === a.questionId) || null,
  }));
  res.json(answers);
});

// Admin: trigger AI scoring for one answer
app.post('/api/answers/:id/score', async (req, res) => {
  const answer = store.getAnswerById(req.params.id);
  if (!answer) return res.status(404).json({ error: 'Answer not found.' });

  const question = store.getQuestions().find((q) => q.id === answer.questionId);
  if (!question) return res.status(400).json({ error: 'Linked question no longer exists.' });

  try {
    const result = await scoreAnswer({
      questionText: question.text,
      idealAnswer: question.idealAnswer,
      candidateAnswer: answer.answerText,
    });
    const updated = store.updateAnswer(answer.id, {
      aiScore: result.score,
      aiFeedback: result,
      status: 'ai_scored',
    });
    res.json(updated);
  } catch (err) {
    console.error('AI scoring failed:', err.message);
    res.status(500).json({ error: 'AI scoring failed. Check ANTHROPIC_API_KEY in .env.' });
  }
});

// Admin: submit final review (override/confirm score)
app.put('/api/answers/:id/review', (req, res) => {
  const { adminScore, adminNotes } = req.body;
  const updated = store.updateAnswer(req.params.id, {
    adminScore,
    adminNotes,
    status: 'reviewed',
  });
  if (!updated) return res.status(404).json({ error: 'Answer not found.' });
  res.json(updated);
});

server.listen(PORT, () => {
  console.log(`Interview Agent admin server running at http://localhost:${PORT}`);
});
