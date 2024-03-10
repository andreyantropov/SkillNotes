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
  const queryParams = new URLSearchParams({
    age,
    search,
    page
  });

  const response = await fetch(`${PREFIX}/notes?${queryParams}`);

  const notes = await response.json();
  return notes;
};

export const createNote = async (title, text) => {
  const response = await fetch(`${PREFIX}/notes`, {
    method: "POST",
    body: JSON.stringify({ title, text }),
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    console.error(response);
  }

  const newNote = await response.json();
  return newNote[0];
};

export const getNote = async (id) => {
  return await fetch(`${PREFIX}/notes/${id}`);
};

export const archiveNote = async (id) => {
  await fetch(`${PREFIX}/notes/${id}/archive`, {
    method: "POST",
  });
};

export const unarchiveNote = async () => {
  await fetch(`${PREFIX}/notes/${id}/unarchive`, {
    method: "POST",
  });
};

export const editNote = async (id, title, text) => {
  await fetch(`${PREFIX}/notes/${id}`, {
    method: "PATCH",
    data: { title, text },
  });
};

export const deleteNote = async (id) => {
  await fetch(`${PREFIX}/notes/${id}`, {
    method: "DELETE",
  });
};

export const deleteAllArchived = async () => {
  await fetch(`${PREFIX}/notes`, {
    method: "DELETE",
  });
};

export const notePdfUrl = (id) => {};
