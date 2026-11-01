'use client';
import {useState,type ReactNode} from 'react';
export function Pencil(){return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m13 6 5 5"/></svg>;}
export function EditButton({label,onClick,expanded}:{label:string;onClick:()=>void;expanded?:boolean}){return <button type="button" className="qs-edit-button" aria-label={'Modifier '+label} title={'Modifier '+label} aria-expanded={expanded} onClick={onClick}><Pencil/></button>;}
export default function EditableValue({label,value,hint,children,onEditChange}:{label:string;value:ReactNode;hint?:ReactNode;children:ReactNode;onEditChange?:(editing:boolean)=>void}){
 const [editing,setEditing]=useState(false);
 function toggle(next:boolean){setEditing(next);onEditChange?.(next);}
 return <div className={'qs-editable'+(editing?' is-editing':'')} onKeyDown={e=>{if(e.key==='Escape')toggle(false);}}><div className="qs-editable-label"><span>{label}</span><EditButton label={label.toLowerCase()} expanded={editing} onClick={()=>toggle(!editing)}/></div>{editing?<div className="qs-inline-editor">{children}<button type="button" className="qs-edit-done" onClick={()=>toggle(false)}>Terminer ✓</button></div>:<div className="qs-editable-value">{value}</div>}{hint&&<small>{hint}</small>}</div>;
}
