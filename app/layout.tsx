import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'AgriPrévision Togo — Observatoire agricole',description:'Explorez les données agricoles du Togo, leurs transformations, les modèles et les prévisions. Comprendre les résultats et préparer les campagnes.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="fr"><body>{children}</body></html>}
