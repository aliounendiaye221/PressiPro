import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return errorResponse(messages.join(", "), 400);
  }
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return errorResponse("Non autorisé", 401);
    }
    if (error.message === "FORBIDDEN") {
      return errorResponse("Accès refusé", 403);
    }
    if (error.message === "NOT_FOUND") {
      return errorResponse("Ressource introuvable", 404);
    }
    console.error("API Error:", error);
    return errorResponse("Erreur interne du serveur", 500);
  }
  return errorResponse("Erreur inconnue", 500);
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
