import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import styles from "./PageHero.module.css";

export default function PageHero({ label = "CENTRAL PRECATÓRIOS", title = "Clareza em cada próximo passo.", kind = "documentos", compact = false }: {label?: string;title?: string;kind?: "atendimento"|"parceiros"|"documentos";compact?:boolean}) {
  return <section className={`${styles.hero} ${compact?styles.compact:""}`} aria-label={label}>
    <Image src={`/visuals/${kind}-v2.png`} alt="" fill sizes="100vw" priority className={styles.image}/>
    <div className={styles.shade}/>
    <div className={styles.content}>
      <Link href="/" className={styles.back}><ArrowLeft size={16}/> Voltar à página inicial</Link>
      <div className={styles.copy}><span>{label}</span><h2>{title}</h2><p><ShieldCheck size={16}/> Informação clara. Decisão consciente.</p></div>
    </div>
    <small className={styles.caption}>Imagem ilustrativa gerada por IA</small>
  </section>;
}
