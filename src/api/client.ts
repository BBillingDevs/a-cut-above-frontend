import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:2222";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const pin = localStorage.getItem("aca_wholesale_pin");

  config.headers = config.headers || {};

  if (pin) {
    config.headers["x-wholesale-pin"] = pin;
  } else {
    // ✅ important: ensure header is not sent once you exit wholesale
    delete (config.headers as any)["x-wholesale-pin"];
  }

  return config;
});
