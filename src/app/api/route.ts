import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "API del Sistema de Almacén", status: "operativo" });
}