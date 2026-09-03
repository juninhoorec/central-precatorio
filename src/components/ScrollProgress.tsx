"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";
import styles from "./ScrollProgress.module.css";
export default function ScrollProgress(){
  const [percent,setPercent]=useState(0);const path=usePathname();
  useEffect(()=>{let frame=0;const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const total=document.documentElement.scrollHeight-window.innerHeight;setPercent(total>0?Math.max(0,Math.min(100,Math.round(window.scrollY/total*100))):100)})};update();window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);const observer=new ResizeObserver(update);observer.observe(document.body);return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("scroll",update);window.removeEventListener("resize",update)}},[path]);
  return <div className={styles.widget}><div className={styles.ring} role="progressbar" aria-label="Porcentagem de rolagem da página" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><circle cx="24" cy="24" r="21" pathLength="100" strokeDasharray={`${percent} 100`}/></svg><span>{percent}<small>%</small></span></div><button aria-label="Voltar ao topo" title="Voltar ao topo" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"})}><ArrowUp size={17}/></button></div>;
}
