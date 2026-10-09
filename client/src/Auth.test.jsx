import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Auth from "./Auth.jsx";

const reply = (status, data) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => data });

afterEach(() => vi.restoreAllMocks());

async function openRegister(user) {
  await user.click(screen.getByRole("tab", { name: "Create account" }));
}

test("shows the sign-in form by default", () => {
  render(<Auth onLogin={() => {}} />);
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
});

test("empty sign-in shows errors and does not call the server", async () => {
  global.fetch = reply(200, {});
  const user = userEvent.setup();
  render(<Auth onLogin={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  expect(screen.getByText("Enter your password.")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("show and hide toggles the password field", async () => {
  const user = userEvent.setup();
  render(<Auth onLogin={() => {}} />);
  const field = screen.getByLabelText("Password");
  expect(field).toHaveAttribute("type", "password");
  await user.click(screen.getByRole("button", { name: "Show" }));
  expect(field).toHaveAttribute("type", "text");
  await user.click(screen.getByRole("button", { name: "Hide" }));
  expect(field).toHaveAttribute("type", "password");
});

test("successful sign-in sends the details and calls onLogin", async () => {
  const data = { token: "abc", user: { name: "Asha", role: "user" } };
  global.fetch = reply(200, data);
  const onLogin = vi.fn();
  const user = userEvent.setup();
  render(<Auth onLogin={onLogin} />);
  await user.type(screen.getByLabelText("Email"), "asha@example.com");
  await user.type(screen.getByLabelText("Password"), "Passw0rdOK");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(onLogin).toHaveBeenCalledWith(data, true));
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe("/api/auth/login");
  expect(JSON.parse(options.body)).toMatchObject({ email: "asha@example.com", password: "Passw0rdOK" });
});

test("wrong password shows the server message", async () => {
  global.fetch = reply(401, { message: "Email or password is incorrect." });
  const user = userEvent.setup();
  render(<Auth onLogin={() => {}} />);
  await user.type(screen.getByLabelText("Email"), "asha@example.com");
  await user.type(screen.getByLabelText("Password"), "WrongPass1");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
});

test("create account shows the extra fields and the password checklist", async () => {
  const user = userEvent.setup();
  render(<Auth onLogin={() => {}} />);
  await openRegister(user);
  expect(screen.getByLabelText("Full name")).toBeInTheDocument();
  expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  expect(screen.getByText("A number")).not.toHaveClass("ok");
  await user.type(screen.getByLabelText("Password"), "Passw0rdOK");
  for (const rule of ["8 or more characters", "An uppercase letter", "A lowercase letter", "A number"]) {
    expect(screen.getByText(rule)).toHaveClass("ok");
  }
  expect(screen.getByText("Password strength: Strong")).toBeInTheDocument();
});

test("mismatched confirm password is reported", async () => {
  const user = userEvent.setup();
  render(<Auth onLogin={() => {}} />);
  await openRegister(user);
  await user.type(screen.getByLabelText("Password"), "Passw0rdOK");
  await user.type(screen.getByLabelText("Confirm password"), "Different1");
  await user.tab();
  expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
});

test("an already-registered email is shown under the email field", async () => {
  global.fetch = reply(409, {
    message: "That email is already registered.",
    errors: { email: "That email is already registered. Try signing in." },
  });
  const user = userEvent.setup();
  render(<Auth onLogin={() => {}} />);
  await openRegister(user);
  await user.type(screen.getByLabelText("Full name"), "Asha Rao");
  await user.type(screen.getByLabelText("Email"), "asha@example.com");
  await user.type(screen.getByLabelText("Password"), "Passw0rdOK");
  await user.type(screen.getByLabelText("Confirm password"), "Passw0rdOK");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByText("That email is already registered. Try signing in.")).toBeInTheDocument();
});
