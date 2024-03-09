const PREFIX = "http://localhost:3000";

const req = (url, options = {}) => {
  const { body } = options;

  return fetch((PREFIX + url).replace(/\/\/$/, ""), {
    ...options,
    body: body ? JSON.stringify(body) : null,
    headers: {
      ...options.headers,
      ...(body
        ? {
            "Content-Type": "application/json",
          }
        : null),
    },
  }).then((res) =>
    res.ok
      ? res.json()
      : res.text().then((message) => {
          throw new Error(message);
        }),
  );
};

export const getNotes = async ({ age, search, page } = {}) => {
  return await fetch(`${PREFIX}/note?age=${age}&search=${search}&page=${page}`);
};

export const createNote = async (title, text) => {
  await fetch(`${PREFIX}/note`, {
    method: "POST",
    data: { title, text },
  });
};

export const getNote = async (id) => {
  return await fetch(`${PREFIX}/note/${id}`);
};

export const archiveNote = async (id) => {
  await fetch(`${PREFIX}/note/${id}/archive`, {
    method: "POST",
  });
};

export const unarchiveNote = async () => {
  await fetch(`${PREFIX}/note/${id}/unarchive`, {
    method: "POST",
  });
};

export const editNote = async (id, title, text) => {
  await fetch(`${PREFIX}/note/${id}`, {
    method: "PATCH",
    data: { title, text },
  });
};

export const deleteNote = async (id) => {
  await fetch(`${PREFIX}/note/${id}`, {
    method: "DELETE",
  });
};

export const deleteAllArchived = async () => {
  await fetch(`${PREFIX}/note`, {
    method: "DELETE",
  });
};

export const notePdfUrl = (id) => {};
