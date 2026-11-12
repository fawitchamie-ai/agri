import type { Metadata } from 'next';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import './globals.css';
import './product.css';
import './cropin-theme.css';
import '../components/agri/yield-overview.css';
export const metadata: Metadata = {title:'AgriPrévision — Votre champ, des choix plus clairs',description:'Dessinez votre parcelle sur la carte d’Afrique, calculez sa surface et préparez votre campagne avec des simulations documentées.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="fr"><body>{children}</body></html>}
