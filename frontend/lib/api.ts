const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function getConfig() {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

export async function updateConfig(fields: string[]) {
  const res = await fetch(`${BASE}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extract_fields: fields }),
  });
  if (!res.ok) throw new Error("Failed to update config");
  return res.json();
}

export async function screenResume(
  file: File,
  jdEntries: { role_name: string; jd_text: string }[],
  force = false
): Promise<{ status: number; data: any }> {
  const form = new FormData();
  form.append("resume", file);
  form.append("jd_entries", JSON.stringify(jdEntries));
  form.append("force", String(force));

  const res = await fetch(`${BASE}/screen`, { method: "POST", body: form });
  const data = await res.json();
  return { status: res.status, data };
}

export async function batchScreen(
  files: File[],
  jdEntries: { role_name: string; jd_text: string }[]
): Promise<any> {
  const form = new FormData();
  files.forEach((f) => form.append("resumes", f));
  form.append("jd_entries", JSON.stringify(jdEntries));

  const res = await fetch(`${BASE}/batch`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Batch request failed");
  return res.json();
}

export async function clearDuplicates(roleId: string) {
  const res = await fetch(`${BASE}/duplicates/${encodeURIComponent(roleId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to clear duplicates");
  return res.json();
}

export async function clearAllDuplicates() {
  const res = await fetch(`${BASE}/duplicates`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear all duplicates");
  return res.json();
}