// lib/api/auth.ts

import { apiFetch } from "./client";

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type RegisterResponse = {
  id: string;
  name: string;
  email: string;
};

export async function register(payload: RegisterPayload) {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    json: payload,
  });
}

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  id: string;
  name: string;
  email: string;
};

export async function login(payload: LoginPayload) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    json: payload,
  });
}
