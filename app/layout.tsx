import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'AgriPrévision Togo — Préparer les campagnes',description:'Du mémoire à la campagne : explorer les rendements agricoles, simuler et organiser la collecte au Togo.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="fr"><body>{children}</body></html>}
