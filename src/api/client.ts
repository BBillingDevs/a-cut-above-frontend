import axios from "axios";

export const API_BASE = import.meta.env.PROD
  ? "" // ✅ same-origin (Netlify). Requests go to /api/... and /uploads/... on Netlify domain
  : import.meta.env.VITE_LOCAL_API_BASE;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const pin = localStorage.getItem("aca_wholesale_pin");

  config.headers = config.headers || {};

  if (pin) {
    (config.headers as any)["x-wholesale-pin"] = pin;
  } else {
    delete (config.headers as any)["x-wholesale-pin"];
  }

  return config;
});
