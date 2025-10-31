import { useRef } from 'react'

interface VideoUploadProps {
  onVideoUpload: (file: File) => void
  disabled?: boolean
}

export function VideoUpload({ onVideoUpload, disabled }: VideoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      onVideoUpload(file)
    } else {
      alert('動画ファイルを選択してください')
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="upload-section">
      <h2>動画をアップロード</h2>
      <p>スノーボードの滑走動画を選択してください（MP4, MOV, AVIなど）</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <button
        onClick={handleButtonClick}
        className="upload-button"
        disabled={disabled}
      >
        動画を選択
      </button>
    </div>
  )
}
