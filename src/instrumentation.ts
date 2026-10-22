export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportEnv } = await import("@/lib/env");
  reportEnv();
}
