require("dotenv").config();

const express = require("express");
const nunjucks = require("nunjucks");
const { nanoid } = require("nanoid");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
});

const app = express();

nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

app.set("view engine", "njk");
app.use(cookieParser());
app.use(express.json());
app.use(express.static("public"));

app.set("view engine", "njk");

const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");

const auth = () => async (req, res, next) => {
  if (!req.cookies["sessionId"]) {
    return next();
  }
  const user = await findUserBySessionId(req.cookies["sessionId"]);
  req.user = user;
  req.sessionId = req.cookies["sessionId"];
  next();
};

app.get("/", auth(), (req, res) => {
  res.render("index", {
    user: req.user,
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

app.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body;
  await createUser(username, password);
  res.redirect("/dashboard");
});

app.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body;
  const user = await findUserByUsername(username);
  if (!user || user.password != hash(password)) {
    res.sendStatus(401);
    return;
  }
  const sessionId = await createSession(user.id);
  res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/dashboard");
});

app.get("/logout", auth(), async (req, res) => {
  if (!req.user) {
    return res.redirect("/");
  }
  await deleteSession(req.sessionId);
  res.clearCookie("sessionId").redirect("/");
});

app.get("/dashboard", auth(), async (req, res) => {
  res.render('dashboard.njk', {
    username: req.user.username,
  });
});

app.get("/note", auth(), async (req, res) => {
  const age = req.query.age || '1week';
  const search = req.query.search;
  const page = req.query.page || 1;

  const notes = readNotes(req.user.id, age, search, page);
  res.json(notes);
});

app.get("/note/:id", auth(), async (req, res) => {
  const id = req.params.id;
  const notes = await readNoteById(id, req.user.id);
  res.json(notes);
});

app.post("/note/new", auth(), async (req, res) => {
  const { title, text } = req.body;
  const newNote = await createNote(req.user.id, title, text);
  res.status(201).json(newNote);
});

app.patch("/note/:id/edit", auth(), async (req, res) => {
  const id = req.params.id;
  const { title, text } = req.body;
  await updateNote(id, req.user.id, title, text);
  res.status(201);
});

app.post("/note/:id/archive", auth(), async (req, res) => {
  const id = req.params.id;
  await archiveNote(id, req.user.id);
  res.status(201);
});

app.post("/note/:id/unarchive", auth(), async (req, res) => {
  const id = req.params.id;
  await unarchiveNote(id, req.user.id);
  res.status(201);
});

app.delete("/note/:id", auth(), async (req, res) => {
  const id = req.params.id;
  await deleteNote(id, req.user.id);
  res.status(201);
});

app.delete("/note", auth(), async (req, res) => {
  await deleteArchiveNotes(id, req.user.id);
  res.status(201);
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(404).send(err.message);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});

const createUser = async (username, password) => {
  const newUser = await knex("users").insert({
    username: username,
    password: hash(password),
  });
  return newUser;
};

const findUserByUsername = async (username) =>
  knex("users")
    .select()
    .where({ username })
    .limit(1)
    .then((results) => results[0]);

const findUserBySessionId = async (sessionId) => {
  const session = await knex("sessions")
    .select("user_id")
    .where({ session_id: sessionId })
    .limit(1)
    .then((results) => results[0]);

  if (!session) {
    return;
  }

  return knex("users")
    .select()
    .where({ id: session.user_id })
    .limit(1)
    .then((results) => results[0]);
};

const createSession = async (userId) => {
  const sessionId = nanoid();

  await knex("sessions").insert({
    user_id: userId,
    session_id: sessionId,
  });

  return sessionId;
};

const deleteSession = async (sessionId) => {
  await knex("sessions").where({ session_id: sessionId }).delete();
};

const readNotes = async (userId, age, search, page = 1) => {
  const offset = 20 * (page - 1);

  let query = knex("notes").where({ user_id: userId });

  if (age && age !== 'alltime') {
    if (age === '1week' ) {
      query = query.where("created_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    } else if (age === '1month') {
      query = query.where("created_at", ">=", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    } else if (age === '3month') {
      query = query.where("created_at", ">=", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    } else if (age === 'archive') {
      query = query.where({ is_archive: true });
    }
  }

  if (search) {
    query = query.where("text", "like", `%${search}%`).orWhere("title", "like", `%${search}%`);
  }

  return await query.limit(20).offset(offset);
};

const readNoteById = async (id, userId) =>
  await knex("notes").select().where({
    id: id,
    user_id: userId,
  });

const createNote = async (userId, title, text) => {
  const newNote = await knex("notes").insert({
    user_id: userId,
    title: title,
    text: text,
  });
  return newNote;
};

const updateNote = async (id, userId, title, text) =>
  await knex("notes")
    .update({
      title: title,
      text: text,
    })
    .where({ id: id, user_id: userId });

const archiveNote = async (id, userId) =>
  await knex("notes")
    .update({
      is_archive: true,
    })
    .where({ id: id, user_id: userId });

const unarchiveNote = async (id, userId) =>
  await knex("notes")
    .update({
      is_archive: false,
    })
    .where({ id: id, user_id: userId });

const deleteNote = async (id, userId) =>
  await knex("notes").delete({
    id: id,
    user_id: userId,
  });

const deleteArchiveNotes = async (userId) =>
  await knex("notes").delete({
    id: id,
    is_archive: true,
  });
