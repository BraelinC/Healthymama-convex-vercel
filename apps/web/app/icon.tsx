import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Icon component
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom right, #dc2626, #ec4899)',
          borderRadius: '6px',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* HandPlatter icon from lucide-react */}
          <path d="M12 3V2" />
          <path d="M5 10a7.1 7.1 0 0 1 14 0" />
          <path d="M4 10h16" />
          <path d="M2 14h12a2 2 0 1 1 0 4h-2" />
          <path d="m15.4 17.4 3.2-2.8a2 2 0 0 1 2.8 2.9l-3.6 3.3c-.7.8-1.7 1.2-2.8 1.2h-4c-1.1 0-2.1-.4-2.8-1.2L5 18" />
          <path d="M5 14v7H2" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
