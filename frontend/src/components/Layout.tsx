import { type ReactNode } from 'react'
import Navbar from './Navbar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#070b0e]">
      {/* Ambient grid — cyan tint */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,200,255,0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,200,255,0.016) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
        }}
      />

      {/* Green ambient blob — top right */}
      <div className="pointer-events-none fixed top-[-8%] right-[-4%] w-[560px] h-[560px] rounded-full bg-[#39ff85] opacity-[0.028] blur-[110px]" />

      {/* Cyan ambient blob — bottom left */}
      <div className="pointer-events-none fixed bottom-[-10%] left-[-4%] w-[480px] h-[480px] rounded-full bg-[#00c8ff] opacity-[0.022] blur-[120px]" />

      {/* Top accent bar: green → cyan */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-[#39ff8544] via-[#00c8ff33] to-transparent" />

      <Navbar />

      <main className="relative mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        {children}
      </main>
    </div>
  )
}
