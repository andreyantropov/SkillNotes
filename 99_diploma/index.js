require("dotenv").config();

const express = require("express");
const nunjucks = require("nunjucks");
const cookieParser = require("cookie-parser");

const { auth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');

const app = express();

nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

app.set("view engine", "njk");

app.use(cookieParser());
app.use(express.json());
app.use(express.static("public"));

app.use(authRoutes);
app.use(noteRoutes);

app.get("/", auth(), (req, res) => {
  res.render("index", {
    user: req.user,
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

app.get("/dashboard", auth(), async (req, res) => {
  res.render('dashboard.njk', {
    username: req.user.username,
  });
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(404).send(err.message);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
