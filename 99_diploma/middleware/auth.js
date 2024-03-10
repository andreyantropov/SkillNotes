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

const auth = () => async (req, res, next) => {
  if (!req.cookies["sessionId"]) {
    return res.redirect('/');
  }

  const user = await findUserBySessionId(req.cookies["sessionId"]);
  req.user = user;
  req.sessionId = req.cookies["sessionId"];
  next();
};

const redirectLoggedIn = () => async (req, res, next) => {
  if (req.cookies["sessionId"]) {
    return res.redirect('/dashboard');
  }
  next();
}

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

module.exports = {
  auth: auth,
  redirectLoggedIn: redirectLoggedIn,
}
