const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const apiFetch = async (endpoint, options = {}) => {
  const usuario = JSON.parse(localStorage.getItem("qm_usuario") || "null");
  const token = usuario?.token;

  const body =
    options.body && typeof options.body === "object"
      ? JSON.stringify(options.body)
      : options.body;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    body,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    localStorage.removeItem("qm_usuario");
    window.location.href = "/";
    return;
  }

  if (!response.ok) {
    throw new Error(data?.mensaje || "Error en la solicitud");
  }

  return data;
};

export default API_URL;