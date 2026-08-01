"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import styles from "./knowledge.module.css";

type Project = { id: string; name: string };
type Media = { id: string; project_id: string; media_type: string; title: string | null };

export function ProjectMediaManager({ projects, media }: { projects: Project[]; media: Media[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function upload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return;
    setBusy(true); setFeedback(null);
    try {
      const reserve = await fetch("/api/project-media", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reserve", projectId: formData.get("projectId"), mediaType: formData.get("mediaType"), title: formData.get("title"), mimeType: file.type, sizeBytes: file.size }),
      });
      const reserved = await reserve.json() as { uploadId?: string; path?: string; token?: string; error?: string };
      if (!reserve.ok || !reserved.uploadId || !reserved.path || !reserved.token) throw new Error(reserved.error || "Reserva recusada.");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("gril-projects").uploadToSignedUrl(reserved.path, reserved.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const finalized = await fetch("/api/project-media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "finalize", uploadId: reserved.uploadId }) });
      const result = await finalized.json() as { error?: string };
      if (!finalized.ok) throw new Error(result.error || "Finalização recusada.");
      setFeedback("Mídia publicada na base do Pedro."); router.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "O upload falhou."); }
    finally { setBusy(false); }
  }

  async function remove(mediaId: string) {
    if (!window.confirm("Excluir fisicamente esta mídia? O espaço será liberado imediatamente.")) return;
    setBusy(true); setFeedback(null);
    try {
      const response = await fetch("/api/project-media", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "A exclusão falhou.");
      setFeedback("Mídia excluída e espaço liberado."); router.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "A exclusão falhou."); }
    finally { setBusy(false); }
  }

  return <section className={styles.formCard}>
    <div><p className={styles.eyebrow}>Arquivos privados aprovados</p><h2>Fotos e book</h2></div>
    <p className={styles.helper}>Até 5 fotos JPEG/PNG (5 MB cada), sendo uma principal, e um PDF de até 20 MB.</p>
    <form action={upload} className={styles.embeddedForm}>
      <label><span>Empreendimento</span><select name="projectId" required><option value="">Selecione</option>{projects.map((project)=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label><span>Tipo</span><select name="mediaType"><option value="cover">Foto principal</option><option value="image">Foto adicional</option><option value="pdf">Book PDF</option></select></label>
      <label><span>Título</span><input name="title" required /></label>
      <label><span>Arquivo</span><input accept="image/jpeg,image/png,application/pdf" name="file" required type="file" /></label>
      <button disabled={busy} type="submit">{busy ? "Processando…" : "Publicar conhecimento"}</button>
    </form>
    {feedback ? <p aria-live="polite" className={styles.helper}>{feedback}</p> : null}
    <div className={styles.mediaList}>{media.map((item)=><div key={item.id}><span><strong>{item.title || "Sem título"}</strong><small>{item.media_type}</small></span><button disabled={busy} onClick={()=>remove(item.id)} type="button">Excluir</button></div>)}</div>
  </section>;
}
