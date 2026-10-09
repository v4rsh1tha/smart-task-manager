// Small helper: adds the JWT, turns failures into readable errors.
export async function api(path, { method = "GET", body, token } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A saved token that the server rejects means the session has expired.
    if (res.status === 401 && token) window.dispatchEvent(new Event("auth:expired"));
    const err = new Error(data.message || "Something went wrong. Try again.");
    err.fields = data.errors || {};
    err.status = res.status;
    throw err;
  }
  return data;
}
