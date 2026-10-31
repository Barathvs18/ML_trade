import api from "./client";

/** @returns {Promise<{id:string,email:string,name:string|null,picture:string|null}>} */
export async function getCurrentUser() {
  return (await api.get("/auth/me")).data;
}

/** @returns {Promise<void>} */
export async function logout() {
  await api.post("/auth/logout");
}
