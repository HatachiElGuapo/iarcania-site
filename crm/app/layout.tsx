import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'IArcanIA CRM',
  description: 'Sistema de gestión IArcanIA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full flex" style={{ background: 'var(--void)', color: 'var(--bone)' }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </body>
    </html>
  )
}
