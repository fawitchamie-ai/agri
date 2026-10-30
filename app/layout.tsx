import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'AgriPrévision — Ma parcelle, ma saison',description:'Dessinez votre parcelle sur la carte d’Afrique, calculez sa surface et préparez votre campagne avec des simulations documentées.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="fr"><body>{children}</body></html>}
