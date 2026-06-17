'use strict';

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Storage: MongoDB in production (persistent), local JSON file otherwise ────
// If MONGODB_URI is set (e.g. on Render), data is stored in MongoDB so it
// survives restarts/redeploys. With no URI, it falls back to db/data.json so
// the app still runs locally with start.bat — no database needed.
const DB_DIR    = path.join(__dirname, 'db');
const DB_FILE   = path.join(DB_DIR, 'data.json');
const USE_MONGO = !!process.env.MONGODB_URI;
if (!USE_MONGO && !fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let data = {
  admin: null,                     // { username, password_hash }
  questions: [],                   // [{ id, section, label, type, placeholder, options, required, order_num, active }]
  students: [],                    // [{ id, name, email, phone, token, completed, completed_at, created_at }]
  responses: [],                   // [{ student_id, question_id, answer }]
  nextQuestionId: 1,
  nextStudentId: 1
};

let mongoColl = null;

async function loadData() {
  if (USE_MONGO) {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const dbName = process.env.MONGODB_DB || 'studentsurvey';
    mongoColl = client.db(dbName).collection('appdata');
    const doc = await mongoColl.findOne({ _id: 'singleton' });
    if (doc) { delete doc._id; data = doc; }
    console.log('Storage: MongoDB connected (' + dbName + ')');
  } else {
    if (fs.existsSync(DB_FILE)) {
      try { data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
      catch (e) { console.error('Could not read data file, starting fresh:', e.message); }
    }
    console.log('Storage: local JSON file (' + DB_FILE + ')');
  }
}

// Write the full state. Each write is a complete snapshot, so it is safe to
// call often; the latest write always reflects the current state.
async function persistNow() {
  if (USE_MONGO) {
    if (mongoColl) {
      await mongoColl.replaceOne(
        { _id: 'singleton' },
        Object.assign({ _id: 'singleton' }, data),
        { upsert: true }
      );
    }
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }
}

// Fire-and-forget variant for interactive admin actions.
function saveNow() {
  persistNow().catch(e => console.error('Persist error:', e.message));
}

// ── Seed + migrate (runs once at startup, after data is loaded) ───────────────
function seedAndMigrate() {
// ── Seed admin ───────────────────────────────────────────────────────────────
if (!data.admin) {
  data.admin = { username: 'admin', password_hash: bcrypt.hashSync('admin123', 10) };
}

// ── Seed default questions from the Student Service Form PDF ──────────────────
if (!data.questions.length) {
  const seed = [
    // Student Info
    ['Student Info','Full Name','text','Enter your full name',null,1,1],
    ['Student Info','Date','date',null,null,1,2],
    ['Student Info','Session #','text','Session number',null,0,3],
    ['Student Info','Phone Number','tel','(555) 555-5555',null,1,4],
    ['Student Info','Email Address','email','your@email.com',null,1,5],
    // Birth Certificate
    ['Birth Certificate','Birth Certificate Obtained?','yes_no',null,null,0,10],
    ['Birth Certificate','If not obtained – is it on its way?','yes_no',null,null,0,11],
    ['Birth Certificate','If on its way – where to?','text','Destination',null,0,12],
    ['Birth Certificate','Birth County','text','County of birth',null,0,13],
    ['Birth Certificate','Birth State','text','State of birth',null,0,14],
    // Social Security Card
    ['Social Security Card','SSC Requested Recently?','yes_no',null,null,0,20],
    ['Social Security Card','SSC Lost?','yes_no',null,null,0,21],
    ['Social Security Card','SSC Never Obtained?','yes_no',null,null,0,22],
    // DMV
    ["DMV Driver's License / ID","What do you need?",'select',null,"ID Card|Driver's License|Both|Neither",0,30],
    ["DMV Driver's License / ID","Driver's License Suspended?",'yes_no',null,null,0,31],
    ["DMV Driver's License / ID",'DUI Class Assigned? (include details if yes)','textarea','Details...',null,0,32],
    // EBT
    ['EBT – Food Stamps','EBT Transfer in Progress?','yes_no',null,null,0,40],
    ['EBT – Food Stamps','EBT Start Date','date',null,null,0,41],
    ['EBT – Food Stamps','Reason for Declining Service (if applicable)','textarea','Explain if applicable...',null,0,42],
    // MediCal
    ['MediCal','MediCal Status','select',null,'Active|Pending|Inactive|Never Applied|N/A',0,50],
    ['MediCal','MediCal Start Date','date',null,null,0,51],
    // Parole/Probation
    ['Transfer Parole / Probation','P.O. Informed?','yes_no',null,null,0,60],
    ['Transfer Parole / Probation','Status','text','Current status',null,0,61],
    ['Transfer Parole / Probation','County','text','County',null,0,62],
    ['Transfer Parole / Probation','P.O. Contact Info','text','Name and phone number',null,0,63],
    // Expungement
    ['Expungement','Known Warrant?','yes_no',null,null,0,70],
    ['Expungement','Charge(s) to Prioritize','textarea','List charges...',null,0,71],
    // Counseling
    ['Counseling','Prior Mental Health Diagnosis?','textarea','Describe if applicable...',null,0,80],
    ['Counseling','Prior Medication Prescribed?','textarea','List medications if applicable...',null,0,81],
    ['Counseling','Interested in 90-Day System Navigation for Counseling? (no commitment needed)','yes_no',null,null,0,82],
    // Medical
    ['Medical','Any ongoing illness or symptoms?','textarea','Describe...',null,0,90],
    ['Medical','Any injuries or past surgeries?','textarea','Describe...',null,0,91],
  ];
  for (const [section,label,type,placeholder,options,required,order_num] of seed) {
    data.questions.push({
      id: data.nextQuestionId++, section, label, type,
      placeholder: placeholder || null, options: options || null,
      required: required ? 1 : 0, order_num, active: 1,
      depends_on: null, depends_value: null, survey: 'current'
    });
  }
}

// ── Migration: ensure conditional-logic fields exist + wire the Birth Cert example ──
for (const q of data.questions) {
  if (!('depends_on' in q))    { q.depends_on = null; }
  if (!('depends_value' in q)) { q.depends_value = null; }
}
if (!data.migrations) data.migrations = {};
if (!data.migrations.birthCertConditional) {
  const obtained = data.questions.find(q => q.label === 'Birth Certificate Obtained?');
  const onWay    = data.questions.find(q => q.label === 'If not obtained – is it on its way?');
  const whereTo  = data.questions.find(q => q.label === 'If on its way – where to?');
  // Show "is it on its way?" only if "Obtained?" = No
  if (obtained && onWay && onWay.depends_on == null) {
    onWay.depends_on = obtained.id; onWay.depends_value = 'No';
  }
  // Show "where to?" only if "is it on its way?" = Yes
  if (onWay && whereTo && whereTo.depends_on == null) {
    whereTo.depends_on = onWay.id; whereTo.depends_value = 'Yes';
  }
  data.migrations.birthCertConditional = true;
}

// ── Two separate surveys: tag everything that has no survey as "current" ──────
for (const q of data.questions) if (!q.survey) q.survey = 'current';
for (const s of data.students)  if (!s.survey) s.survey = 'current';

// Seed a starter "graduate" (alumni) survey — kept completely separate from the
// current-students survey. The admin can fully customize these questions.
if (!data.migrations.graduateSeed) {
  if (!data.questions.some(q => q.survey === 'graduate')) {
    const gseed = [
      ['Graduate Info','Full Name','text','Enter your full name',null,1,1],
      ['Graduate Info','Email Address','email','your@email.com',null,1,2],
      ['Graduate Info','Phone Number','tel','(555) 555-5555',null,0,3],
      ['Graduate Info','Graduation Date','date',null,null,0,4],
      ['Employment','Are you currently employed?','yes_no',null,null,0,10],
      ['Employment','Where do you work?','text','Employer name',null,0,11],
      ['Follow-up','Would you like to stay in contact for alumni events?','yes_no',null,null,0,20],
    ];
    for (const [section,label,type,placeholder,options,required,order_num] of gseed) {
      data.questions.push({
        id: data.nextQuestionId++, section, label, type,
        placeholder: placeholder || null, options: options || null,
        required: required ? 1 : 0, order_num, active: 1,
        depends_on: null, depends_value: null, survey: 'graduate'
      });
    }
    // "Where do you work?" only shows if "Are you currently employed?" = Yes
    const emp   = data.questions.find(q => q.survey === 'graduate' && q.label === 'Are you currently employed?');
    const where = data.questions.find(q => q.survey === 'graduate' && q.label === 'Where do you work?');
    if (emp && where) { where.depends_on = emp.id; where.depends_value = 'Yes'; }
  }
  data.migrations.graduateSeed = true;
}
}  // end seedAndMigrate

// ── Helpers ───────────────────────────────────────────────────────────────────
// Survey type: 'current' (enrolled students) or 'graduate' (alumni). Kept separate.
const normSurvey = s => (s === 'graduate' ? 'graduate' : 'current');

const sortedQuestions = (activeOnly = false, survey = null) =>
  data.questions
    .filter(q => (!activeOnly || q.active) &&
                 (survey == null || normSurvey(q.survey) === survey))
    .sort((a, b) => (a.order_num - b.order_num) || (a.id - b.id));

const findStudentByToken = t => data.students.find(s => s.token === t);
const findStudent       = id => data.students.find(s => s.id === Number(id));
const findQuestion      = id => data.questions.find(q => q.id === Number(id));

const dateStamp = () => new Date().toISOString().slice(0, 10);
const csvCell = v => {
  v = (v == null) ? '' : String(v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};
const answersFor = sid => {
  const map = {};
  data.responses.filter(r => r.student_id === sid).forEach(r => { map[r.question_id] = r.answer; });
  return map;
};

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

const requireAdmin = (req, res, next) =>
  req.session.adminId ? next() : res.status(401).json({ error: 'Unauthorized' });

// ── Student Survey Routes ─────────────────────────────────────────────────────
app.get('/s/:token', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'survey.html')));

app.get('/api/survey/:token', (req, res) => {
  const student = findStudentByToken(req.params.token);
  if (!student) return res.status(404).json({ error: 'Survey link not found or expired.' });

  const questions = sortedQuestions(true, normSurvey(student.survey));
  const existing = {};
  if (student.completed) {
    data.responses
      .filter(r => r.student_id === student.id)
      .forEach(r => { existing[r.question_id] = r.answer; });
  }
  res.json({
    student: { id: student.id, name: student.name, completed: student.completed },
    questions, existing
  });
});

app.post('/api/survey/:token/submit', async (req, res) => {
  const student = findStudentByToken(req.params.token);
  if (!student) return res.status(404).json({ error: 'Survey link not found.' });
  if (student.completed) return res.status(400).json({ error: 'Survey already submitted.' });

  const { responses } = req.body;
  if (!responses || typeof responses !== 'object')
    return res.status(400).json({ error: 'Invalid data.' });

  // remove any old responses for this student, then add new ones
  data.responses = data.responses.filter(r => r.student_id !== student.id);
  for (const [qId, answer] of Object.entries(responses)) {
    data.responses.push({ student_id: student.id, question_id: Number(qId), answer: answer ?? '' });
  }
  student.completed = 1;
  student.completed_at = new Date().toISOString();
  try {
    await persistNow();   // await so a student's submission is durably saved
    res.json({ success: true });
  } catch (e) {
    console.error('Submit persist error:', e.message);
    res.status(500).json({ error: 'Could not save your answers. Please try again.' });
  }
});

// ── Admin Auth Routes ─────────────────────────────────────────────────────────
app.get('/admin', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/admin/dashboard', (req, res) =>
  req.session.adminId
    ? res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
    : res.redirect('/admin'));

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== data.admin.username || !bcrypt.compareSync(password, data.admin.password_hash))
    return res.status(401).json({ error: 'Invalid username or password.' });
  req.session.adminId = 1;
  req.session.adminUsername = data.admin.username;
  res.json({ success: true });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admin/me', requireAdmin, (req, res) =>
  res.json({ username: req.session.adminUsername }));

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!bcrypt.compareSync(currentPassword, data.admin.password_hash))
    return res.status(400).json({ error: 'Current password is incorrect.' });
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  data.admin.password_hash = bcrypt.hashSync(newPassword, 10);
  saveNow();
  res.json({ success: true });
});

// ── Admin Students ────────────────────────────────────────────────────────────
app.get('/api/admin/students', requireAdmin, (req, res) => {
  const survey = normSurvey(req.query.survey);
  const list = data.students
    .filter(s => normSurvey(s.survey) === survey)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(list);
});

app.post('/api/admin/students', requireAdmin, (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
  const student = {
    id: data.nextStudentId++,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    token: crypto.randomBytes(20).toString('hex'),
    completed: 0,
    completed_at: null,
    created_at: new Date().toISOString(),
    survey: normSurvey(req.body.survey)
  };
  data.students.push(student);
  saveNow();
  res.json(student);
});

app.put('/api/admin/students/:id', requireAdmin, (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
  const student = findStudent(req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found.' });
  student.name  = name.trim();
  student.email = email.trim().toLowerCase();
  student.phone = phone?.trim() || null;
  saveNow();
  res.json(student);
});

app.delete('/api/admin/students/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  data.students  = data.students.filter(s => s.id !== id);
  data.responses = data.responses.filter(r => r.student_id !== id);
  saveNow();
  res.json({ success: true });
});

app.post('/api/admin/students/:id/reset', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const student = findStudent(id);
  if (!student) return res.status(404).json({ error: 'Not found.' });
  data.responses = data.responses.filter(r => r.student_id !== id);
  student.completed = 0;
  student.completed_at = null;
  saveNow();
  res.json({ success: true });
});

// ── Admin Questions ───────────────────────────────────────────────────────────
app.get('/api/admin/questions', requireAdmin, (req, res) =>
  res.json(sortedQuestions(false, normSurvey(req.query.survey))));

// Persist a new ordering. Body: { items: [{ id, section }, ...] } in desired order.
// order_num is reassigned sequentially; section is updated so a question can also
// be moved into a different section. Sections stay grouped exactly as sent.
app.post('/api/admin/questions/reorder', requireAdmin, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required.' });
  items.forEach((it, i) => {
    const q = findQuestion(it.id);
    if (q) {
      q.order_num = (i + 1) * 10;
      if (it.section) q.section = it.section;
    }
  });
  saveNow();
  res.json({ success: true });
});

app.post('/api/admin/questions', requireAdmin, (req, res) => {
  const { section, label, type, placeholder, options, required, order_num, depends_on, depends_value } = req.body;
  if (!label) return res.status(400).json({ error: 'Label is required.' });
  const q = {
    id: data.nextQuestionId++,
    section: section || 'General',
    label,
    type: type || 'text',
    placeholder: placeholder || null,
    options: options || null,
    required: required ? 1 : 0,
    order_num: order_num || 999,
    active: 1,
    depends_on: depends_on ? Number(depends_on) : null,
    depends_value: depends_on ? (depends_value || null) : null,
    survey: normSurvey(req.body.survey)
  };
  data.questions.push(q);
  saveNow();
  res.json(q);
});

app.put('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const q = findQuestion(req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found.' });
  const { section, label, type, placeholder, options, required, order_num, active, depends_on, depends_value } = req.body;
  q.section       = section || 'General';
  q.label         = label;
  q.type          = type || 'text';
  q.placeholder   = placeholder || null;
  q.options       = options || null;
  q.required      = required ? 1 : 0;
  q.order_num     = order_num ?? 999;
  q.active        = active !== undefined ? (active ? 1 : 0) : 1;
  q.depends_on    = depends_on ? Number(depends_on) : null;
  q.depends_value = depends_on ? (depends_value || null) : null;
  saveNow();
  res.json(q);
});

app.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  data.questions  = data.questions.filter(q => q.id !== id);
  data.responses  = data.responses.filter(r => r.question_id !== id);
  saveNow();
  res.json({ success: true });
});

// ── Admin Responses ───────────────────────────────────────────────────────────
app.get('/api/admin/responses/:studentId', requireAdmin, (req, res) => {
  const student = findStudent(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'Not found.' });

  const responses = data.responses
    .filter(r => r.student_id === student.id)
    .map(r => {
      const q = findQuestion(r.question_id);
      return q
        ? { section: q.section, label: q.label, type: q.type, answer: r.answer, order_num: q.order_num }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.order_num - b.order_num);

  res.json({ student, responses });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const survey    = normSurvey(req.query.survey);
  const list      = data.students.filter(s => normSurvey(s.survey) === survey);
  const total     = list.length;
  const completed = list.filter(s => s.completed).length;
  res.json({ total, completed, pending: total - completed });
});

// ── Data Export ───────────────────────────────────────────────────────────────
// JSON: complete, machine-readable backup (best for re-import / future analysis)
app.get('/api/admin/export/json', requireAdmin, (req, res) => {
  const survey = normSurvey(req.query.survey);
  const questions = sortedQuestions(false, survey);
  const students = data.students.filter(s => normSurvey(s.survey) === survey).map(s => ({
    id: s.id, name: s.name, email: s.email, phone: s.phone,
    completed: !!s.completed, completed_at: s.completed_at, created_at: s.created_at,
    responses: data.responses
      .filter(r => r.student_id === s.id)
      .map(r => {
        const q = findQuestion(r.question_id);
        return { question_id: r.question_id, section: q ? q.section : null, label: q ? q.label : null, answer: r.answer };
      })
  }));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${survey}-survey-backup-${dateStamp()}.json"`);
  res.send(JSON.stringify({ survey, exportedAt: new Date().toISOString(), questions, students }, null, 2));
});

// CSV: one row per student, one column per question (opens in Excel)
app.get('/api/admin/export/csv', requireAdmin, (req, res) => {
  const survey = normSurvey(req.query.survey);
  const questions = sortedQuestions(false, survey);
  const header = ['Name', 'Email', 'Phone', 'Status', 'Submitted At', ...questions.map(q => q.label)];
  const lines = [header.map(csvCell).join(',')];
  for (const s of data.students.filter(s => normSurvey(s.survey) === survey)) {
    const ans = answersFor(s.id);
    const row = [
      s.name, s.email, s.phone || '',
      s.completed ? 'Completed' : 'Pending',
      s.completed_at || '',
      ...questions.map(q => ans[q.id] || '')
    ];
    lines.push(row.map(csvCell).join(','));
  }
  // BOM so Excel reads UTF-8 (Turkish characters) correctly
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${survey}-survey-responses-${dateStamp()}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

// Aggregate (used by the "Save All as PDF" feature in the browser)
app.get('/api/admin/export/all', requireAdmin, (req, res) => {
  const survey = normSurvey(req.query.survey);
  const questions = sortedQuestions(false, survey);
  const students = data.students.filter(s => normSurvey(s.survey) === survey).map(s => ({
    id: s.id, name: s.name, email: s.email, phone: s.phone,
    completed: !!s.completed, completed_at: s.completed_at,
    answers: answersFor(s.id)
  }));
  res.json({ questions, students });
});

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await loadData();
    seedAndMigrate();
    await persistNow();
    app.listen(PORT, () => {
      console.log('\n========================================');
      console.log(`  Student Survey App running on port ${PORT}`);
      console.log('========================================');
      console.log(`  Admin Panel : http://localhost:${PORT}/admin`);
      console.log('  CHANGE the default password after login!');
      console.log('========================================\n');
    });
  } catch (e) {
    console.error('Startup failed:', e);
    process.exit(1);
  }
})();
