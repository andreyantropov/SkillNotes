const express = require('express');
const router = express.Router();
const { marked } = require('marked');
const markdownPdf = require('markdown-pdf');
const { Readable } = require("stream");

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

const Age = {
  ONE_WEEK: '1week',
  ONE_MONTH: '1month',
  THREE_MONTH: '3month',
  ALL_TIME: 'alltime',
  ARCHIVE: 'archive',
};

router.get("/notes", auth(), async (req, res) => {
  try {
    const { age, search, page } = req.query;

    const notes = await readNotes(req.user.id, age, search, page);

    const data = {
      data: notes,
      hasMore: false, //TODO
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.get("/notes/:id", auth(), async (req, res) => {
  try {
    const id = req.params.id;
    const note = await readNoteById(id, req.user.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    res.json({ ...note, html: marked.parse(note.text), isArchived: note.is_archive, });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.post("/notes", auth(), async (req, res) => {
  try {
    const { title, text } = req.body;
    const newNote = await createNote(req.user.id, title, text);
    res.status(201).json(newNote);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.patch("/notes/:id", auth(), async (req, res) => {
  try {
    const id = req.params.id;
    const { title, text } = req.body;
    const updNote = await updateNote(id, req.user.id, title, text);
    if (!updNote) {
      return res.status(404).json({ message: 'Note not found' });
    }
    res.status(201).json(updNote);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.post("/notes/:id/archive", auth(), async (req, res) => {
  try {
    const id = req.params.id;
    const updNote = await archiveNote(id, req.user.id);
    if (!updNote) {
      return res.status(404).json({ message: 'Note not found' });
    }
    res.status(201).json(updNote);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.post("/notes/:id/unarchive", auth(), async (req, res) => {
  try {
    const id = req.params.id;
    const updNote = await unarchiveNote(id, req.user.id);
    if (!updNote) {
      return res.status(404).json({ message: 'Note not found' });
    }
    res.status(201).json(updNote);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.delete("/notes/:id", auth(), async (req, res) => {
  try {
    const id = req.params.id;
    const delNote = await deleteNote(id, req.user.id);
    if (!delNote) {
      return res.status(404).json({ message: 'Note not found' });
    }
    res.status(201).json(delNote);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.delete("/notes", auth(), async (req, res) => {
  try {
    const delNote = await deleteArchiveNotes(req.user.id);
    res.status(201).json(delNote);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.get("/notes/:id/download", auth(), async (req, res) => {
  try {
    const id = req.params.id;
    const note = await readNoteById(id, req.user.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const fileName = `${note.title}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const markdownStream = new Readable();
    markdownStream.push(note.text);
    markdownStream.push(null);
    markdownStream.pipe(markdownPdf()).pipe(res);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

const readNotes = async (userId, age = '1week', search = '', page = 1) => {
  const offset = 20 * (page - 1);

  let query = knex("notes").where({ user_id: userId });

  switch (age) {
    case Age.ONE_WEEK:
      query = query.where("created_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      break;
    case Age.ONE_MONTH:
      query = query.where("created_at", ">=", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      break;
    case Age.THREE_MONTH:
      query = query.where("created_at", ">=", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
      break;
    case Age.ARCHIVE:
      query = query.where({ is_archive: true });
      break;
    case Age.ALL_TIME:
    default:
      break;
  }

  if (age && age !== 'alltime') {
    if (age === '1week') {
      query = query.where({ is_archive: false }).where("created_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    } else if (age === '1month') {
      query = query.where({ is_archive: false }).where("created_at", ">=", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    } else if (age === '3month') {
      query = query.where({ is_archive: false }).where("created_at", ">=", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
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
  await knex("notes")
    .select()
    .where({
      id: id,
      user_id: userId,
    })
    .then((results) => results[0]);

const createNote = async (userId, title, text) =>
  await knex("notes")
    .insert({
      user_id: userId,
      title: title,
      text: text,
    })
    .returning('*')
    .then((results) => results[0]);

const updateNote = async (id, userId, title, text) =>
  await knex("notes")
    .update({
      title: title,
      text: text,
    })
    .where({ id: id, user_id: userId })
    .returning('*')
    .then((results) => results[0]);

const archiveNote = async (id, userId) =>
  await knex("notes")
    .update({
      is_archive: true,
    })
    .where({ id: id, user_id: userId })
    .returning('*')
    .then((results) => results[0]);

const unarchiveNote = async (id, userId) =>
  await knex("notes")
    .update({
      is_archive: false,
    })
    .where({ id: id, user_id: userId })
    .returning('*')
    .then((results) => results[0]);

const deleteNote = async (id, userId) =>
  await knex("notes")
    .where({
      id: id,
      user_id: userId,
    })
    .delete()
    .returning('id')
    .then((results) => results[0]);

const deleteArchiveNotes = async (userId) =>
  await knex("notes")
    .where({
      user_id: userId,
      is_archive: true,
    })
    .delete()
    .returning('id');

module.exports = router;
