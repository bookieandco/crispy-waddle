import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import styles from "./JhadinaPrimitives.module.css"

export function Surface({children,raised=false,className="",...props}:HTMLAttributes<HTMLDivElement>&{raised?:boolean}){
  return <div className={`${styles.surface} ${raised?styles.raised:""} ${className}`} {...props}>{children}</div>
}
export function Card({children,className="",...props}:HTMLAttributes<HTMLDivElement>){
  return <Surface className={`${styles.card} ${className}`} {...props}>{children}</Surface>
}
export function Button({children,variant="default",className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"default"|"primary"}){
  return <button className={`${styles.button} ${variant==="primary"?styles.primary:""} ${className}`} {...props}>{children}</button>
}
export function Status({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"success"|"warning"|"danger"}){
  return <span className={`${styles.status} ${styles[tone]}`}><span className={styles.dot} aria-hidden="true"/>{children}</span>
}
export function StateMessage({title,children}: {title:string;children?:ReactNode}){
  return <Surface className={styles.state} role="status"><h2>{title}</h2>{children?<p>{children}</p>:null}</Surface>
}
export function Skeleton({width="100%",height=16}:{width?:string|number;height?:string|number}){
  return <span className={styles.skeleton} style={{width,height}} aria-hidden="true"/>
}
