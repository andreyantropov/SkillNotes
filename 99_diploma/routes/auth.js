const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const { nanoid } = require("nanoid");
const crypto = require("crypto");

const { auth } = require('../middleware/auth');

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

router.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const id = await createUser(username, password);
    const sessionId = await createSession(id);
    res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const user = await findUserByUsername(username);
    if (!user || user.password != hash(password)) {
      res.sendStatus(401);
      return;
    }
    const sessionId = await createSession(user.id);
    res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.get("/logout", auth(), async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/");
    }
    await deleteSession(req.sessionId);
    res.clearCookie("sessionId").redirect("/");
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");

const findUserByUsername = async (username) =>
  knex("users")
    .select()
    .where({ username })
    .limit(1)
    .then((results) => results[0]);

const createUser = async (username, password) => {
  const newUser = await knex("users")
    .insert({
      username: username,
      password: hash(password),
    })
    .returning('id');
  return newUser;
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
  await knex("sessions")
    .where({ session_id: sessionId })
    .delete()
    .returning('id');
};

module.exports = router;
